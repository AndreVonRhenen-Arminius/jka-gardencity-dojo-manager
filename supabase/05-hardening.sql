-- JKA GardenCity Dojo Manager
-- File: 05-hardening.sql
-- Schema version: 0.2.3
-- Purpose: Apply least-privilege grants, protect browser-callable functions,
--          secure future database objects and verify the RLS baseline.
-- Important: Run only after 01-schema.sql, 02-functions.sql,
--            03-triggers.sql and 04-rls-policies.sql.

begin;

-- =========================================================
-- SCHEMA ACCESS
-- =========================================================

-- Browser roles must never be able to create objects in public.
revoke all on schema public from public, anon, authenticated;
grant usage on schema public to authenticated;

-- =========================================================
-- RESET DIRECT TABLE, SEQUENCE AND FUNCTION PRIVILEGES
-- =========================================================

-- Anonymous browser sessions receive no access to dojo objects.
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke all privileges on all functions in schema public from public, anon, authenticated;

-- =========================================================
-- GRANT TABLE OPERATIONS ONLY WHERE AN AUTHENTICATED RLS
-- POLICY EXISTS FOR THAT OPERATION
-- =========================================================

-- This mirrors table privileges to the policies installed by
-- 04-rls-policies.sql. RLS remains the row-level decision point.
do $$
declare
  r record;
begin
  for r in
    select
      p.tablename,
      bool_or(p.cmd in ('SELECT', 'ALL')) as can_select,
      bool_or(p.cmd in ('INSERT', 'ALL')) as can_insert,
      bool_or(p.cmd in ('UPDATE', 'ALL')) as can_update,
      bool_or(p.cmd in ('DELETE', 'ALL')) as can_delete
    from pg_policies p
    where p.schemaname = 'public'
      and (
        'authenticated'::name = any(p.roles)
        or 'public'::name = any(p.roles)
      )
    group by p.tablename
    order by p.tablename
  loop
    if r.can_select then
      execute format('grant select on table public.%I to authenticated', r.tablename);
    end if;

    if r.can_insert then
      execute format('grant insert on table public.%I to authenticated', r.tablename);
    end if;

    if r.can_update then
      execute format('grant update on table public.%I to authenticated', r.tablename);
    end if;

    if r.can_delete then
      execute format('grant delete on table public.%I to authenticated', r.tablename);
    end if;
  end loop;
end;
$$;

-- No browser role receives direct access to document-number state.
revoke all privileges on table public.document_number_sequences from anon, authenticated;

-- Audit history is append-only through trusted trigger functions.
revoke insert, update, delete, truncate on table public.audit_events from authenticated;

-- Schema version history is read-only to the application.
revoke insert, update, delete, truncate on table public.schema_versions from authenticated;

-- =========================================================
-- SECURE DOCUMENT NUMBER GENERATION
-- =========================================================

-- Replace the core number generator with an internally authorised version.
-- Wrapper functions such as next_invoice_number() call this function.
create or replace function public.next_document_number(
  p_document_type text,
  p_prefix text default null,
  p_document_date date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_type text := lower(trim(p_document_type));
  v_year integer := extract(year from coalesce(p_document_date, current_date))::integer;
  v_prefix text;
  v_number bigint;
  v_padding smallint;
  v_required_permission text;
begin
  if not public.is_current_user_authorised() then
    raise exception 'Access denied: this Microsoft account is not authorised.'
      using errcode = '42501';
  end if;

  if v_type is null or v_type = '' then
    raise exception 'Document type is required.' using errcode = '22023';
  end if;

  v_required_permission := case v_type
    when 'student' then 'people.write'
    when 'invoice' then 'finance.write'
    when 'receipt' then 'finance.write'
    when 'charge' then 'finance.write'
    when 'payment' then 'finance.write'
    when 'adjustment' then 'finance.write'
    when 'refund' then 'finance.write'
    when 'expense' then 'expenses.write'
    else 'settings.manage'
  end;

  if not public.current_user_has_role('administrator') then
    perform public.assert_current_user_permission(v_required_permission);
  end if;

  v_prefix := upper(coalesce(
    nullif(trim(p_prefix), ''),
    nullif(substr(regexp_replace(v_type, '[^a-zA-Z0-9]', '', 'g'), 1, 4), ''),
    'DOC'
  ));

  insert into public.document_number_sequences (
    document_type,
    prefix,
    current_year,
    next_number,
    padding_length,
    updated_by
  )
  values (
    v_type,
    v_prefix,
    v_year,
    1,
    4,
    auth.uid()
  )
  on conflict (document_type) do nothing;

  select dns.prefix, dns.current_year, dns.next_number, dns.padding_length
    into v_prefix, v_year, v_number, v_padding
  from public.document_number_sequences dns
  where dns.document_type = v_type
  for update;

  if v_year <> extract(year from coalesce(p_document_date, current_date))::integer then
    v_year := extract(year from coalesce(p_document_date, current_date))::integer;
    v_number := 1;
  end if;

  update public.document_number_sequences
     set current_year = v_year,
         next_number = v_number + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where document_type = v_type;

  return format(
    '%s-%s-%s',
    v_prefix,
    v_year,
    lpad(v_number::text, v_padding, '0')
  );
end;
$$;

-- The core generator remains private. Only purpose-specific wrappers are exposed.
revoke all on function public.next_document_number(text, text, date)
  from public, anon, authenticated;

-- =========================================================
-- EXPLICIT BROWSER-CALLABLE FUNCTION ALLOWLIST
-- =========================================================

-- Microsoft sign-in/profile linking.
grant execute on function public.sync_current_user_profile() to authenticated;

-- Authorisation and read-only helpers used by RLS and the application.
grant execute on function public.current_auth_email() to authenticated;
grant execute on function public.current_authorised_user_id() to authenticated;
grant execute on function public.is_current_user_authorised() to authenticated;
grant execute on function public.current_user_has_role(text) to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.calculate_age(date, date) to authenticated;
grant execute on function public.student_age(uuid, date) to authenticated;
grant execute on function public.current_grade_held_days(uuid, date) to authenticated;
grant execute on function public.student_attendance_percentage(uuid, date, date) to authenticated;
grant execute on function public.charge_allocated_amount(uuid) to authenticated;
grant execute on function public.charge_adjustment_net(uuid) to authenticated;
grant execute on function public.charge_outstanding_amount(uuid) to authenticated;
grant execute on function public.payment_allocated_amount(uuid) to authenticated;
grant execute on function public.payment_unallocated_amount(uuid) to authenticated;
grant execute on function public.family_outstanding_balance(uuid) to authenticated;
grant execute on function public.family_unallocated_credit(uuid) to authenticated;
grant execute on function public.invoice_calculated_subtotal(uuid) to authenticated;
grant execute on function public.invoice_calculated_payments(uuid) to authenticated;
grant execute on function public.expense_paid_amount(uuid) to authenticated;
grant execute on function public.make_bank_transaction_fingerprint(
  uuid, date, numeric, text, text, text, text
) to authenticated;
grant execute on function public.next_recurring_due_date(date, text) to authenticated;

-- Purpose-specific number generators. The core function enforces permissions.
grant execute on function public.next_student_number() to authenticated;
grant execute on function public.next_invoice_number(date) to authenticated;
grant execute on function public.next_receipt_number(date) to authenticated;
grant execute on function public.next_charge_number(date) to authenticated;
grant execute on function public.next_payment_number(date) to authenticated;
grant execute on function public.next_expense_number(date) to authenticated;
grant execute on function public.next_adjustment_number(date) to authenticated;
grant execute on function public.next_refund_number(date) to authenticated;

-- Internal mutation, trigger and audit functions remain unavailable for direct
-- browser RPC calls. They continue to work when invoked by trusted triggers.
revoke all on function public.assert_current_user_permission(text)
  from public, anon, authenticated;
revoke all on function public.write_audit_event(
  text, text, uuid, text, jsonb, jsonb, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.refresh_charge_status(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_invoice_totals(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_invoices_for_charge(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_expense_status(uuid)
  from public, anon, authenticated;

-- =========================================================
-- FUTURE-OBJECT DEFAULT PRIVILEGES
-- =========================================================

-- New objects created later must start private and be explicitly opened by a
-- reviewed migration. These statements apply to objects created by postgres.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

-- =========================================================
-- HARDENING ASSERTIONS
-- =========================================================

do $$
declare
  v_missing_rls text;
  v_anon_policy text;
  v_insecure_definer text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into v_missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not like 'pg_%'
    and not c.relrowsecurity;

  if v_missing_rls is not null then
    raise exception 'Hardening failed: RLS is not enabled on: %', v_missing_rls;
  end if;

  select string_agg(format('%I.%I:%s', p.schemaname, p.tablename, p.policyname), ', ')
    into v_anon_policy
  from pg_policies p
  where p.schemaname = 'public'
    and (
      'anon'::name = any(p.roles)
      or 'public'::name = any(p.roles)
    );

  if v_anon_policy is not null then
    raise exception 'Hardening failed: anonymous/public RLS policies exist: %', v_anon_policy;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into v_insecure_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    );

  if v_insecure_definer is not null then
    raise exception 'Hardening failed: SECURITY DEFINER functions without a fixed search_path: %',
      v_insecure_definer;
  end if;
end;
$$;

insert into public.schema_versions (version, description)
values ('0.2.3', 'JKA GardenCity Dojo Manager database hardening and least-privilege grants')
on conflict (version) do nothing;

commit;
