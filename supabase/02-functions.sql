-- JKA GardenCity Dojo Manager
-- File: 02-functions.sql
-- Schema version: 0.2.1
-- Purpose: Create authentication, authorisation, audit, numbering,
--          validation, balance and synchronisation helper functions.
-- Important: Run only after 01-schema.sql in the separate dojo Supabase project.

begin;

-- =========================================================
-- EMAIL, AUTHENTICATION AND AUTHORISATION HELPERS
-- =========================================================

create or replace function public.normalise_email(p_email text)
returns citext
language sql
immutable
strict
set search_path = public
as $$
  select nullif(lower(trim(p_email)), '')::citext;
$$;

create or replace function public.current_auth_email()
returns citext
language sql
stable
security definer
set search_path = public, auth
as $$
  select nullif(
    lower(trim(coalesce(auth.jwt() ->> 'email', ''))),
    ''
  )::citext;
$$;

create or replace function public.current_authorised_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select au.id
  from public.authorised_users au
  where au.is_active = true
    and au.revoked_at is null
    and (au.access_expires_at is null or au.access_expires_at > now())
    and lower(au.email::text) = lower(coalesce(public.current_auth_email()::text, ''))
    and (au.auth_user_id is null or au.auth_user_id = auth.uid())
  limit 1;
$$;

create or replace function public.is_current_user_authorised()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
     and public.current_authorised_user_id() is not null;
$$;

create or replace function public.current_user_has_role(p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.authorised_users au
    join public.user_role_assignments ura
      on ura.authorised_user_id = au.id
     and ura.removed_at is null
    join public.roles r
      on r.id = ura.role_id
     and r.is_active = true
    where au.id = public.current_authorised_user_id()
      and lower(r.role_code) = lower(trim(p_role_code))
  );
$$;

create or replace function public.current_user_has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.authorised_users au
    join public.user_role_assignments ura
      on ura.authorised_user_id = au.id
     and ura.removed_at is null
    join public.roles r
      on r.id = ura.role_id
     and r.is_active = true
    join public.role_permissions rp
      on rp.role_id = r.id
    join public.permissions p
      on p.id = rp.permission_id
    where au.id = public.current_authorised_user_id()
      and lower(p.permission_code) = lower(trim(p_permission_code))
  );
$$;

create or replace function public.assert_current_user_permission(p_permission_code text)
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_authorised() then
    raise exception 'Access denied: this Microsoft account is not authorised.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_permission(p_permission_code) then
    raise exception 'Access denied: missing permission %.', p_permission_code
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.sync_current_user_profile()
returns uuid
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email citext := public.current_auth_email();
  v_authorised_user_id uuid;
  v_display_name text;
begin
  if v_user_id is null or v_email is null then
    raise exception 'A valid authenticated Microsoft session is required.'
      using errcode = '42501';
  end if;

  select au.id
    into v_authorised_user_id
  from public.authorised_users au
  where lower(au.email::text) = lower(v_email::text)
    and au.is_active = true
    and au.revoked_at is null
    and (au.access_expires_at is null or au.access_expires_at > now())
    and (au.auth_user_id is null or au.auth_user_id = v_user_id)
  for update;

  if v_authorised_user_id is null then
    raise exception 'This Microsoft account is not on the dojo authorised-user allowlist.'
      using errcode = '42501';
  end if;

  update public.authorised_users
     set auth_user_id = coalesce(auth_user_id, v_user_id),
         updated_at = now(),
         record_version = record_version + 1
   where id = v_authorised_user_id;

  v_display_name := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    split_part(v_email::text, '@', 1)
  );

  insert into public.profiles (
    user_id,
    email,
    display_name,
    is_active,
    last_sign_in_at
  )
  values (
    v_user_id,
    v_email,
    v_display_name,
    true,
    now()
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        is_active = true,
        last_sign_in_at = now(),
        updated_at = now(),
        record_version = public.profiles.record_version + 1;

  return v_authorised_user_id;
end;
$$;

-- =========================================================
-- COMMON RECORD-METADATA TRIGGER FUNCTIONS
-- These are attached to selected tables by 03-triggers.sql.
-- =========================================================

create or replace function public.set_row_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
    new.record_version := coalesce(new.record_version, 1);
    return new;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

create or replace function public.set_reference_row_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at, now());
    new.record_version := coalesce(new.record_version, 1);
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

create or replace function public.set_profile_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at, now());
    new.record_version := coalesce(new.record_version, 1);
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

create or replace function public.set_checkpoint_updated_at()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =========================================================
-- AUDIT AND RECYCLE-BIN HELPERS
-- =========================================================

create or replace function public.write_audit_event(
  p_action text,
  p_record_type text,
  p_record_id uuid,
  p_summary text,
  p_previous_value jsonb default null,
  p_new_value jsonb default null,
  p_source text default 'app',
  p_device_or_session text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  insert into public.audit_events (
    user_id,
    action,
    record_type,
    record_id,
    summary,
    previous_value,
    new_value,
    device_or_session,
    source,
    correlation_id
  )
  values (
    auth.uid(),
    p_action,
    p_record_type,
    p_record_id,
    p_summary,
    p_previous_value,
    p_new_value,
    p_device_or_session,
    coalesce(nullif(trim(p_source), ''), 'app'),
    p_correlation_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_record_id uuid;
  v_action text;
  v_summary text;
  v_old_deleted_at text;
  v_new_deleted_at text;
begin
  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_action := 'created';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_action := 'permanently_deleted';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_old_deleted_at := v_old ->> 'deleted_at';
    v_new_deleted_at := v_new ->> 'deleted_at';

    if v_old_deleted_at is null and v_new_deleted_at is not null then
      v_action := 'archived';
    elsif v_old_deleted_at is not null and v_new_deleted_at is null then
      v_action := 'restored';
    else
      v_action := 'updated';
    end if;
  end if;

  v_record_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;
  v_summary := format('%s %s', replace(tg_table_name, '_', ' '), v_action);

  -- Never duplicate full protected medical details into the general audit log.
  if tg_table_name = 'student_medical_information' then
    v_old := case when v_old is null then null else jsonb_build_object(
      'protected_record', true,
      'student_id', v_old ->> 'student_id',
      'record_version', v_old ->> 'record_version',
      'deleted_at', v_old ->> 'deleted_at'
    ) end;

    v_new := case when v_new is null then null else jsonb_build_object(
      'protected_record', true,
      'student_id', v_new ->> 'student_id',
      'record_version', v_new ->> 'record_version',
      'deleted_at', v_new ->> 'deleted_at'
    ) end;
  end if;

  perform public.write_audit_event(
    v_action,
    tg_table_name,
    v_record_id,
    v_summary,
    v_old,
    v_new,
    'database_trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.maintain_deleted_record_index()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_record_id uuid;
  v_label text;
begin
  v_record_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;
  v_label := coalesce(
    nullif(v_new ->> 'student_number', ''),
    nullif(v_new ->> 'family_name', ''),
    nullif(v_new ->> 'full_name', ''),
    nullif(v_new ->> 'term_name', ''),
    nullif(v_new ->> 'event_name', ''),
    nullif(v_new ->> 'invoice_number', ''),
    nullif(v_new ->> 'payment_number', ''),
    nullif(v_new ->> 'charge_number', ''),
    nullif(v_new ->> 'expense_number', ''),
    nullif(v_new ->> 'title', ''),
    nullif(v_new ->> 'description', ''),
    v_record_id::text
  );

  if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
    insert into public.deleted_record_index (
      record_type,
      record_id,
      display_label,
      deleted_at,
      deleted_by,
      restore_status,
      metadata
    )
    values (
      tg_table_name,
      v_record_id,
      v_label,
      (v_new ->> 'deleted_at')::timestamptz,
      nullif(v_new ->> 'deleted_by', '')::uuid,
      'deleted',
      jsonb_build_object('table_schema', tg_table_schema)
    )
    on conflict (record_type, record_id) do update
      set display_label = excluded.display_label,
          deleted_at = excluded.deleted_at,
          deleted_by = excluded.deleted_by,
          restore_status = 'deleted',
          restored_at = null,
          restored_by = null,
          metadata = excluded.metadata;

  elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
    update public.deleted_record_index
       set restore_status = 'restored',
           restored_at = now(),
           restored_by = auth.uid()
     where record_type = tg_table_name
       and record_id = v_record_id;
  end if;

  return new;
end;
$$;

-- =========================================================
-- IMMUTABILITY AND FINANCIAL-HISTORY GUARDS
-- =========================================================

create or replace function public.guard_fee_schedule_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
declare
  v_is_used boolean;
begin
  select exists (
    select 1
    from public.charges c
    where c.fee_schedule_id = old.id
      and c.deleted_at is null
      and c.status <> 'draft'
  ) into v_is_used;

  if tg_op = 'DELETE' then
    if old.status = 'locked' or v_is_used then
      raise exception 'This fee schedule is locked or has historical charges. Create a new fee schedule version instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status = 'locked' or v_is_used then
    if new.schedule_name is distinct from old.schedule_name
       or new.version_number is distinct from old.version_number
       or new.effective_from is distinct from old.effective_from
       or new.effective_to is distinct from old.effective_to
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Historical fee schedule details cannot be changed. Create a new fee schedule version.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_fee_schedule_item_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
declare
  v_parent_locked boolean;
  v_is_used boolean;
begin
  select (fs.status = 'locked')
    into v_parent_locked
  from public.fee_schedules fs
  where fs.id = old.fee_schedule_id;

  select exists (
    select 1
    from public.charges c
    where c.fee_schedule_item_id = old.id
      and c.deleted_at is null
      and c.status <> 'draft'
  ) into v_is_used;

  if tg_op = 'DELETE' then
    if coalesce(v_parent_locked, false) or v_is_used then
      raise exception 'This fee item is locked or has historical charges. Create a new fee schedule version instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if coalesce(v_parent_locked, false) or v_is_used then
    if new.fee_schedule_id is distinct from old.fee_schedule_id
       or new.fee_code is distinct from old.fee_code
       or new.fee_name is distinct from old.fee_name
       or new.fee_type is distinct from old.fee_type
       or new.amount is distinct from old.amount
       or new.billing_frequency is distinct from old.billing_frequency
       or new.applicable_belt_rank_id is distinct from old.applicable_belt_rank_id
       or new.family_position is distinct from old.family_position
       or new.condition_data is distinct from old.condition_data
       or new.is_active is distinct from old.is_active
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Historical fee item details cannot be changed. Create a new fee schedule version.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_confirmed_charge_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' or old.confirmed_at is not null then
      raise exception 'Confirmed charges cannot be deleted. Reverse the charge instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status <> 'draft' or old.confirmed_at is not null then
    if new.charge_batch_id is distinct from old.charge_batch_id
       or new.student_id is distinct from old.student_id
       or new.family_id is distinct from old.family_id
       or new.term_id is distinct from old.term_id
       or new.event_id is distinct from old.event_id
       or new.grading_record_id is distinct from old.grading_record_id
       or new.fee_schedule_id is distinct from old.fee_schedule_id
       or new.fee_schedule_item_id is distinct from old.fee_schedule_item_id
       or new.fee_type is distinct from old.fee_type
       or new.description is distinct from old.description
       or new.charge_date is distinct from old.charge_date
       or new.original_amount is distinct from old.original_amount
       or new.discount_amount is distinct from old.discount_amount
       or new.final_amount is distinct from old.final_amount
       or new.reason_for_charge is distinct from old.reason_for_charge
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Confirmed charge history cannot be edited. Use a reversal or adjustment.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_confirmed_payment_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'DELETE' then
    if old.payment_status <> 'pending_confirmation' or old.confirmed_at is not null then
      raise exception 'Confirmed payments cannot be deleted. Reverse the payment instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.payment_status <> 'pending_confirmation' or old.confirmed_at is not null then
    if new.family_id is distinct from old.family_id
       or new.payer_guardian_id is distinct from old.payer_guardian_id
       or new.payment_date is distinct from old.payment_date
       or new.amount is distinct from old.amount
       or new.payment_method is distinct from old.payment_method
       or new.bank_description is distinct from old.bank_description
       or new.bank_reference is distinct from old.bank_reference
       or new.associated_term_id is distinct from old.associated_term_id
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Confirmed payment history cannot be edited. Use a reversal and corrected payment.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_payment_allocation_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment allocations cannot be deleted. Reverse the allocation instead.'
      using errcode = '23514';
  end if;

  if old.status = 'reversed' then
    raise exception 'A reversed payment allocation is immutable.'
      using errcode = '23514';
  end if;

  if new.payment_id is distinct from old.payment_id
     or new.charge_id is distinct from old.charge_id
     or new.allocation_amount is distinct from old.allocation_amount
     or new.allocation_date is distinct from old.allocation_date
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Allocation details cannot be edited. Reverse the allocation and create a replacement.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_issued_invoice_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Issued invoices cannot be deleted. Cancel the invoice instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status <> 'draft' then
    if new.invoice_number is distinct from old.invoice_number
       or new.family_id is distinct from old.family_id
       or new.guardian_id is distinct from old.guardian_id
       or new.invoice_date is distinct from old.invoice_date
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Issued invoice identity and history cannot be edited. Cancel and reissue if necessary.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_invoice_item_history()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
declare
  v_invoice_status text;
  v_invoice_id uuid;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  select i.status into v_invoice_status
  from public.invoices i
  where i.id = v_invoice_id;

  if v_invoice_status is distinct from 'draft' then
    raise exception 'Invoice items can only be changed while the invoice is in draft status.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- =========================================================
-- DOCUMENT AND STUDENT NUMBERING
-- =========================================================

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
begin
  if v_type is null or v_type = '' then
    raise exception 'Document type is required.' using errcode = '22023';
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

  select prefix, current_year, next_number, padding_length
    into v_prefix, v_year, v_number, v_padding
  from public.document_number_sequences
  where document_type = v_type
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

create or replace function public.next_student_number()
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('student', 'STU', current_date);
$$;

create or replace function public.next_invoice_number(p_invoice_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('invoice', 'JKA', p_invoice_date);
$$;

create or replace function public.next_receipt_number(p_receipt_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('receipt', 'RCP', p_receipt_date);
$$;

create or replace function public.next_charge_number(p_charge_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('charge', 'CHG', p_charge_date);
$$;

create or replace function public.next_payment_number(p_payment_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('payment', 'PAY', p_payment_date);
$$;

create or replace function public.next_expense_number(p_expense_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('expense', 'EXP', p_expense_date);
$$;

create or replace function public.next_adjustment_number(p_adjustment_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('adjustment', 'ADJ', p_adjustment_date);
$$;

create or replace function public.next_refund_number(p_refund_date date default current_date)
returns text
language sql
volatile
security definer
set search_path = public, auth
as $$
  select public.next_document_number('refund', 'REF', p_refund_date);
$$;

-- =========================================================
-- STUDENT, ATTENDANCE AND DATE HELPERS
-- =========================================================

create or replace function public.calculate_age(p_date_of_birth date, p_on_date date default current_date)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_date_of_birth is null or p_on_date is null or p_on_date < p_date_of_birth then null
    else extract(year from age(p_on_date, p_date_of_birth))::integer
  end;
$$;

create or replace function public.student_age(p_student_id uuid, p_on_date date default current_date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.calculate_age(s.date_of_birth, p_on_date)
  from public.students s
  where s.id = p_student_id
    and s.deleted_at is null;
$$;

create or replace function public.current_grade_held_days(p_student_id uuid, p_on_date date default current_date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    p_on_date - coalesce(
      (
        select max(gr.grading_date)
        from public.grading_records gr
        join public.students s2 on s2.id = gr.student_id
        where gr.student_id = p_student_id
          and gr.new_belt_rank_id = s2.current_belt_rank_id
          and gr.result = 'passed'
          and gr.deleted_at is null
      ),
      s.start_date
    )
  )
  from public.students s
  where s.id = p_student_id
    and s.deleted_at is null;
$$;

create or replace function public.student_attendance_percentage(
  p_student_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns numeric(6,2)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select ar.attendance_status
    from public.attendance_records ar
    join public.training_sessions ts
      on ts.id = ar.training_session_id
    where ar.student_id = p_student_id
      and ar.deleted_at is null
      and ts.deleted_at is null
      and ts.status <> 'cancelled'
      and (p_start_date is null or ts.session_date >= p_start_date)
      and (p_end_date is null or ts.session_date <= p_end_date)
      and ar.attendance_status <> 'excused'
  )
  select case
    when count(*) = 0 then 0::numeric(6,2)
    else round(
      100.0 * count(*) filter (where attendance_status in ('present', 'late', 'trial')) / count(*),
      2
    )::numeric(6,2)
  end
  from eligible;
$$;

-- =========================================================
-- CHARGE, PAYMENT, FAMILY AND INVOICE BALANCES
-- =========================================================

create or replace function public.charge_allocated_amount(p_charge_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pa.allocation_amount), 0)::numeric(12,2)
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.charge_id = p_charge_id
    and pa.status = 'active'
    and pa.deleted_at is null
    and p.payment_status = 'confirmed'
    and p.deleted_at is null;
$$;

create or replace function public.charge_adjustment_net(p_charge_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when fa.direction = 'increase_balance' then fa.amount
      when fa.direction = 'decrease_balance' then -fa.amount
      else 0
    end
  ), 0)::numeric(12,2)
  from public.financial_adjustments fa
  where fa.charge_id = p_charge_id
    and fa.approved_at is not null
    and fa.deleted_at is null;
$$;

create or replace function public.charge_outstanding_amount(p_charge_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.id is null or c.deleted_at is not null or c.status in ('cancelled', 'reversed') then 0::numeric(12,2)
    else greatest(
      c.final_amount
      + public.charge_adjustment_net(c.id)
      - public.charge_allocated_amount(c.id),
      0
    )::numeric(12,2)
  end
  from public.charges c
  where c.id = p_charge_id;
$$;

create or replace function public.payment_allocated_amount(p_payment_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pa.allocation_amount), 0)::numeric(12,2)
  from public.payment_allocations pa
  where pa.payment_id = p_payment_id
    and pa.status = 'active'
    and pa.deleted_at is null;
$$;

create or replace function public.payment_unallocated_amount(p_payment_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null or p.deleted_at is not null or p.payment_status in ('reversed', 'refunded') then 0::numeric(12,2)
    else greatest(p.amount - public.payment_allocated_amount(p.id), 0)::numeric(12,2)
  end
  from public.payments p
  where p.id = p_payment_id;
$$;

create or replace function public.family_outstanding_balance(p_family_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(public.charge_outstanding_amount(c.id)), 0)::numeric(12,2)
  from public.charges c
  left join public.students s on s.id = c.student_id
  where c.deleted_at is null
    and (c.family_id = p_family_id or s.family_id = p_family_id)
    and c.status not in ('draft', 'cancelled', 'reversed');
$$;

create or replace function public.family_unallocated_credit(p_family_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(public.payment_unallocated_amount(p.id)), 0)::numeric(12,2)
  from public.payments p
  where p.family_id = p_family_id
    and p.payment_status = 'confirmed'
    and p.deleted_at is null;
$$;

create or replace function public.invoice_calculated_subtotal(p_invoice_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(ii.line_amount), 0)::numeric(12,2)
  from public.invoice_items ii
  where ii.invoice_id = p_invoice_id;
$$;

create or replace function public.invoice_calculated_payments(p_invoice_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when ii.charge_id is null then 0
      else least(ii.line_amount, public.charge_allocated_amount(ii.charge_id))
    end
  ), 0)::numeric(12,2)
  from public.invoice_items ii
  where ii.invoice_id = p_invoice_id;
$$;

create or replace function public.refresh_charge_status(p_charge_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_charge public.charges%rowtype;
  v_outstanding numeric(12,2);
  v_allocated numeric(12,2);
  v_status text;
begin
  select * into v_charge
  from public.charges
  where id = p_charge_id
  for update;

  if not found then
    return null;
  end if;

  if v_charge.status in ('draft', 'cancelled', 'reversed') then
    return v_charge.status;
  end if;

  v_outstanding := public.charge_outstanding_amount(p_charge_id);
  v_allocated := public.charge_allocated_amount(p_charge_id);

  if v_outstanding <= 0 then
    v_status := 'paid';
  elsif v_charge.due_date is not null and v_charge.due_date < current_date then
    v_status := 'overdue';
  elsif v_allocated > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'unpaid';
  end if;

  if v_status is distinct from v_charge.status then
    update public.charges
       set status = v_status,
           updated_at = now(),
           updated_by = auth.uid()
     where id = p_charge_id;
  end if;

  return v_status;
end;
$$;

create or replace function public.refresh_invoice_totals(p_invoice_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_invoice public.invoices%rowtype;
  v_subtotal numeric(12,2);
  v_payments numeric(12,2);
  v_outstanding numeric(12,2);
  v_status text;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    return null;
  end if;

  v_subtotal := public.invoice_calculated_subtotal(p_invoice_id);
  v_payments := public.invoice_calculated_payments(p_invoice_id);
  v_outstanding := greatest(v_subtotal - v_invoice.credits_applied - v_payments, 0)::numeric(12,2);

  if v_invoice.status = 'cancelled' then
    v_status := 'cancelled';
  elsif v_invoice.status = 'draft' then
    v_status := 'draft';
  elsif v_outstanding <= 0 then
    v_status := 'paid';
  elsif v_invoice.due_date is not null and v_invoice.due_date < current_date then
    v_status := 'overdue';
  elsif (v_payments + v_invoice.credits_applied) > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'issued';
  end if;

  update public.invoices
     set subtotal = v_subtotal,
         payments_applied = v_payments,
         outstanding_amount = v_outstanding,
         status = v_status,
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_invoice_id;

  return v_status;
end;
$$;

create or replace function public.refresh_invoices_for_charge(p_charge_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_invoice_id uuid;
begin
  for v_invoice_id in
    select distinct ii.invoice_id
    from public.invoice_items ii
    where ii.charge_id = p_charge_id
  loop
    perform public.refresh_invoice_totals(v_invoice_id);
  end loop;
end;
$$;

-- =========================================================
-- PAYMENT AND INVOICE VALIDATION TRIGGER FUNCTIONS
-- =========================================================

create or replace function public.validate_payment_allocation()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_payment public.payments%rowtype;
  v_charge public.charges%rowtype;
  v_existing_payment_allocations numeric(12,2);
  v_existing_charge_allocations numeric(12,2);
  v_charge_adjustments numeric(12,2);
  v_charge_available numeric(12,2);
  v_charge_family_id uuid;
begin
  if new.status = 'reversed' then
    return new;
  end if;

  select * into v_payment
  from public.payments
  where id = new.payment_id
    and deleted_at is null;

  if not found then
    raise exception 'The selected payment does not exist.' using errcode = '23503';
  end if;

  if v_payment.payment_status <> 'confirmed' then
    raise exception 'Only confirmed payments can be allocated.' using errcode = '23514';
  end if;

  select * into v_charge
  from public.charges
  where id = new.charge_id
    and deleted_at is null;

  if not found then
    raise exception 'The selected charge does not exist.' using errcode = '23503';
  end if;

  if v_charge.status in ('draft', 'cancelled', 'reversed') then
    raise exception 'Payments cannot be allocated to a draft, cancelled or reversed charge.'
      using errcode = '23514';
  end if;

  select coalesce(sum(pa.allocation_amount), 0)
    into v_existing_payment_allocations
  from public.payment_allocations pa
  where pa.payment_id = new.payment_id
    and pa.status = 'active'
    and pa.deleted_at is null
    and pa.id <> coalesce(new.id, gen_random_uuid());

  if v_existing_payment_allocations + new.allocation_amount > v_payment.amount then
    raise exception 'This allocation would exceed the unallocated amount of the payment.'
      using errcode = '23514';
  end if;

  select coalesce(sum(pa.allocation_amount), 0)
    into v_existing_charge_allocations
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.charge_id = new.charge_id
    and pa.status = 'active'
    and pa.deleted_at is null
    and p.payment_status = 'confirmed'
    and p.deleted_at is null
    and pa.id <> coalesce(new.id, gen_random_uuid());

  v_charge_adjustments := public.charge_adjustment_net(new.charge_id);
  v_charge_available := greatest(
    v_charge.final_amount + v_charge_adjustments - v_existing_charge_allocations,
    0
  );

  if new.allocation_amount > v_charge_available then
    raise exception 'This allocation would exceed the outstanding amount of the charge.'
      using errcode = '23514';
  end if;

  select coalesce(v_charge.family_id, s.family_id)
    into v_charge_family_id
  from public.charges c
  left join public.students s on s.id = c.student_id
  where c.id = v_charge.id;

  if v_payment.family_id is not null
     and v_charge_family_id is not null
     and v_payment.family_id <> v_charge_family_id then
    raise exception 'The payment family does not match the charge family.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.after_payment_allocation_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_charge_id uuid;
begin
  v_charge_id := case when tg_op = 'DELETE' then old.charge_id else new.charge_id end;
  perform public.refresh_charge_status(v_charge_id);
  perform public.refresh_invoices_for_charge(v_charge_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.validate_invoice_item()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_invoice public.invoices%rowtype;
  v_charge public.charges%rowtype;
  v_charge_family_id uuid;
begin
  select * into v_invoice
  from public.invoices
  where id = new.invoice_id
    and deleted_at is null;

  if not found then
    raise exception 'The selected invoice does not exist.' using errcode = '23503';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Items can only be added to a draft invoice.' using errcode = '23514';
  end if;

  new.line_amount := round(new.quantity * new.unit_amount, 2);

  if new.charge_id is not null then
    select * into v_charge
    from public.charges
    where id = new.charge_id
      and deleted_at is null;

    if not found then
      raise exception 'The selected charge does not exist.' using errcode = '23503';
    end if;

    if v_charge.status in ('draft', 'cancelled', 'reversed') then
      raise exception 'A draft, cancelled or reversed charge cannot be invoiced.'
        using errcode = '23514';
    end if;

    select coalesce(v_charge.family_id, s.family_id)
      into v_charge_family_id
    from public.students s
    where s.id = v_charge.student_id;

    if v_charge.student_id is null then
      v_charge_family_id := v_charge.family_id;
    end if;

    if v_charge_family_id is not null and v_charge_family_id <> v_invoice.family_id then
      raise exception 'The selected charge belongs to a different family.'
        using errcode = '23514';
    end if;

    new.student_id := coalesce(new.student_id, v_charge.student_id);
  end if;

  return new;
end;
$$;

create or replace function public.after_invoice_item_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_invoice_id uuid;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  perform public.refresh_invoice_totals(v_invoice_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- =========================================================
-- EXPENSE PAYMENT HELPERS
-- =========================================================

create or replace function public.expense_paid_amount(p_expense_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(ep.amount), 0)::numeric(12,2)
  from public.expense_payments ep
  where ep.expense_id = p_expense_id
    and ep.status = 'confirmed'
    and ep.deleted_at is null;
$$;

create or replace function public.validate_expense_payment()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_expense public.expenses%rowtype;
  v_existing numeric(12,2);
begin
  if new.status = 'reversed' then
    return new;
  end if;

  select * into v_expense
  from public.expenses
  where id = new.expense_id
    and deleted_at is null;

  if not found then
    raise exception 'The selected expense does not exist.' using errcode = '23503';
  end if;

  if v_expense.payment_status in ('proposed', 'cancelled', 'refunded') then
    raise exception 'Payments cannot be added to a proposed, cancelled or refunded expense.'
      using errcode = '23514';
  end if;

  select coalesce(sum(ep.amount), 0)
    into v_existing
  from public.expense_payments ep
  where ep.expense_id = new.expense_id
    and ep.status = 'confirmed'
    and ep.deleted_at is null
    and ep.id <> coalesce(new.id, gen_random_uuid());

  if new.status = 'confirmed' and v_existing + new.amount > v_expense.amount then
    raise exception 'This payment would exceed the outstanding amount of the expense.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_expense_status(p_expense_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_expense public.expenses%rowtype;
  v_paid numeric(12,2);
  v_status text;
begin
  select * into v_expense
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then
    return null;
  end if;

  if v_expense.payment_status in ('proposed', 'cancelled', 'refunded') then
    return v_expense.payment_status;
  end if;

  v_paid := public.expense_paid_amount(p_expense_id);

  if v_paid >= v_expense.amount then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'unpaid';
  end if;

  if v_status is distinct from v_expense.payment_status then
    update public.expenses
       set payment_status = v_status,
           updated_at = now(),
           updated_by = auth.uid()
     where id = p_expense_id;
  end if;

  return v_status;
end;
$$;

create or replace function public.after_expense_payment_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_expense_id uuid;
begin
  v_expense_id := case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  perform public.refresh_expense_status(v_expense_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- =========================================================
-- BANKING AND RECURRING-DATE HELPERS
-- =========================================================

create or replace function public.make_bank_transaction_fingerprint(
  p_account_id uuid,
  p_transaction_date date,
  p_signed_amount numeric,
  p_description text,
  p_reference text default null,
  p_particulars text default null,
  p_code text default null
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        coalesce(p_account_id::text, ''),
        coalesce(to_char(p_transaction_date, 'YYYY-MM-DD'), ''),
        coalesce(round(p_signed_amount, 2)::text, ''),
        lower(regexp_replace(trim(coalesce(p_description, '')), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(coalesce(p_reference, '')), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(coalesce(p_particulars, '')), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(coalesce(p_code, '')), '\s+', ' ', 'g'))
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.next_recurring_due_date(p_current_date date, p_frequency text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_current_date is null then
    return null;
  end if;

  case lower(trim(p_frequency))
    when 'weekly' then return p_current_date + 7;
    when 'fortnightly' then return p_current_date + 14;
    when 'monthly' then return (p_current_date + interval '1 month')::date;
    when 'quarterly' then return (p_current_date + interval '3 months')::date;
    when 'yearly' then return (p_current_date + interval '1 year')::date;
    when 'one_time' then return null;
    else
      raise exception 'Unsupported recurring frequency: %', p_frequency
        using errcode = '22023';
  end case;
end;
$$;

-- =========================================================
-- RESTRICT DIRECT EXECUTION UNTIL RLS AND HARDENING ARE APPLIED
-- 04-rls-policies.sql and 05-hardening.sql will grant only the
-- required functions to the appropriate browser roles.
-- =========================================================

revoke all on function public.sync_current_user_profile() from public, anon, authenticated;
revoke all on function public.assert_current_user_permission(text) from public, anon, authenticated;
revoke all on function public.write_audit_event(text, text, uuid, text, jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke all on function public.next_document_number(text, text, date) from public, anon, authenticated;
revoke all on function public.next_student_number() from public, anon, authenticated;
revoke all on function public.next_invoice_number(date) from public, anon, authenticated;
revoke all on function public.next_receipt_number(date) from public, anon, authenticated;
revoke all on function public.next_charge_number(date) from public, anon, authenticated;
revoke all on function public.next_payment_number(date) from public, anon, authenticated;
revoke all on function public.next_expense_number(date) from public, anon, authenticated;
revoke all on function public.next_adjustment_number(date) from public, anon, authenticated;
revoke all on function public.next_refund_number(date) from public, anon, authenticated;
revoke all on function public.refresh_charge_status(uuid) from public, anon, authenticated;
revoke all on function public.refresh_invoice_totals(uuid) from public, anon, authenticated;
revoke all on function public.refresh_invoices_for_charge(uuid) from public, anon, authenticated;
revoke all on function public.refresh_expense_status(uuid) from public, anon, authenticated;

commit;
