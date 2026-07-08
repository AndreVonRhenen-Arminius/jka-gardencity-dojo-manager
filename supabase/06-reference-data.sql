-- JKA GardenCity Dojo Manager
-- File: 06-reference-data.sql
-- Schema version: 0.2.4
-- Purpose: Insert safe system roles, permissions, JKA reference values,
--          expense categories, application defaults and document sequences.
-- Important: Run only after 01-schema.sql through 05-hardening.sql.
-- This file contains no students, guardians, household records, bank records,
-- passwords, secret keys or live financial transactions.

begin;

-- =========================================================
-- APPLICATION SETTINGS
-- =========================================================

insert into public.app_settings (
  setting_key,
  setting_value,
  description,
  is_sensitive
)
values
  ('application.identity', jsonb_build_object(
      'application_id', 'nz.jka.gardencity.dojo-manager',
      'application_name', 'JKA GardenCity Dojo Manager',
      'version', '0.2.4'
    ), 'Public application identity and database setup version.', false),
  ('dojo.profile', jsonb_build_object(
      'dojo_name', 'JKA Christchurch – GardenCity',
      'instructor_name', 'André Von Rhenen',
      'location', 'Christchurch, New Zealand'
    ), 'Dojo name, instructor and general location.', false),
  ('localisation', jsonb_build_object(
      'language', 'en-NZ',
      'timezone', 'Pacific/Auckland',
      'currency', 'NZD',
      'date_format', 'DD/MM/YYYY'
    ), 'New Zealand language, date, currency and timezone defaults.', false),
  ('training.default_days', jsonb_build_array('Tuesday', 'Thursday'),
    'Normal dojo training days. These remain configurable.', false),
  ('security.inactivity_timeout_minutes', to_jsonb(30),
    'Default automatic sign-out period after inactivity.', false),
  ('theme.default', jsonb_build_object(
      'theme_code', 'jka-dark-red',
      'mode', 'dark',
      'primary_accent', '#B5121B',
      'bright_accent', '#E2232E',
      'background', '#090B0F',
      'panel', '#13161C'
    ), 'Dark charcoal and JKA red visual theme defaults.', false),
  ('invoice.defaults', jsonb_build_object(
      'prefix', 'JKA',
      'payment_terms_days', 14,
      'show_account_nickname_only', true
    ), 'Initial invoice defaults. Bank account nicknames only.', false),
  ('backup.format', jsonb_build_object(
      'application_id', 'nz.jka.gardencity.dojo-manager',
      'format_version', 1,
      'encryption_required', true
    ), 'Dojo-specific encrypted backup identification.', false)
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    description = excluded.description,
    is_sensitive = excluded.is_sensitive,
    updated_at = now();

-- =========================================================
-- SYSTEM ROLES
-- =========================================================

insert into public.roles (
  role_code,
  role_name,
  description,
  is_system_role,
  is_active
)
values
  ('administrator', 'Administrator',
    'Full authorised access to dojo administration, finance, security and settings.', true, true),
  ('instructor', 'Instructor',
    'Student, attendance, training, grading, progress, safety and communication access without finance administration.', true, true),
  ('attendance_only', 'Attendance-only',
    'Fast attendance access with limited student and safety information.', true, true),
  ('finance_only', 'Finance-only',
    'Fees, payments, invoices, expenses, banking and reconciliation access without medical information.', true, true),
  ('read_only', 'Read-only',
    'Read-only access to standard dojo records, excluding protected medical and security administration.', true, true)
on conflict (role_code) do update
set role_name = excluded.role_name,
    description = excluded.description,
    is_system_role = excluded.is_system_role,
    is_active = excluded.is_active,
    updated_at = now();

-- =========================================================
-- PERMISSIONS
-- =========================================================

insert into public.permissions (
  permission_code,
  permission_name,
  description
)
values
  ('access.manage', 'Manage authorised access', 'Authorise users, revoke access and assign roles.'),
  ('people.read', 'View students and families', 'View standard student, guardian and family records.'),
  ('people.write', 'Manage students and families', 'Create and update standard student, guardian and family records.'),
  ('notes.read', 'View student notes', 'View ordinary non-medical student notes.'),
  ('notes.write', 'Manage student notes', 'Create and update ordinary non-medical student notes.'),
  ('safety.read', 'View safety alerts', 'View limited safety alerts needed for class supervision.'),
  ('safety.write', 'Manage safety alerts', 'Create and update limited class safety alerts.'),
  ('medical.read', 'View protected medical information', 'View separately protected student medical information.'),
  ('medical.write', 'Manage protected medical information', 'Create and update separately protected medical information.'),
  ('enquiries.read', 'View enquiries', 'View enquiries, trial records and follow-ups.'),
  ('enquiries.write', 'Manage enquiries', 'Create, update and convert enquiries and trial records.'),
  ('attendance.read', 'View attendance', 'View attendance sessions, records and percentages.'),
  ('attendance.write', 'Manage attendance', 'Create sessions and record or correct attendance.'),
  ('training.read', 'View training records', 'View terms, sessions, events and calendar exceptions.'),
  ('training.write', 'Manage training records', 'Create and update terms, sessions, events and calendar exceptions.'),
  ('gradings.read', 'View grading records', 'View belt ranks, grading events and grading history.'),
  ('gradings.write', 'Manage grading records', 'Create and update grading events and results.'),
  ('progress.read', 'View student progress', 'View progress reviews and student goals.'),
  ('progress.write', 'Manage student progress', 'Create and update progress reviews and goals.'),
  ('finance.read', 'View fees and ledgers', 'View fee schedules, charges, payments, invoices and balances.'),
  ('finance.write', 'Manage fees and ledgers', 'Create and correct charges, payments, allocations, invoices, credits and refunds.'),
  ('expenses.read', 'View expenses', 'View suppliers, expenses and recurring expense records.'),
  ('expenses.write', 'Manage expenses', 'Create and update expenses, suppliers and recurring expense records.'),
  ('banking.read', 'View banking records', 'View bank imports, transactions, matching and reconciliation records.'),
  ('banking.write', 'Manage banking records', 'Import, match, categorise and reconcile bank transactions.'),
  ('communication.read', 'View communication history', 'View communication notes and follow-up tasks.'),
  ('communication.write', 'Manage communication history', 'Create and update communication notes and follow-up tasks.'),
  ('audit.read', 'View audit history', 'View protected audit history.'),
  ('recycle_bin.manage', 'Manage recycle bin', 'Restore soft-deleted records and confirm permanent deletion.'),
  ('backup.manage', 'Manage backups', 'Create, validate and restore encrypted backups.'),
  ('sync.manage', 'Manage synchronisation', 'View sync status and resolve synchronisation conflicts.'),
  ('reference.manage', 'Manage reference data', 'Manage configurable reference lists and categories.'),
  ('settings.manage', 'Manage application settings', 'Manage application, dojo, security and document settings.')
on conflict (permission_code) do update
set permission_name = excluded.permission_name,
    description = excluded.description;

-- =========================================================
-- ROLE-PERMISSION ASSIGNMENTS
-- =========================================================

-- Rebuild only the assignments for the five built-in roles so rerunning this
-- file cannot leave obsolete permissions attached to a system role.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.role_code in (
    'administrator', 'instructor', 'attendance_only', 'finance_only', 'read_only'
  );

-- Administrator: every permission.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.role_code = 'administrator'
on conflict do nothing;

-- Instructor: operational dojo management but no finance, banking,
-- access administration, backup administration or full audit access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_code = any(array[
  'people.read', 'people.write',
  'notes.read', 'notes.write',
  'safety.read', 'safety.write',
  'medical.read',
  'enquiries.read', 'enquiries.write',
  'attendance.read', 'attendance.write',
  'training.read', 'training.write',
  'gradings.read', 'gradings.write',
  'progress.read', 'progress.write',
  'communication.read', 'communication.write'
]::text[])
where r.role_code = 'instructor'
on conflict do nothing;

-- Attendance-only: fast class attendance with standard identity and limited
-- safety-warning visibility, but no full medical access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_code = any(array[
  'people.read',
  'safety.read',
  'attendance.read', 'attendance.write',
  'training.read'
]::text[])
where r.role_code = 'attendance_only'
on conflict do nothing;

-- Finance-only: financial operations and standard payer identity information.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_code = any(array[
  'people.read',
  'finance.read', 'finance.write',
  'expenses.read', 'expenses.write',
  'banking.read', 'banking.write',
  'communication.read', 'communication.write'
]::text[])
where r.role_code = 'finance_only'
on conflict do nothing;

-- Read-only: standard non-medical, non-security records.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_code = any(array[
  'people.read',
  'notes.read',
  'safety.read',
  'enquiries.read',
  'attendance.read',
  'training.read',
  'gradings.read',
  'progress.read',
  'finance.read',
  'expenses.read',
  'banking.read',
  'communication.read'
]::text[])
where r.role_code = 'read_only'
on conflict do nothing;

-- =========================================================
-- BELT AND GRADE REFERENCE DATA
-- =========================================================

-- This is an editable initial JKA-style rank list. Confirm local JKA NZ belt
-- conventions before assigning real students, particularly junior variations.
insert into public.belt_ranks (
  rank_code,
  rank_name,
  belt_colour,
  kyu_dan_level,
  rank_order,
  notes,
  is_active
)
values
  ('UNRANKED', 'Beginner / Ungraded', 'White', 'Ungraded', 0,
    'New student who has not yet completed a grading.', true),
  ('9_KYU', '9th Kyu', 'White', '9th Kyu', 10, null, true),
  ('8_KYU', '8th Kyu', 'Yellow', '8th Kyu', 20, null, true),
  ('7_KYU', '7th Kyu', 'Orange', '7th Kyu', 30, null, true),
  ('6_KYU', '6th Kyu', 'Green', '6th Kyu', 40, null, true),
  ('5_KYU', '5th Kyu', 'Purple', '5th Kyu', 50, null, true),
  ('4_KYU', '4th Kyu', 'Purple', '4th Kyu', 60, null, true),
  ('3_KYU', '3rd Kyu', 'Brown', '3rd Kyu', 70, null, true),
  ('2_KYU', '2nd Kyu', 'Brown', '2nd Kyu', 80, null, true),
  ('1_KYU', '1st Kyu', 'Brown', '1st Kyu', 90, null, true),
  ('1_DAN', '1st Dan', 'Black', '1st Dan', 100, null, true),
  ('2_DAN', '2nd Dan', 'Black', '2nd Dan', 110, null, true),
  ('3_DAN', '3rd Dan', 'Black', '3rd Dan', 120, null, true),
  ('4_DAN', '4th Dan', 'Black', '4th Dan', 130, null, true),
  ('5_DAN', '5th Dan', 'Black', '5th Dan', 140, null, true),
  ('6_DAN', '6th Dan', 'Black', '6th Dan', 150, null, true),
  ('7_DAN', '7th Dan', 'Black', '7th Dan', 160, null, true),
  ('8_DAN', '8th Dan', 'Black', '8th Dan', 170, null, true),
  ('9_DAN', '9th Dan', 'Black', '9th Dan', 180, null, true),
  ('10_DAN', '10th Dan', 'Black', '10th Dan', 190, null, true)
on conflict (rank_code) do update
set rank_name = excluded.rank_name,
    belt_colour = excluded.belt_colour,
    kyu_dan_level = excluded.kyu_dan_level,
    rank_order = excluded.rank_order,
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = now();

-- =========================================================
-- EXPENSE CATEGORIES
-- =========================================================

insert into public.expense_categories (
  category_code,
  category_name,
  description,
  is_active
)
values
  ('HALL_HIRE', 'Hall Hire', 'Training venue and hall rental costs.', true),
  ('JKA_NZ', 'JKA NZ Payments', 'Payments and remittances to JKA New Zealand.', true),
  ('GRADING_COSTS', 'Grading Costs', 'External grading-related costs and examiner charges.', true),
  ('BELTS', 'Belts', 'Karate belt purchases.', true),
  ('CERTIFICATES', 'Certificates', 'Certificates, printing and related supplies.', true),
  ('EQUIPMENT', 'Equipment', 'Training, safety and dojo equipment.', true),
  ('ADVERTISING', 'Advertising', 'Flyers, social advertising and promotional material.', true),
  ('WEBSITE', 'Website Costs', 'Domain, website and related online service costs.', true),
  ('SOFTWARE', 'Software Subscriptions', 'Dojo software and online subscription costs.', true),
  ('TRAVEL', 'Travel', 'Dojo-related transport and travel costs.', true),
  ('ACCOMMODATION', 'Accommodation', 'Dojo-related accommodation costs.', true),
  ('EVENT_COSTS', 'Event Costs', 'Seminar, gasshuku, competition and function costs.', true),
  ('BANK_FEES', 'Bank Fees', 'Bank and payment-processing fees.', true),
  ('REFUNDS', 'Refunds', 'Refunds paid to students, guardians or families.', true),
  ('OTHER', 'Other Expenses', 'Other legitimate dojo expenses not covered elsewhere.', true)
on conflict (category_code) do update
set category_name = excluded.category_name,
    description = excluded.description,
    is_active = excluded.is_active,
    updated_at = now();

-- =========================================================
-- DOCUMENT NUMBER SEQUENCES
-- =========================================================

-- Seed starting sequence rows without resetting any sequence that may already
-- have been used. Number generation remains controlled by secured functions.
insert into public.document_number_sequences (
  document_type,
  prefix,
  current_year,
  next_number,
  padding_length
)
values
  ('student', 'STU', extract(year from current_date)::integer, 1, 4),
  ('invoice', 'JKA', extract(year from current_date)::integer, 1, 4),
  ('receipt', 'RCP', extract(year from current_date)::integer, 1, 4),
  ('charge', 'CHG', extract(year from current_date)::integer, 1, 4),
  ('payment', 'PAY', extract(year from current_date)::integer, 1, 4),
  ('expense', 'EXP', extract(year from current_date)::integer, 1, 4),
  ('adjustment', 'ADJ', extract(year from current_date)::integer, 1, 4),
  ('refund', 'REF', extract(year from current_date)::integer, 1, 4)
on conflict (document_type) do nothing;

-- =========================================================
-- SCHEMA VERSION MARKER
-- =========================================================

insert into public.schema_versions (version, description)
values ('0.2.4', 'JKA GardenCity Dojo Manager roles, permissions and reference data')
on conflict (version) do nothing;

commit;
