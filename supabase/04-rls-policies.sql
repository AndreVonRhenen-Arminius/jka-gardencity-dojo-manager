-- JKA GardenCity Dojo Manager
-- File: 04-rls-policies.sql
-- Schema version: 0.2.2
-- Purpose: Enable Row Level Security and create default-deny access policies.
-- Important: Run only after 01-schema.sql, 02-functions.sql and 03-triggers.sql.

begin;

-- =========================================================
-- ENABLE ROW LEVEL SECURITY ON EVERY APPLICATION TABLE
-- =========================================================

alter table public.schema_versions enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.authorised_users enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.registered_devices enable row level security;
alter table public.audit_events enable row level security;
alter table public.deleted_record_index enable row level security;
alter table public.families enable row level security;
alter table public.guardians enable row level security;
alter table public.guardian_families enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_notes enable row level security;
alter table public.student_emergency_contacts enable row level security;
alter table public.student_medical_information enable row level security;
alter table public.student_safety_alerts enable row level security;
alter table public.enquiries enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.terms enable row level security;
alter table public.term_calendar_exceptions enable row level security;
alter table public.term_enrolments enable row level security;
alter table public.dojo_events enable row level security;
alter table public.training_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.belt_ranks enable row level security;
alter table public.grading_events enable row level security;
alter table public.grading_records enable row level security;
alter table public.student_progress enable row level security;
alter table public.student_goals enable row level security;
alter table public.fee_schedules enable row level security;
alter table public.fee_schedule_items enable row level security;
alter table public.student_billing_profiles enable row level security;
alter table public.student_discounts enable row level security;
alter table public.referral_reward_rules enable row level security;
alter table public.referral_reward_awards enable row level security;
alter table public.charge_batches enable row level security;
alter table public.charge_batch_items enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.financial_adjustments enable row level security;
alter table public.refunds enable row level security;
alter table public.document_number_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expense_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payments enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expense_occurrences enable row level security;
alter table public.bank_column_mappings enable row level security;
alter table public.bank_import_batches enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.matching_rules enable row level security;
alter table public.bank_payment_matches enable row level security;
alter table public.bank_expense_matches enable row level security;
alter table public.account_transfers enable row level security;
alter table public.bank_transfer_matches enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.reconciliation_items enable row level security;
alter table public.communication_history enable row level security;
alter table public.backup_history enable row level security;
alter table public.sync_conflicts enable row level security;
alter table public.device_sync_checkpoints enable row level security;

-- =========================================================
-- REMOVE PREVIOUS POLICY VERSIONS SO THIS FILE IS RERUNNABLE
-- =========================================================

drop policy if exists rls_schema_versions_sel on public.schema_versions;
drop policy if exists rls_app_settings_sel on public.app_settings;
drop policy if exists rls_app_settings_deleted_sel on public.app_settings;
drop policy if exists rls_app_settings_ins on public.app_settings;
drop policy if exists rls_app_settings_upd on public.app_settings;
drop policy if exists rls_app_settings_restore on public.app_settings;
drop policy if exists rls_profiles_sel on public.profiles;
drop policy if exists rls_profiles_upd on public.profiles;
drop policy if exists rls_roles_sel on public.roles;
drop policy if exists rls_permissions_sel on public.permissions;
drop policy if exists rls_role_permissions_sel on public.role_permissions;
drop policy if exists rls_authorised_users_sel on public.authorised_users;
drop policy if exists rls_authorised_users_ins on public.authorised_users;
drop policy if exists rls_authorised_users_upd on public.authorised_users;
drop policy if exists rls_user_roles_sel on public.user_role_assignments;
drop policy if exists rls_user_roles_ins on public.user_role_assignments;
drop policy if exists rls_user_roles_upd on public.user_role_assignments;
drop policy if exists rls_devices_sel on public.registered_devices;
drop policy if exists rls_devices_ins on public.registered_devices;
drop policy if exists rls_devices_upd on public.registered_devices;
drop policy if exists rls_audit_events_sel on public.audit_events;
drop policy if exists rls_deleted_index_sel on public.deleted_record_index;
drop policy if exists rls_deleted_index_upd on public.deleted_record_index;
drop policy if exists rls_belt_ranks_sel on public.belt_ranks;
drop policy if exists rls_belt_ranks_ins on public.belt_ranks;
drop policy if exists rls_belt_ranks_upd on public.belt_ranks;
drop policy if exists rls_doc_sequences_sel on public.document_number_sequences;
drop policy if exists rls_backup_history_sel on public.backup_history;
drop policy if exists rls_backup_history_ins on public.backup_history;
drop policy if exists rls_backup_history_upd on public.backup_history;
drop policy if exists rls_sync_conflicts_sel on public.sync_conflicts;
drop policy if exists rls_sync_conflicts_ins on public.sync_conflicts;
drop policy if exists rls_sync_conflicts_upd on public.sync_conflicts;
drop policy if exists rls_sync_checkpoints_sel on public.device_sync_checkpoints;
drop policy if exists rls_sync_checkpoints_ins on public.device_sync_checkpoints;
drop policy if exists rls_sync_checkpoints_upd on public.device_sync_checkpoints;
drop policy if exists rls_sync_checkpoints_del on public.device_sync_checkpoints;
drop policy if exists rls_families_active_sel on public.families;
drop policy if exists rls_families_deleted_sel on public.families;
drop policy if exists rls_families_ins on public.families;
drop policy if exists rls_families_upd on public.families;
drop policy if exists rls_families_restore on public.families;
drop policy if exists rls_guardians_active_sel on public.guardians;
drop policy if exists rls_guardians_deleted_sel on public.guardians;
drop policy if exists rls_guardians_ins on public.guardians;
drop policy if exists rls_guardians_upd on public.guardians;
drop policy if exists rls_guardians_restore on public.guardians;
drop policy if exists rls_guardian_families_sel on public.guardian_families;
drop policy if exists rls_guardian_families_ins on public.guardian_families;
drop policy if exists rls_guardian_families_upd on public.guardian_families;
drop policy if exists rls_guardian_families_del on public.guardian_families;
drop policy if exists rls_students_active_sel on public.students;
drop policy if exists rls_students_deleted_sel on public.students;
drop policy if exists rls_students_ins on public.students;
drop policy if exists rls_students_upd on public.students;
drop policy if exists rls_students_restore on public.students;
drop policy if exists rls_student_guardians_sel on public.student_guardians;
drop policy if exists rls_student_guardians_ins on public.student_guardians;
drop policy if exists rls_student_guardians_upd on public.student_guardians;
drop policy if exists rls_student_guardians_del on public.student_guardians;
drop policy if exists rls_student_notes_active_sel on public.student_notes;
drop policy if exists rls_student_notes_deleted_sel on public.student_notes;
drop policy if exists rls_student_notes_ins on public.student_notes;
drop policy if exists rls_student_notes_upd on public.student_notes;
drop policy if exists rls_student_notes_restore on public.student_notes;
drop policy if exists rls_student_emergency_contacts_active_sel on public.student_emergency_contacts;
drop policy if exists rls_student_emergency_contacts_deleted_sel on public.student_emergency_contacts;
drop policy if exists rls_student_emergency_contacts_ins on public.student_emergency_contacts;
drop policy if exists rls_student_emergency_contacts_upd on public.student_emergency_contacts;
drop policy if exists rls_student_emergency_contacts_restore on public.student_emergency_contacts;
drop policy if exists rls_student_safety_alerts_active_sel on public.student_safety_alerts;
drop policy if exists rls_student_safety_alerts_deleted_sel on public.student_safety_alerts;
drop policy if exists rls_student_safety_alerts_ins on public.student_safety_alerts;
drop policy if exists rls_student_safety_alerts_upd on public.student_safety_alerts;
drop policy if exists rls_student_safety_alerts_restore on public.student_safety_alerts;
drop policy if exists rls_student_medical_information_active_sel on public.student_medical_information;
drop policy if exists rls_student_medical_information_deleted_sel on public.student_medical_information;
drop policy if exists rls_student_medical_information_ins on public.student_medical_information;
drop policy if exists rls_student_medical_information_upd on public.student_medical_information;
drop policy if exists rls_student_medical_information_restore on public.student_medical_information;
drop policy if exists rls_enquiries_active_sel on public.enquiries;
drop policy if exists rls_enquiries_deleted_sel on public.enquiries;
drop policy if exists rls_enquiries_ins on public.enquiries;
drop policy if exists rls_enquiries_upd on public.enquiries;
drop policy if exists rls_enquiries_restore on public.enquiries;
drop policy if exists rls_follow_up_tasks_active_sel on public.follow_up_tasks;
drop policy if exists rls_follow_up_tasks_deleted_sel on public.follow_up_tasks;
drop policy if exists rls_follow_up_tasks_ins on public.follow_up_tasks;
drop policy if exists rls_follow_up_tasks_upd on public.follow_up_tasks;
drop policy if exists rls_follow_up_tasks_restore on public.follow_up_tasks;
drop policy if exists rls_terms_active_sel on public.terms;
drop policy if exists rls_terms_deleted_sel on public.terms;
drop policy if exists rls_terms_ins on public.terms;
drop policy if exists rls_terms_upd on public.terms;
drop policy if exists rls_terms_restore on public.terms;
drop policy if exists rls_term_calendar_exceptions_active_sel on public.term_calendar_exceptions;
drop policy if exists rls_term_calendar_exceptions_deleted_sel on public.term_calendar_exceptions;
drop policy if exists rls_term_calendar_exceptions_ins on public.term_calendar_exceptions;
drop policy if exists rls_term_calendar_exceptions_upd on public.term_calendar_exceptions;
drop policy if exists rls_term_calendar_exceptions_restore on public.term_calendar_exceptions;
drop policy if exists rls_term_enrolments_active_sel on public.term_enrolments;
drop policy if exists rls_term_enrolments_deleted_sel on public.term_enrolments;
drop policy if exists rls_term_enrolments_ins on public.term_enrolments;
drop policy if exists rls_term_enrolments_upd on public.term_enrolments;
drop policy if exists rls_term_enrolments_restore on public.term_enrolments;
drop policy if exists rls_dojo_events_active_sel on public.dojo_events;
drop policy if exists rls_dojo_events_deleted_sel on public.dojo_events;
drop policy if exists rls_dojo_events_ins on public.dojo_events;
drop policy if exists rls_dojo_events_upd on public.dojo_events;
drop policy if exists rls_dojo_events_restore on public.dojo_events;
drop policy if exists rls_training_sessions_active_sel on public.training_sessions;
drop policy if exists rls_training_sessions_deleted_sel on public.training_sessions;
drop policy if exists rls_training_sessions_ins on public.training_sessions;
drop policy if exists rls_training_sessions_upd on public.training_sessions;
drop policy if exists rls_training_sessions_restore on public.training_sessions;
drop policy if exists rls_attendance_records_active_sel on public.attendance_records;
drop policy if exists rls_attendance_records_deleted_sel on public.attendance_records;
drop policy if exists rls_attendance_records_ins on public.attendance_records;
drop policy if exists rls_attendance_records_upd on public.attendance_records;
drop policy if exists rls_attendance_records_restore on public.attendance_records;
drop policy if exists rls_grading_events_active_sel on public.grading_events;
drop policy if exists rls_grading_events_deleted_sel on public.grading_events;
drop policy if exists rls_grading_events_ins on public.grading_events;
drop policy if exists rls_grading_events_upd on public.grading_events;
drop policy if exists rls_grading_events_restore on public.grading_events;
drop policy if exists rls_grading_records_active_sel on public.grading_records;
drop policy if exists rls_grading_records_deleted_sel on public.grading_records;
drop policy if exists rls_grading_records_ins on public.grading_records;
drop policy if exists rls_grading_records_upd on public.grading_records;
drop policy if exists rls_grading_records_restore on public.grading_records;
drop policy if exists rls_student_progress_active_sel on public.student_progress;
drop policy if exists rls_student_progress_deleted_sel on public.student_progress;
drop policy if exists rls_student_progress_ins on public.student_progress;
drop policy if exists rls_student_progress_upd on public.student_progress;
drop policy if exists rls_student_progress_restore on public.student_progress;
drop policy if exists rls_student_goals_active_sel on public.student_goals;
drop policy if exists rls_student_goals_deleted_sel on public.student_goals;
drop policy if exists rls_student_goals_ins on public.student_goals;
drop policy if exists rls_student_goals_upd on public.student_goals;
drop policy if exists rls_student_goals_restore on public.student_goals;
drop policy if exists rls_fee_schedules_active_sel on public.fee_schedules;
drop policy if exists rls_fee_schedules_deleted_sel on public.fee_schedules;
drop policy if exists rls_fee_schedules_ins on public.fee_schedules;
drop policy if exists rls_fee_schedules_upd on public.fee_schedules;
drop policy if exists rls_fee_schedules_restore on public.fee_schedules;
drop policy if exists rls_fee_schedule_items_active_sel on public.fee_schedule_items;
drop policy if exists rls_fee_schedule_items_deleted_sel on public.fee_schedule_items;
drop policy if exists rls_fee_schedule_items_ins on public.fee_schedule_items;
drop policy if exists rls_fee_schedule_items_upd on public.fee_schedule_items;
drop policy if exists rls_fee_schedule_items_restore on public.fee_schedule_items;
drop policy if exists rls_student_billing_profiles_active_sel on public.student_billing_profiles;
drop policy if exists rls_student_billing_profiles_deleted_sel on public.student_billing_profiles;
drop policy if exists rls_student_billing_profiles_ins on public.student_billing_profiles;
drop policy if exists rls_student_billing_profiles_upd on public.student_billing_profiles;
drop policy if exists rls_student_billing_profiles_restore on public.student_billing_profiles;
drop policy if exists rls_student_discounts_active_sel on public.student_discounts;
drop policy if exists rls_student_discounts_deleted_sel on public.student_discounts;
drop policy if exists rls_student_discounts_ins on public.student_discounts;
drop policy if exists rls_student_discounts_upd on public.student_discounts;
drop policy if exists rls_student_discounts_restore on public.student_discounts;
drop policy if exists rls_referral_reward_rules_active_sel on public.referral_reward_rules;
drop policy if exists rls_referral_reward_rules_deleted_sel on public.referral_reward_rules;
drop policy if exists rls_referral_reward_rules_ins on public.referral_reward_rules;
drop policy if exists rls_referral_reward_rules_upd on public.referral_reward_rules;
drop policy if exists rls_referral_reward_rules_restore on public.referral_reward_rules;
drop policy if exists rls_referral_reward_awards_active_sel on public.referral_reward_awards;
drop policy if exists rls_referral_reward_awards_deleted_sel on public.referral_reward_awards;
drop policy if exists rls_referral_reward_awards_ins on public.referral_reward_awards;
drop policy if exists rls_referral_reward_awards_upd on public.referral_reward_awards;
drop policy if exists rls_referral_reward_awards_restore on public.referral_reward_awards;
drop policy if exists rls_charge_batches_active_sel on public.charge_batches;
drop policy if exists rls_charge_batches_deleted_sel on public.charge_batches;
drop policy if exists rls_charge_batches_ins on public.charge_batches;
drop policy if exists rls_charge_batches_upd on public.charge_batches;
drop policy if exists rls_charge_batches_restore on public.charge_batches;
drop policy if exists rls_charge_batch_items_active_sel on public.charge_batch_items;
drop policy if exists rls_charge_batch_items_deleted_sel on public.charge_batch_items;
drop policy if exists rls_charge_batch_items_ins on public.charge_batch_items;
drop policy if exists rls_charge_batch_items_upd on public.charge_batch_items;
drop policy if exists rls_charge_batch_items_restore on public.charge_batch_items;
drop policy if exists rls_charges_active_sel on public.charges;
drop policy if exists rls_charges_deleted_sel on public.charges;
drop policy if exists rls_charges_ins on public.charges;
drop policy if exists rls_charges_upd on public.charges;
drop policy if exists rls_charges_restore on public.charges;
drop policy if exists rls_payments_active_sel on public.payments;
drop policy if exists rls_payments_deleted_sel on public.payments;
drop policy if exists rls_payments_ins on public.payments;
drop policy if exists rls_payments_upd on public.payments;
drop policy if exists rls_payments_restore on public.payments;
drop policy if exists rls_payment_allocations_active_sel on public.payment_allocations;
drop policy if exists rls_payment_allocations_deleted_sel on public.payment_allocations;
drop policy if exists rls_payment_allocations_ins on public.payment_allocations;
drop policy if exists rls_payment_allocations_upd on public.payment_allocations;
drop policy if exists rls_payment_allocations_restore on public.payment_allocations;
drop policy if exists rls_financial_adjustments_active_sel on public.financial_adjustments;
drop policy if exists rls_financial_adjustments_deleted_sel on public.financial_adjustments;
drop policy if exists rls_financial_adjustments_ins on public.financial_adjustments;
drop policy if exists rls_financial_adjustments_upd on public.financial_adjustments;
drop policy if exists rls_financial_adjustments_restore on public.financial_adjustments;
drop policy if exists rls_refunds_active_sel on public.refunds;
drop policy if exists rls_refunds_deleted_sel on public.refunds;
drop policy if exists rls_refunds_ins on public.refunds;
drop policy if exists rls_refunds_upd on public.refunds;
drop policy if exists rls_refunds_restore on public.refunds;
drop policy if exists rls_invoices_active_sel on public.invoices;
drop policy if exists rls_invoices_deleted_sel on public.invoices;
drop policy if exists rls_invoices_ins on public.invoices;
drop policy if exists rls_invoices_upd on public.invoices;
drop policy if exists rls_invoices_restore on public.invoices;
drop policy if exists rls_invoice_items_sel on public.invoice_items;
drop policy if exists rls_invoice_items_ins on public.invoice_items;
drop policy if exists rls_invoice_items_upd on public.invoice_items;
drop policy if exists rls_invoice_items_del on public.invoice_items;
drop policy if exists rls_expense_categories_sel on public.expense_categories;
drop policy if exists rls_expense_categories_ins on public.expense_categories;
drop policy if exists rls_expense_categories_upd on public.expense_categories;
drop policy if exists rls_suppliers_active_sel on public.suppliers;
drop policy if exists rls_suppliers_deleted_sel on public.suppliers;
drop policy if exists rls_suppliers_ins on public.suppliers;
drop policy if exists rls_suppliers_upd on public.suppliers;
drop policy if exists rls_suppliers_restore on public.suppliers;
drop policy if exists rls_expenses_active_sel on public.expenses;
drop policy if exists rls_expenses_deleted_sel on public.expenses;
drop policy if exists rls_expenses_ins on public.expenses;
drop policy if exists rls_expenses_upd on public.expenses;
drop policy if exists rls_expenses_restore on public.expenses;
drop policy if exists rls_expense_payments_active_sel on public.expense_payments;
drop policy if exists rls_expense_payments_deleted_sel on public.expense_payments;
drop policy if exists rls_expense_payments_ins on public.expense_payments;
drop policy if exists rls_expense_payments_upd on public.expense_payments;
drop policy if exists rls_expense_payments_restore on public.expense_payments;
drop policy if exists rls_recurring_expenses_active_sel on public.recurring_expenses;
drop policy if exists rls_recurring_expenses_deleted_sel on public.recurring_expenses;
drop policy if exists rls_recurring_expenses_ins on public.recurring_expenses;
drop policy if exists rls_recurring_expenses_upd on public.recurring_expenses;
drop policy if exists rls_recurring_expenses_restore on public.recurring_expenses;
drop policy if exists rls_expense_occurrences_active_sel on public.expense_occurrences;
drop policy if exists rls_expense_occurrences_deleted_sel on public.expense_occurrences;
drop policy if exists rls_expense_occurrences_ins on public.expense_occurrences;
drop policy if exists rls_expense_occurrences_upd on public.expense_occurrences;
drop policy if exists rls_expense_occurrences_restore on public.expense_occurrences;
drop policy if exists rls_financial_accounts_active_sel on public.financial_accounts;
drop policy if exists rls_financial_accounts_deleted_sel on public.financial_accounts;
drop policy if exists rls_financial_accounts_ins on public.financial_accounts;
drop policy if exists rls_financial_accounts_upd on public.financial_accounts;
drop policy if exists rls_financial_accounts_restore on public.financial_accounts;
drop policy if exists rls_bank_column_mappings_active_sel on public.bank_column_mappings;
drop policy if exists rls_bank_column_mappings_deleted_sel on public.bank_column_mappings;
drop policy if exists rls_bank_column_mappings_ins on public.bank_column_mappings;
drop policy if exists rls_bank_column_mappings_upd on public.bank_column_mappings;
drop policy if exists rls_bank_column_mappings_restore on public.bank_column_mappings;
drop policy if exists rls_bank_import_batches_active_sel on public.bank_import_batches;
drop policy if exists rls_bank_import_batches_deleted_sel on public.bank_import_batches;
drop policy if exists rls_bank_import_batches_ins on public.bank_import_batches;
drop policy if exists rls_bank_import_batches_upd on public.bank_import_batches;
drop policy if exists rls_bank_import_batches_restore on public.bank_import_batches;
drop policy if exists rls_bank_transactions_active_sel on public.bank_transactions;
drop policy if exists rls_bank_transactions_deleted_sel on public.bank_transactions;
drop policy if exists rls_bank_transactions_ins on public.bank_transactions;
drop policy if exists rls_bank_transactions_upd on public.bank_transactions;
drop policy if exists rls_bank_transactions_restore on public.bank_transactions;
drop policy if exists rls_matching_rules_active_sel on public.matching_rules;
drop policy if exists rls_matching_rules_deleted_sel on public.matching_rules;
drop policy if exists rls_matching_rules_ins on public.matching_rules;
drop policy if exists rls_matching_rules_upd on public.matching_rules;
drop policy if exists rls_matching_rules_restore on public.matching_rules;
drop policy if exists rls_bank_payment_matches_sel on public.bank_payment_matches;
drop policy if exists rls_bank_payment_matches_ins on public.bank_payment_matches;
drop policy if exists rls_bank_payment_matches_upd on public.bank_payment_matches;
drop policy if exists rls_bank_expense_matches_sel on public.bank_expense_matches;
drop policy if exists rls_bank_expense_matches_ins on public.bank_expense_matches;
drop policy if exists rls_bank_expense_matches_upd on public.bank_expense_matches;
drop policy if exists rls_account_transfers_active_sel on public.account_transfers;
drop policy if exists rls_account_transfers_deleted_sel on public.account_transfers;
drop policy if exists rls_account_transfers_ins on public.account_transfers;
drop policy if exists rls_account_transfers_upd on public.account_transfers;
drop policy if exists rls_account_transfers_restore on public.account_transfers;
drop policy if exists rls_bank_transfer_matches_sel on public.bank_transfer_matches;
drop policy if exists rls_bank_transfer_matches_ins on public.bank_transfer_matches;
drop policy if exists rls_bank_transfer_matches_upd on public.bank_transfer_matches;
drop policy if exists rls_bank_reconciliations_active_sel on public.bank_reconciliations;
drop policy if exists rls_bank_reconciliations_deleted_sel on public.bank_reconciliations;
drop policy if exists rls_bank_reconciliations_ins on public.bank_reconciliations;
drop policy if exists rls_bank_reconciliations_upd on public.bank_reconciliations;
drop policy if exists rls_bank_reconciliations_restore on public.bank_reconciliations;
drop policy if exists rls_reconciliation_items_sel on public.reconciliation_items;
drop policy if exists rls_reconciliation_items_ins on public.reconciliation_items;
drop policy if exists rls_reconciliation_items_upd on public.reconciliation_items;
drop policy if exists rls_communication_history_active_sel on public.communication_history;
drop policy if exists rls_communication_history_deleted_sel on public.communication_history;
drop policy if exists rls_communication_history_ins on public.communication_history;
drop policy if exists rls_communication_history_upd on public.communication_history;
drop policy if exists rls_communication_history_restore on public.communication_history;

-- =========================================================
-- CREATE SECURITY POLICIES
-- =========================================================

create policy rls_schema_versions_sel
on public.schema_versions
for select
to authenticated
using (
  public.is_current_user_authorised()
)
;

create policy rls_app_settings_sel
on public.app_settings
for select
to authenticated
using (
  public.is_current_user_authorised()
      and deleted_at is null
      and (
        is_sensitive = false
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('settings.manage')
      )
)
;

create policy rls_app_settings_deleted_sel
on public.app_settings
for select
to authenticated
using (
  public.is_current_user_authorised()
      and deleted_at is not null
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_app_settings_ins
on public.app_settings
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('settings.manage')
      )
)
;

create policy rls_app_settings_upd
on public.app_settings
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('settings.manage')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('settings.manage')
      )
)
;

create policy rls_app_settings_restore
on public.app_settings
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_profiles_sel
on public.profiles
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_profiles_upd
on public.profiles
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_roles_sel
on public.roles
for select
to authenticated
using (
  public.is_current_user_authorised()
)
;

create policy rls_permissions_sel
on public.permissions
for select
to authenticated
using (
  public.is_current_user_authorised()
)
;

create policy rls_role_permissions_sel
on public.role_permissions
for select
to authenticated
using (
  public.is_current_user_authorised()
)
;

create policy rls_authorised_users_sel
on public.authorised_users
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        id = public.current_authorised_user_id()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_authorised_users_ins
on public.authorised_users
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_authorised_users_upd
on public.authorised_users
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_user_roles_sel
on public.user_role_assignments
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        authorised_user_id = public.current_authorised_user_id()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_user_roles_ins
on public.user_role_assignments
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_user_roles_upd
on public.user_role_assignments
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_devices_sel
on public.registered_devices
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_devices_ins
on public.registered_devices
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_devices_upd
on public.registered_devices
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('access.manage')
      )
)
;

create policy rls_audit_events_sel
on public.audit_events
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('audit.read')
      )
)
;

create policy rls_deleted_index_sel
on public.deleted_record_index
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_deleted_index_upd
on public.deleted_record_index
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_belt_ranks_sel
on public.belt_ranks
for select
to authenticated
using (
  public.is_current_user_authorised()
)
;

create policy rls_belt_ranks_ins
on public.belt_ranks
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('reference.manage')
      )
)
;

create policy rls_belt_ranks_upd
on public.belt_ranks
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('reference.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('reference.manage')
      )
)
;

create policy rls_doc_sequences_sel
on public.document_number_sequences
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('banking.read')
      )
)
;

create policy rls_backup_history_sel
on public.backup_history
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        created_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('backup.manage')
      )
)
;

create policy rls_backup_history_ins
on public.backup_history
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and created_by = auth.uid()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('backup.manage')
      )
)
;

create policy rls_backup_history_upd
on public.backup_history
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        created_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('backup.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        created_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('backup.manage')
      )
)
;

create policy rls_sync_conflicts_sel
on public.sync_conflicts
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        detected_by = auth.uid()
        or resolved_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_sync_conflicts_ins
on public.sync_conflicts
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and detected_by = auth.uid()
)
;

create policy rls_sync_conflicts_upd
on public.sync_conflicts
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        detected_by = auth.uid()
        or resolved_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        detected_by = auth.uid()
        or resolved_by = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_sync_checkpoints_sel
on public.device_sync_checkpoints
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_sync_checkpoints_ins
on public.device_sync_checkpoints
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_sync_checkpoints_upd
on public.device_sync_checkpoints
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_sync_checkpoints_del
on public.device_sync_checkpoints
for delete
to authenticated
using (
  public.is_current_user_authorised()
      and (
        user_id = auth.uid()
        or public.current_user_has_role('administrator')
        or public.current_user_has_permission('sync.manage')
      )
)
;

create policy rls_families_active_sel
on public.families
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.read')
      )) and deleted_at is null
)
;

create policy rls_families_deleted_sel
on public.families
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_families_ins
on public.families
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_families_upd
on public.families
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_families_restore
on public.families
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_guardians_active_sel
on public.guardians
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.read')
      )) and deleted_at is null
)
;

create policy rls_guardians_deleted_sel
on public.guardians
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_guardians_ins
on public.guardians
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_guardians_upd
on public.guardians
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_guardians_restore
on public.guardians
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_guardian_families_sel
on public.guardian_families
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.read')
      )
)
;

create policy rls_guardian_families_ins
on public.guardian_families
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_guardian_families_upd
on public.guardian_families
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_guardian_families_del
on public.guardian_families
for delete
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_students_active_sel
on public.students
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.read')
      )) and deleted_at is null
)
;

create policy rls_students_deleted_sel
on public.students
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_students_ins
on public.students
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_students_upd
on public.students
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_students_restore
on public.students
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_guardians_sel
on public.student_guardians
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.read')
      )
)
;

create policy rls_student_guardians_ins
on public.student_guardians
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_student_guardians_upd
on public.student_guardians
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_student_guardians_del
on public.student_guardians
for delete
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('people.write')
      )
)
;

create policy rls_student_notes_active_sel
on public.student_notes
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('notes.read')
      )) and deleted_at is null
)
;

create policy rls_student_notes_deleted_sel
on public.student_notes
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_notes_ins
on public.student_notes
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('notes.write')
      )
)
;

create policy rls_student_notes_upd
on public.student_notes
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('notes.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('notes.write')
      )
)
;

create policy rls_student_notes_restore
on public.student_notes
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_emergency_contacts_active_sel
on public.student_emergency_contacts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.read')
      )) and deleted_at is null
)
;

create policy rls_student_emergency_contacts_deleted_sel
on public.student_emergency_contacts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_emergency_contacts_ins
on public.student_emergency_contacts
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )
)
;

create policy rls_student_emergency_contacts_upd
on public.student_emergency_contacts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )
)
;

create policy rls_student_emergency_contacts_restore
on public.student_emergency_contacts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_safety_alerts_active_sel
on public.student_safety_alerts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.read')
      )) and deleted_at is null
)
;

create policy rls_student_safety_alerts_deleted_sel
on public.student_safety_alerts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_safety_alerts_ins
on public.student_safety_alerts
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )
)
;

create policy rls_student_safety_alerts_upd
on public.student_safety_alerts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('safety.write')
      )
)
;

create policy rls_student_safety_alerts_restore
on public.student_safety_alerts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_medical_information_active_sel
on public.student_medical_information
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('medical.read')
      )) and deleted_at is null
)
;

create policy rls_student_medical_information_deleted_sel
on public.student_medical_information
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_medical_information_ins
on public.student_medical_information
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('medical.write')
      )
)
;

create policy rls_student_medical_information_upd
on public.student_medical_information
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('medical.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('medical.write')
      )
)
;

create policy rls_student_medical_information_restore
on public.student_medical_information
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_enquiries_active_sel
on public.enquiries
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('enquiries.read')
      )) and deleted_at is null
)
;

create policy rls_enquiries_deleted_sel
on public.enquiries
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_enquiries_ins
on public.enquiries
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('enquiries.write')
      )
)
;

create policy rls_enquiries_upd
on public.enquiries
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('enquiries.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('enquiries.write')
      )
)
;

create policy rls_enquiries_restore
on public.enquiries
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_follow_up_tasks_active_sel
on public.follow_up_tasks
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.read')
        or public.current_user_has_permission('enquiries.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_follow_up_tasks_deleted_sel
on public.follow_up_tasks
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_follow_up_tasks_ins
on public.follow_up_tasks
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
        or public.current_user_has_permission('enquiries.write')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_follow_up_tasks_upd
on public.follow_up_tasks
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
        or public.current_user_has_permission('enquiries.write')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
        or public.current_user_has_permission('enquiries.write')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_follow_up_tasks_restore
on public.follow_up_tasks
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_terms_active_sel
on public.terms
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.read')
      )) and deleted_at is null
)
;

create policy rls_terms_deleted_sel
on public.terms
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_terms_ins
on public.terms
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_terms_upd
on public.terms
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_terms_restore
on public.terms
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_term_calendar_exceptions_active_sel
on public.term_calendar_exceptions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.read')
      )) and deleted_at is null
)
;

create policy rls_term_calendar_exceptions_deleted_sel
on public.term_calendar_exceptions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_term_calendar_exceptions_ins
on public.term_calendar_exceptions
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_term_calendar_exceptions_upd
on public.term_calendar_exceptions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_term_calendar_exceptions_restore
on public.term_calendar_exceptions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_term_enrolments_active_sel
on public.term_enrolments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.read')
      )) and deleted_at is null
)
;

create policy rls_term_enrolments_deleted_sel
on public.term_enrolments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_term_enrolments_ins
on public.term_enrolments
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_term_enrolments_upd
on public.term_enrolments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_term_enrolments_restore
on public.term_enrolments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_dojo_events_active_sel
on public.dojo_events
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.read')
      )) and deleted_at is null
)
;

create policy rls_dojo_events_deleted_sel
on public.dojo_events
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_dojo_events_ins
on public.dojo_events
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_dojo_events_upd
on public.dojo_events
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_dojo_events_restore
on public.dojo_events
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_training_sessions_active_sel
on public.training_sessions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.read')
      )) and deleted_at is null
)
;

create policy rls_training_sessions_deleted_sel
on public.training_sessions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_training_sessions_ins
on public.training_sessions
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_training_sessions_upd
on public.training_sessions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('training.write')
      )
)
;

create policy rls_training_sessions_restore
on public.training_sessions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_attendance_records_active_sel
on public.attendance_records
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('attendance.read')
      )) and deleted_at is null
)
;

create policy rls_attendance_records_deleted_sel
on public.attendance_records
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_attendance_records_ins
on public.attendance_records
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('attendance.write')
      )
)
;

create policy rls_attendance_records_upd
on public.attendance_records
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('attendance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('attendance.write')
      )
)
;

create policy rls_attendance_records_restore
on public.attendance_records
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_grading_events_active_sel
on public.grading_events
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.read')
      )) and deleted_at is null
)
;

create policy rls_grading_events_deleted_sel
on public.grading_events
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_grading_events_ins
on public.grading_events
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )
)
;

create policy rls_grading_events_upd
on public.grading_events
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )
)
;

create policy rls_grading_events_restore
on public.grading_events
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_grading_records_active_sel
on public.grading_records
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.read')
      )) and deleted_at is null
)
;

create policy rls_grading_records_deleted_sel
on public.grading_records
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_grading_records_ins
on public.grading_records
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )
)
;

create policy rls_grading_records_upd
on public.grading_records
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('gradings.write')
      )
)
;

create policy rls_grading_records_restore
on public.grading_records
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_progress_active_sel
on public.student_progress
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.read')
      )) and deleted_at is null
)
;

create policy rls_student_progress_deleted_sel
on public.student_progress
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_progress_ins
on public.student_progress
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )
)
;

create policy rls_student_progress_upd
on public.student_progress
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )
)
;

create policy rls_student_progress_restore
on public.student_progress
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_goals_active_sel
on public.student_goals
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.read')
      )) and deleted_at is null
)
;

create policy rls_student_goals_deleted_sel
on public.student_goals
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_goals_ins
on public.student_goals
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )
)
;

create policy rls_student_goals_upd
on public.student_goals
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('progress.write')
      )
)
;

create policy rls_student_goals_restore
on public.student_goals
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_fee_schedules_active_sel
on public.fee_schedules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_fee_schedules_deleted_sel
on public.fee_schedules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_fee_schedules_ins
on public.fee_schedules
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_fee_schedules_upd
on public.fee_schedules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_fee_schedules_restore
on public.fee_schedules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_fee_schedule_items_active_sel
on public.fee_schedule_items
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_fee_schedule_items_deleted_sel
on public.fee_schedule_items
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_fee_schedule_items_ins
on public.fee_schedule_items
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_fee_schedule_items_upd
on public.fee_schedule_items
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_fee_schedule_items_restore
on public.fee_schedule_items
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_billing_profiles_active_sel
on public.student_billing_profiles
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_student_billing_profiles_deleted_sel
on public.student_billing_profiles
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_billing_profiles_ins
on public.student_billing_profiles
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_student_billing_profiles_upd
on public.student_billing_profiles
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_student_billing_profiles_restore
on public.student_billing_profiles
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_student_discounts_active_sel
on public.student_discounts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_student_discounts_deleted_sel
on public.student_discounts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_student_discounts_ins
on public.student_discounts
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_student_discounts_upd
on public.student_discounts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_student_discounts_restore
on public.student_discounts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_referral_reward_rules_active_sel
on public.referral_reward_rules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_referral_reward_rules_deleted_sel
on public.referral_reward_rules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_referral_reward_rules_ins
on public.referral_reward_rules
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_referral_reward_rules_upd
on public.referral_reward_rules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_referral_reward_rules_restore
on public.referral_reward_rules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_referral_reward_awards_active_sel
on public.referral_reward_awards
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_referral_reward_awards_deleted_sel
on public.referral_reward_awards
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_referral_reward_awards_ins
on public.referral_reward_awards
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_referral_reward_awards_upd
on public.referral_reward_awards
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_referral_reward_awards_restore
on public.referral_reward_awards
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_charge_batches_active_sel
on public.charge_batches
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_charge_batches_deleted_sel
on public.charge_batches
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_charge_batches_ins
on public.charge_batches
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charge_batches_upd
on public.charge_batches
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charge_batches_restore
on public.charge_batches
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_charge_batch_items_active_sel
on public.charge_batch_items
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_charge_batch_items_deleted_sel
on public.charge_batch_items
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_charge_batch_items_ins
on public.charge_batch_items
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charge_batch_items_upd
on public.charge_batch_items
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charge_batch_items_restore
on public.charge_batch_items
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_charges_active_sel
on public.charges
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_charges_deleted_sel
on public.charges
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_charges_ins
on public.charges
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charges_upd
on public.charges
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_charges_restore
on public.charges
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_payments_active_sel
on public.payments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_payments_deleted_sel
on public.payments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_payments_ins
on public.payments
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_payments_upd
on public.payments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_payments_restore
on public.payments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_payment_allocations_active_sel
on public.payment_allocations
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_payment_allocations_deleted_sel
on public.payment_allocations
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_payment_allocations_ins
on public.payment_allocations
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_payment_allocations_upd
on public.payment_allocations
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_payment_allocations_restore
on public.payment_allocations
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_financial_adjustments_active_sel
on public.financial_adjustments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_financial_adjustments_deleted_sel
on public.financial_adjustments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_financial_adjustments_ins
on public.financial_adjustments
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_financial_adjustments_upd
on public.financial_adjustments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_financial_adjustments_restore
on public.financial_adjustments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_refunds_active_sel
on public.refunds
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_refunds_deleted_sel
on public.refunds
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_refunds_ins
on public.refunds
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_refunds_upd
on public.refunds
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_refunds_restore
on public.refunds
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_invoices_active_sel
on public.invoices
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_invoices_deleted_sel
on public.invoices
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_invoices_ins
on public.invoices
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_invoices_upd
on public.invoices
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_invoices_restore
on public.invoices
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_invoice_items_sel
on public.invoice_items
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.read')
      )
)
;

create policy rls_invoice_items_ins
on public.invoice_items
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_invoice_items_upd
on public.invoice_items
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_invoice_items_del
on public.invoice_items
for delete
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_expense_categories_sel
on public.expense_categories
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )
)
;

create policy rls_expense_categories_ins
on public.expense_categories
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expense_categories_upd
on public.expense_categories
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_suppliers_active_sel
on public.suppliers
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_suppliers_deleted_sel
on public.suppliers
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_suppliers_ins
on public.suppliers
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_suppliers_upd
on public.suppliers
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_suppliers_restore
on public.suppliers
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_expenses_active_sel
on public.expenses
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_expenses_deleted_sel
on public.expenses
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_expenses_ins
on public.expenses
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expenses_upd
on public.expenses
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expenses_restore
on public.expenses
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_expense_payments_active_sel
on public.expense_payments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_expense_payments_deleted_sel
on public.expense_payments
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_expense_payments_ins
on public.expense_payments
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expense_payments_upd
on public.expense_payments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expense_payments_restore
on public.expense_payments
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_recurring_expenses_active_sel
on public.recurring_expenses
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_recurring_expenses_deleted_sel
on public.recurring_expenses
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_recurring_expenses_ins
on public.recurring_expenses
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_recurring_expenses_upd
on public.recurring_expenses
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_recurring_expenses_restore
on public.recurring_expenses
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_expense_occurrences_active_sel
on public.expense_occurrences
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.read')
        or public.current_user_has_permission('finance.read')
      )) and deleted_at is null
)
;

create policy rls_expense_occurrences_deleted_sel
on public.expense_occurrences
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_expense_occurrences_ins
on public.expense_occurrences
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expense_occurrences_upd
on public.expense_occurrences
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('expenses.write')
      )
)
;

create policy rls_expense_occurrences_restore
on public.expense_occurrences
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_financial_accounts_active_sel
on public.financial_accounts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
        or public.current_user_has_permission('finance.read')
        or public.current_user_has_permission('expenses.read')
      )) and deleted_at is null
)
;

create policy rls_financial_accounts_deleted_sel
on public.financial_accounts
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_financial_accounts_ins
on public.financial_accounts
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_financial_accounts_upd
on public.financial_accounts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
        or public.current_user_has_permission('finance.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
        or public.current_user_has_permission('finance.write')
      )
)
;

create policy rls_financial_accounts_restore
on public.financial_accounts
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_bank_column_mappings_active_sel
on public.bank_column_mappings
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_bank_column_mappings_deleted_sel
on public.bank_column_mappings
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_bank_column_mappings_ins
on public.bank_column_mappings
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_column_mappings_upd
on public.bank_column_mappings
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_column_mappings_restore
on public.bank_column_mappings
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_bank_import_batches_active_sel
on public.bank_import_batches
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_bank_import_batches_deleted_sel
on public.bank_import_batches
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_bank_import_batches_ins
on public.bank_import_batches
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_import_batches_upd
on public.bank_import_batches
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_import_batches_restore
on public.bank_import_batches
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_bank_transactions_active_sel
on public.bank_transactions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_bank_transactions_deleted_sel
on public.bank_transactions
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_bank_transactions_ins
on public.bank_transactions
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_transactions_upd
on public.bank_transactions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_transactions_restore
on public.bank_transactions
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_matching_rules_active_sel
on public.matching_rules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_matching_rules_deleted_sel
on public.matching_rules
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_matching_rules_ins
on public.matching_rules
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_matching_rules_upd
on public.matching_rules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_matching_rules_restore
on public.matching_rules
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_bank_payment_matches_sel
on public.bank_payment_matches
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )
)
;

create policy rls_bank_payment_matches_ins
on public.bank_payment_matches
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_payment_matches_upd
on public.bank_payment_matches
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_expense_matches_sel
on public.bank_expense_matches
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )
)
;

create policy rls_bank_expense_matches_ins
on public.bank_expense_matches
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_expense_matches_upd
on public.bank_expense_matches
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_account_transfers_active_sel
on public.account_transfers
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_account_transfers_deleted_sel
on public.account_transfers
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_account_transfers_ins
on public.account_transfers
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_account_transfers_upd
on public.account_transfers
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_account_transfers_restore
on public.account_transfers
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_bank_transfer_matches_sel
on public.bank_transfer_matches
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )
)
;

create policy rls_bank_transfer_matches_ins
on public.bank_transfer_matches
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_transfer_matches_upd
on public.bank_transfer_matches
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_reconciliations_active_sel
on public.bank_reconciliations
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )) and deleted_at is null
)
;

create policy rls_bank_reconciliations_deleted_sel
on public.bank_reconciliations
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_bank_reconciliations_ins
on public.bank_reconciliations
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_reconciliations_upd
on public.bank_reconciliations
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_bank_reconciliations_restore
on public.bank_reconciliations
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

create policy rls_reconciliation_items_sel
on public.reconciliation_items
for select
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.read')
      )
)
;

create policy rls_reconciliation_items_ins
on public.reconciliation_items
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_reconciliation_items_upd
on public.reconciliation_items
for update
to authenticated
using (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('banking.write')
      )
)
;

create policy rls_communication_history_active_sel
on public.communication_history
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.read')
      )) and deleted_at is null
)
;

create policy rls_communication_history_deleted_sel
on public.communication_history
for select
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
;

create policy rls_communication_history_ins
on public.communication_history
for insert
to authenticated
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
      )
)
;

create policy rls_communication_history_upd
on public.communication_history
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
      )) and deleted_at is null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('communication.write')
      )
)
;

create policy rls_communication_history_restore
on public.communication_history
for update
to authenticated
using (
  (public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )) and deleted_at is not null
)
with check (
  public.is_current_user_authorised()
      and (
        public.current_user_has_role('administrator')
        or public.current_user_has_permission('recycle_bin.manage')
      )
)
;

-- =========================================================
-- MINIMUM FUNCTION ACCESS REQUIRED FOR MICROSOFT SIGN-IN
-- =========================================================

revoke all on function public.sync_current_user_profile() from anon;
grant execute on function public.sync_current_user_profile() to authenticated;

-- Read-only helper functions used by RLS and the application.
revoke all on function public.current_auth_email() from public, anon;
grant execute on function public.current_auth_email() to authenticated;
revoke all on function public.current_authorised_user_id() from public, anon;
grant execute on function public.current_authorised_user_id() to authenticated;
revoke all on function public.is_current_user_authorised() from public, anon;
grant execute on function public.is_current_user_authorised() to authenticated;
revoke all on function public.current_user_has_role(text) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;
revoke all on function public.current_user_has_permission(text) from public, anon;
grant execute on function public.current_user_has_permission(text) to authenticated;
revoke all on function public.calculate_age(date, date) from public, anon;
grant execute on function public.calculate_age(date, date) to authenticated;
revoke all on function public.student_age(uuid, date) from public, anon;
grant execute on function public.student_age(uuid, date) to authenticated;
revoke all on function public.current_grade_held_days(uuid, date) from public, anon;
grant execute on function public.current_grade_held_days(uuid, date) to authenticated;
revoke all on function public.student_attendance_percentage(uuid, date, date) from public, anon;
grant execute on function public.student_attendance_percentage(uuid, date, date) to authenticated;
revoke all on function public.charge_allocated_amount(uuid) from public, anon;
grant execute on function public.charge_allocated_amount(uuid) to authenticated;
revoke all on function public.charge_adjustment_net(uuid) from public, anon;
grant execute on function public.charge_adjustment_net(uuid) to authenticated;
revoke all on function public.charge_outstanding_amount(uuid) from public, anon;
grant execute on function public.charge_outstanding_amount(uuid) to authenticated;
revoke all on function public.payment_allocated_amount(uuid) from public, anon;
grant execute on function public.payment_allocated_amount(uuid) to authenticated;
revoke all on function public.payment_unallocated_amount(uuid) from public, anon;
grant execute on function public.payment_unallocated_amount(uuid) to authenticated;
revoke all on function public.family_outstanding_balance(uuid) from public, anon;
grant execute on function public.family_outstanding_balance(uuid) to authenticated;
revoke all on function public.family_unallocated_credit(uuid) from public, anon;
grant execute on function public.family_unallocated_credit(uuid) to authenticated;
revoke all on function public.invoice_calculated_subtotal(uuid) from public, anon;
grant execute on function public.invoice_calculated_subtotal(uuid) to authenticated;
revoke all on function public.invoice_calculated_payments(uuid) from public, anon;
grant execute on function public.invoice_calculated_payments(uuid) to authenticated;
revoke all on function public.expense_paid_amount(uuid) from public, anon;
grant execute on function public.expense_paid_amount(uuid) to authenticated;
revoke all on function public.make_bank_transaction_fingerprint(uuid, date, numeric, text, text, text, text) from public, anon;
grant execute on function public.make_bank_transaction_fingerprint(uuid, date, numeric, text, text, text, text) to authenticated;
revoke all on function public.next_recurring_due_date(date, text) from public, anon;
grant execute on function public.next_recurring_due_date(date, text) to authenticated;

-- Number-generation and mutation functions remain ungranted until
-- 05-hardening.sql applies permission checks and final grants.

insert into public.schema_versions (version, description)
values ('0.2.2', 'JKA GardenCity Dojo Manager row level security policies')
on conflict (version) do nothing;

commit;
