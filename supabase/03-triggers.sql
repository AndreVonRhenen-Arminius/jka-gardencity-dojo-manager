-- JKA GardenCity Dojo Manager
-- File: 03-triggers.sql
-- Schema version: 0.2.1
-- Purpose: Attach metadata, audit, recycle-bin, validation and financial-history triggers.
-- Important: Run only after 01-schema.sql and 02-functions.sql in the separate dojo Supabase project.

begin;

-- =========================================================
-- SUPPLEMENTAL TRIGGER HELPERS
-- =========================================================

create or replace function public.set_partial_row_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at, now());
    new.updated_by := coalesce(new.updated_by, auth.uid());
    new.record_version := coalesce(new.record_version, 1);
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

create or replace function public.set_created_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  new.created_at := coalesce(new.created_at, now());
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.set_soft_delete_actor()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  elsif old.deleted_at is not null and new.deleted_at is null then
    new.deleted_by := null;
  end if;
  return new;
end;
$$;

create or replace function public.set_document_sequence_metadata()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  return new;
end;
$$;

create or replace function public.set_authorised_user_actor_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.authorised_at := coalesce(new.authorised_at, now());
    new.authorised_by := coalesce(new.authorised_by, auth.uid());

    if new.revoked_at is not null then
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
      new.is_active := false;
    end if;
  else
    if new.revoked_at is not null and old.revoked_at is null then
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
      new.is_active := false;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_role_assignment_actor_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.assigned_at := coalesce(new.assigned_at, now());
    new.assigned_by := coalesce(new.assigned_by, auth.uid());
  end if;

  if tg_op = 'UPDATE' then
    if new.removed_at is not null and old.removed_at is null then
      new.removed_by := coalesce(new.removed_by, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_registered_device_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := coalesce(new.user_id, auth.uid());
    new.first_seen_at := coalesce(new.first_seen_at, now());
    new.last_seen_at := coalesce(new.last_seen_at, new.first_seen_at, now());
  else
    new.user_id := old.user_id;
    new.first_seen_at := old.first_seen_at;
    new.last_seen_at := now();
    if new.revoked_at is not null and old.revoked_at is null then
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_bank_match_actor_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.matched_at := coalesce(new.matched_at, now());
    new.matched_by := coalesce(new.matched_by, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.set_reconciliation_item_actor_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'reconciled' then
      new.reconciled_at := coalesce(new.reconciled_at, now());
      new.reconciled_by := coalesce(new.reconciled_by, auth.uid());
    end if;
  else
    if new.status = 'reconciled' and old.status is distinct from 'reconciled' then
      new.reconciled_at := coalesce(new.reconciled_at, now());
      new.reconciled_by := coalesce(new.reconciled_by, auth.uid());
    elsif old.status = 'reconciled' and new.status <> 'reconciled' then
      new.reconciled_at := null;
      new.reconciled_by := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_sync_conflict_actor_fields()
returns trigger
language plpgsql
volatile
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.detected_at := coalesce(new.detected_at, now());
    new.detected_by := coalesce(new.detected_by, auth.uid());

    if new.status <> 'open' then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by := coalesce(new.resolved_by, auth.uid());
    end if;
  else
    if new.status <> 'open' and old.status = 'open' then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by := coalesce(new.resolved_by, auth.uid());
    elsif old.status <> 'open' and new.status = 'open' then
      new.resolved_at := null;
      new.resolved_by := null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.after_payment_status_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_charge_id uuid;
begin
  if tg_op = 'UPDATE'
     and new.payment_status is distinct from old.payment_status then
    for v_charge_id in
      select distinct pa.charge_id
      from public.payment_allocations pa
      where pa.payment_id = new.id
    loop
      perform public.refresh_charge_status(v_charge_id);
      perform public.refresh_invoices_for_charge(v_charge_id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.after_financial_adjustment_change()
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

  if v_charge_id is not null then
    perform public.refresh_charge_status(v_charge_id);
    perform public.refresh_invoices_for_charge(v_charge_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Replace the audit helper with a privacy-aware version.
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
  v_sensitive_keys text[] := array[
    'email', 'mobile_number', 'phone_number', 'alternate_phone_number',
    'phone', 'address_line_1', 'address_line_2', 'suburb', 'postcode',
    'date_of_birth', 'jka_membership_number', 'jka_passport_number',
    'allergies', 'relevant_medical_conditions', 'medication_information',
    'injuries', 'physical_limitations', 'guardian_safety_instructions',
    'important_safety_notes', 'safety_instruction'
  ];
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
  else
    if v_old is not null then
      v_old := v_old - v_sensitive_keys;
    end if;
    if v_new is not null then
      v_new := v_new - v_sensitive_keys;
    end if;
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

-- =========================================================
-- COMMON METADATA TRIGGERS
-- =========================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_settings',
    'families', 'guardians', 'students', 'student_notes',
    'student_emergency_contacts', 'student_medical_information', 'student_safety_alerts',
    'enquiries', 'follow_up_tasks',
    'terms', 'term_calendar_exceptions', 'term_enrolments', 'dojo_events',
    'training_sessions', 'attendance_records',
    'grading_events', 'grading_records', 'student_progress', 'student_goals',
    'fee_schedules', 'fee_schedule_items', 'student_billing_profiles',
    'student_discounts', 'referral_reward_rules', 'referral_reward_awards',
    'charge_batch_items', 'charges', 'payments', 'payment_allocations',
    'financial_adjustments', 'refunds',
    'invoices',
    'suppliers', 'financial_accounts', 'expenses', 'expense_payments',
    'recurring_expenses', 'expense_occurrences',
    'bank_column_mappings', 'bank_transactions', 'matching_rules',
    'account_transfers', 'bank_reconciliations',
    'communication_history'
  ]
  loop
    execute format('drop trigger if exists trg_90_set_row_metadata on public.%I', v_table);
    execute format(
      'create trigger trg_90_set_row_metadata before insert or update on public.%I for each row execute function public.set_row_metadata()',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'roles', 'belt_ranks', 'expense_categories', 'authorised_users'
  ]
  loop
    execute format('drop trigger if exists trg_90_set_reference_metadata on public.%I', v_table);
    execute format(
      'create trigger trg_90_set_reference_metadata before insert or update on public.%I for each row execute function public.set_reference_row_metadata()',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['charge_batches', 'bank_import_batches']
  loop
    execute format('drop trigger if exists trg_90_set_partial_metadata on public.%I', v_table);
    execute format(
      'create trigger trg_90_set_partial_metadata before insert or update on public.%I for each row execute function public.set_partial_row_metadata()',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'guardian_families', 'student_guardians', 'invoice_items', 'backup_history'
  ]
  loop
    execute format('drop trigger if exists trg_90_set_created_metadata on public.%I', v_table);
    execute format(
      'create trigger trg_90_set_created_metadata before insert on public.%I for each row execute function public.set_created_metadata()',
      v_table
    );
  end loop;
end;
$$;

-- =========================================================
-- ACTOR AND LIFECYCLE TRIGGERS
-- =========================================================

drop trigger if exists trg_20_authorised_user_actor on public.authorised_users;
create trigger trg_20_authorised_user_actor
before insert or update on public.authorised_users
for each row execute function public.set_authorised_user_actor_fields();

drop trigger if exists trg_20_role_assignment_actor on public.user_role_assignments;
create trigger trg_20_role_assignment_actor
before insert or update on public.user_role_assignments
for each row execute function public.set_role_assignment_actor_fields();

drop trigger if exists trg_20_registered_device_fields on public.registered_devices;
create trigger trg_20_registered_device_fields
before insert or update on public.registered_devices
for each row execute function public.set_registered_device_fields();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'bank_payment_matches', 'bank_expense_matches', 'bank_transfer_matches'
  ]
  loop
    execute format('drop trigger if exists trg_20_bank_match_actor on public.%I', v_table);
    execute format(
      'create trigger trg_20_bank_match_actor before insert on public.%I for each row execute function public.set_bank_match_actor_fields()',
      v_table
    );
  end loop;
end;
$$;

drop trigger if exists trg_20_reconciliation_item_actor on public.reconciliation_items;
create trigger trg_20_reconciliation_item_actor
before insert or update on public.reconciliation_items
for each row execute function public.set_reconciliation_item_actor_fields();

drop trigger if exists trg_20_sync_conflict_actor on public.sync_conflicts;
create trigger trg_20_sync_conflict_actor
before insert or update on public.sync_conflicts
for each row execute function public.set_sync_conflict_actor_fields();

drop trigger if exists trg_90_document_sequence_metadata on public.document_number_sequences;
create trigger trg_90_document_sequence_metadata
before update on public.document_number_sequences
for each row execute function public.set_document_sequence_metadata();

drop trigger if exists trg_90_checkpoint_updated_at on public.device_sync_checkpoints;
create trigger trg_90_checkpoint_updated_at
before update on public.device_sync_checkpoints
for each row execute function public.set_checkpoint_updated_at();

-- =========================================================
-- SOFT DELETE AND RECYCLE BIN
-- =========================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_settings',
    'families', 'guardians', 'students', 'student_notes',
    'student_emergency_contacts', 'student_medical_information', 'student_safety_alerts',
    'enquiries', 'follow_up_tasks',
    'terms', 'term_calendar_exceptions', 'term_enrolments', 'dojo_events',
    'training_sessions', 'attendance_records',
    'grading_events', 'grading_records', 'student_progress', 'student_goals',
    'fee_schedules', 'fee_schedule_items', 'student_billing_profiles',
    'student_discounts', 'referral_reward_rules', 'referral_reward_awards',
    'charge_batches', 'charge_batch_items', 'charges', 'payments',
    'payment_allocations', 'financial_adjustments', 'refunds', 'invoices',
    'suppliers', 'financial_accounts', 'expenses', 'expense_payments',
    'recurring_expenses', 'expense_occurrences',
    'bank_column_mappings', 'bank_import_batches', 'bank_transactions',
    'matching_rules', 'account_transfers', 'bank_reconciliations',
    'communication_history'
  ]
  loop
    execute format('drop trigger if exists trg_80_set_soft_delete_actor on public.%I', v_table);
    execute format(
      'create trigger trg_80_set_soft_delete_actor before update of deleted_at on public.%I for each row execute function public.set_soft_delete_actor()',
      v_table
    );

    execute format('drop trigger if exists trg_80_maintain_deleted_index on public.%I', v_table);
    execute format(
      'create trigger trg_80_maintain_deleted_index after update of deleted_at on public.%I for each row when (old.deleted_at is distinct from new.deleted_at) execute function public.maintain_deleted_record_index()',
      v_table
    );
  end loop;
end;
$$;

-- =========================================================
-- FINANCIAL HISTORY GUARDS
-- =========================================================

drop trigger if exists trg_10_guard_fee_schedule_history on public.fee_schedules;
create trigger trg_10_guard_fee_schedule_history
before update or delete on public.fee_schedules
for each row execute function public.guard_fee_schedule_history();

drop trigger if exists trg_10_guard_fee_schedule_item_history on public.fee_schedule_items;
create trigger trg_10_guard_fee_schedule_item_history
before update or delete on public.fee_schedule_items
for each row execute function public.guard_fee_schedule_item_history();

drop trigger if exists trg_10_guard_confirmed_charge_history on public.charges;
create trigger trg_10_guard_confirmed_charge_history
before update or delete on public.charges
for each row execute function public.guard_confirmed_charge_history();

drop trigger if exists trg_10_guard_confirmed_payment_history on public.payments;
create trigger trg_10_guard_confirmed_payment_history
before update or delete on public.payments
for each row execute function public.guard_confirmed_payment_history();

drop trigger if exists trg_10_guard_payment_allocation_history on public.payment_allocations;
create trigger trg_10_guard_payment_allocation_history
before update or delete on public.payment_allocations
for each row execute function public.guard_payment_allocation_history();

drop trigger if exists trg_10_guard_issued_invoice_history on public.invoices;
create trigger trg_10_guard_issued_invoice_history
before update or delete on public.invoices
for each row execute function public.guard_issued_invoice_history();

drop trigger if exists trg_10_guard_invoice_item_history on public.invoice_items;
create trigger trg_10_guard_invoice_item_history
before update or delete on public.invoice_items
for each row execute function public.guard_invoice_item_history();

-- =========================================================
-- PAYMENT, INVOICE AND EXPENSE VALIDATION
-- =========================================================

drop trigger if exists trg_20_validate_payment_allocation on public.payment_allocations;
create trigger trg_20_validate_payment_allocation
before insert or update on public.payment_allocations
for each row execute function public.validate_payment_allocation();

drop trigger if exists trg_20_after_payment_allocation_change on public.payment_allocations;
create trigger trg_20_after_payment_allocation_change
after insert or update or delete on public.payment_allocations
for each row execute function public.after_payment_allocation_change();

drop trigger if exists trg_20_after_payment_status_change on public.payments;
create trigger trg_20_after_payment_status_change
after update of payment_status on public.payments
for each row execute function public.after_payment_status_change();

drop trigger if exists trg_20_validate_invoice_item on public.invoice_items;
create trigger trg_20_validate_invoice_item
before insert or update on public.invoice_items
for each row execute function public.validate_invoice_item();

drop trigger if exists trg_20_after_invoice_item_change on public.invoice_items;
create trigger trg_20_after_invoice_item_change
after insert or update or delete on public.invoice_items
for each row execute function public.after_invoice_item_change();

drop trigger if exists trg_20_validate_expense_payment on public.expense_payments;
create trigger trg_20_validate_expense_payment
before insert or update on public.expense_payments
for each row execute function public.validate_expense_payment();

drop trigger if exists trg_20_after_expense_payment_change on public.expense_payments;
create trigger trg_20_after_expense_payment_change
after insert or update or delete on public.expense_payments
for each row execute function public.after_expense_payment_change();

drop trigger if exists trg_20_after_financial_adjustment_change on public.financial_adjustments;
create trigger trg_20_after_financial_adjustment_change
after insert or update or delete on public.financial_adjustments
for each row execute function public.after_financial_adjustment_change();

-- =========================================================
-- AUDIT TRIGGERS
-- Deliberately excludes audit_events, deleted_record_index,
-- device_sync_checkpoints and document_number_sequences.
-- =========================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_settings', 'authorised_users', 'user_role_assignments', 'registered_devices',
    'families', 'guardians', 'guardian_families', 'students', 'student_guardians',
    'student_notes', 'student_emergency_contacts', 'student_medical_information',
    'student_safety_alerts',
    'enquiries', 'follow_up_tasks',
    'terms', 'term_calendar_exceptions', 'term_enrolments', 'dojo_events',
    'training_sessions', 'attendance_records',
    'belt_ranks', 'grading_events', 'grading_records', 'student_progress', 'student_goals',
    'fee_schedules', 'fee_schedule_items', 'student_billing_profiles',
    'student_discounts', 'referral_reward_rules', 'referral_reward_awards',
    'charge_batches', 'charge_batch_items', 'charges', 'payments',
    'payment_allocations', 'financial_adjustments', 'refunds',
    'invoices', 'invoice_items',
    'expense_categories', 'suppliers', 'financial_accounts', 'expenses',
    'expense_payments', 'recurring_expenses', 'expense_occurrences',
    'bank_column_mappings', 'bank_import_batches', 'bank_transactions',
    'matching_rules', 'bank_payment_matches', 'bank_expense_matches',
    'account_transfers', 'bank_transfer_matches', 'bank_reconciliations',
    'reconciliation_items',
    'communication_history', 'backup_history', 'sync_conflicts'
  ]
  loop
    execute format('drop trigger if exists trg_90_audit_row_change on public.%I', v_table);
    execute format(
      'create trigger trg_90_audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      v_table
    );
  end loop;
end;
$$;

-- =========================================================
-- FUNCTION EXECUTION RESTRICTIONS FOR SUPPLEMENTAL HELPERS
-- =========================================================

revoke all on function public.set_partial_row_metadata() from public, anon, authenticated;
revoke all on function public.set_created_metadata() from public, anon, authenticated;
revoke all on function public.set_soft_delete_actor() from public, anon, authenticated;
revoke all on function public.set_document_sequence_metadata() from public, anon, authenticated;
revoke all on function public.set_authorised_user_actor_fields() from public, anon, authenticated;
revoke all on function public.set_role_assignment_actor_fields() from public, anon, authenticated;
revoke all on function public.set_registered_device_fields() from public, anon, authenticated;
revoke all on function public.set_bank_match_actor_fields() from public, anon, authenticated;
revoke all on function public.set_reconciliation_item_actor_fields() from public, anon, authenticated;
revoke all on function public.set_sync_conflict_actor_fields() from public, anon, authenticated;
revoke all on function public.after_payment_status_change() from public, anon, authenticated;
revoke all on function public.after_financial_adjustment_change() from public, anon, authenticated;

insert into public.schema_versions (version, description)
values ('0.2.1-triggers', 'JKA GardenCity Dojo Manager trigger layer')
on conflict (version) do nothing;

commit;
