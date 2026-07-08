-- JKA GardenCity Dojo Manager
-- File: 01-schema.sql
-- Schema version: 0.2.0
-- Purpose: Create the initial relational database structure only.
-- Important: Run only in the separate JKA GardenCity Dojo Manager Supabase project.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- =========================================================
-- SYSTEM AND SECURITY
-- =========================================================

create table if not exists public.schema_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  description text,
  applied_at timestamptz not null default now(),
  applied_by uuid references auth.users(id) on delete set null
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  first_name text,
  last_name text,
  timezone text not null default 'Pacific/Auckland',
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_version integer not null default 1 check (record_version > 0)
);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email::text));

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_code text not null unique,
  role_name text not null unique,
  description text,
  is_system_role boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_version integer not null default 1 check (record_version > 0)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_code text not null unique,
  permission_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.authorised_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  authorised_at timestamptz not null default now(),
  authorised_by uuid references auth.users(id) on delete set null,
  authorisation_reason text,
  access_expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_version integer not null default 1 check (record_version > 0),
  constraint authorised_users_email_not_blank check (length(trim(email::text)) > 3)
);

create unique index if not exists authorised_users_email_unique
  on public.authorised_users (lower(email::text));

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  authorised_user_id uuid not null references public.authorised_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  notes text,
  unique (authorised_user_id, role_id)
);

create table if not exists public.registered_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text,
  device_fingerprint text,
  browser_info text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_trusted boolean not null default false,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists registered_devices_user_id_idx
  on public.registered_devices(user_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  record_type text not null,
  record_id uuid,
  summary text not null,
  previous_value jsonb,
  new_value jsonb,
  device_or_session text,
  source text not null default 'app',
  correlation_id uuid,
  ip_address inet
);

create index if not exists audit_events_occurred_at_idx
  on public.audit_events(occurred_at desc);
create index if not exists audit_events_record_idx
  on public.audit_events(record_type, record_id);
create index if not exists audit_events_user_idx
  on public.audit_events(user_id);

create table if not exists public.deleted_record_index (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  display_label text,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null,
  restore_status text not null default 'deleted'
    check (restore_status in ('deleted', 'restored', 'permanently_deleted')),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  permanent_delete_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (record_type, record_id)
);

-- =========================================================
-- PEOPLE: FAMILIES, GUARDIANS, STUDENTS
-- =========================================================

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  family_name text not null,
  billing_name text,
  primary_guardian_id uuid,
  payment_reference text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text default 'Christchurch',
  postcode text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists families_name_idx on public.families(lower(family_name));

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext,
  mobile_number text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text default 'Christchurch',
  postcode text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists guardians_name_idx on public.guardians(lower(full_name));
create index if not exists guardians_email_idx on public.guardians(lower(email::text));

create table if not exists public.guardian_families (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  is_primary_billing_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (guardian_id, family_id)
);

alter table public.families
  drop constraint if exists families_primary_guardian_fk;
alter table public.families
  add constraint families_primary_guardian_fk
  foreign key (primary_guardian_id) references public.guardians(id) on delete set null;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  family_id uuid references public.families(id) on delete set null,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  date_of_birth date,
  start_date date not null default current_date,
  status text not null default 'active',
  current_belt_rank_id uuid,
  jka_membership_number text,
  jka_passport_number text,
  previous_karate_experience text,
  school text,
  referral_source text,
  referred_by_student_id uuid,
  payment_plan text,
  discount_summary text,
  referral_reward_summary text,
  notes text,
  date_left date,
  reason_for_leaving text,
  photography_consent boolean,
  photography_consent_date date,
  consent_forms_received boolean not null default false,
  consent_forms_received_date date,
  terms_accepted boolean not null default false,
  terms_accepted_date date,
  is_exempt_from_fees boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint students_status_check check (
    status in ('active', 'trial', 'waiting', 'paused', 'inactive', 'left')
  ),
  constraint students_dates_check check (
    date_left is null or date_left >= start_date
  )
);

alter table public.students
  drop constraint if exists students_referred_by_student_fk;
alter table public.students
  add constraint students_referred_by_student_fk
  foreign key (referred_by_student_id) references public.students(id) on delete set null;

create index if not exists students_name_idx
  on public.students(lower(last_name), lower(first_name));
create index if not exists students_family_idx on public.students(family_id);
create index if not exists students_status_idx on public.students(status);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship_to_student text,
  is_primary_contact boolean not null default false,
  is_emergency_contact boolean not null default false,
  authorised_to_collect boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (student_id, guardian_id)
);

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  note_type text not null default 'general',
  note_text text not null,
  visibility text not null default 'staff'
    check (visibility in ('administrator', 'staff', 'finance', 'parent_shareable')),
  note_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.student_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  contact_name text not null,
  relationship_to_student text,
  phone_number text not null,
  alternate_phone_number text,
  priority_order smallint not null default 1 check (priority_order > 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.student_medical_information (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  allergies text,
  relevant_medical_conditions text,
  medication_information text,
  injuries text,
  physical_limitations text,
  guardian_safety_instructions text,
  important_safety_notes text,
  reviewed_on date,
  reviewed_by_guardian_id uuid references public.guardians(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.student_safety_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  alert_type text not null,
  short_warning text not null,
  safety_instruction text,
  severity text not null default 'important'
    check (severity in ('information', 'important', 'urgent')),
  show_on_attendance boolean not null default true,
  active_from date not null default current_date,
  active_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint safety_alert_dates_check check (
    active_until is null or active_until >= active_from
  )
);

-- =========================================================
-- ENQUIRIES AND FOLLOW-UPS
-- =========================================================

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_date date not null default current_date,
  student_name text not null,
  student_age smallint check (student_age is null or student_age between 1 and 100),
  guardian_name text,
  phone text,
  email citext,
  referral_source text,
  preferred_training_days text[],
  notes text,
  follow_up_date date,
  status text not null default 'new_enquiry',
  converted_student_id uuid references public.students(id) on delete set null,
  converted_at timestamptz,
  converted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint enquiries_status_check check (
    status in (
      'new_enquiry', 'contacted', 'trial_booked', 'trial_attended',
      'follow_up_required', 'joined', 'did_not_proceed', 'no_response'
    )
  )
);

create index if not exists enquiries_status_idx on public.enquiries(status);
create index if not exists enquiries_follow_up_idx on public.enquiries(follow_up_date);

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  title text not null,
  description text,
  due_date date,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

-- =========================================================
-- TERMS, EVENTS, SESSIONS AND ATTENDANCE
-- =========================================================

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term_name text not null,
  academic_year integer not null check (academic_year between 2000 and 2200),
  term_number smallint check (term_number is null or term_number between 1 and 9),
  start_date date not null,
  end_date date not null,
  number_of_training_weeks numeric(5,2) check (number_of_training_weeks is null or number_of_training_weeks >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'open', 'closed', 'archived')),
  default_term_fee numeric(12,2) check (default_term_fee is null or default_term_fee >= 0),
  sibling_fee numeric(12,2) check (sibling_fee is null or sibling_fee >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint terms_dates_check check (end_date >= start_date),
  unique (academic_year, term_name)
);

create table if not exists public.term_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms(id) on delete cascade,
  exception_date date not null,
  exception_type text not null
    check (exception_type in ('closure', 'special_training', 'venue_change', 'time_change', 'other')),
  title text,
  notes text,
  start_time time,
  end_time time,
  venue text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (term_id, exception_date, exception_type)
);

create table if not exists public.term_enrolments (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrolment_status text not null default 'enrolled'
    check (enrolment_status in ('enrolled', 'trial', 'paused', 'withdrawn', 'completed')),
  joined_term_on date,
  left_term_on date,
  eligible_for_term_charge boolean not null default true,
  charge_exclusion_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (term_id, student_id)
);

create table if not exists public.dojo_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_type text not null,
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  location text,
  organiser text,
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint dojo_events_dates_check check (end_date is null or end_date >= start_date)
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid references public.terms(id) on delete set null,
  event_id uuid references public.dojo_events(id) on delete set null,
  session_date date not null,
  start_time time,
  end_time time,
  venue text,
  instructor_user_id uuid references auth.users(id) on delete set null,
  instructor_name text,
  session_type text not null default 'normal_class',
  theme_or_lesson_focus text,
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint training_session_time_check check (
    end_time is null or start_time is null or end_time > start_time
  )
);

create index if not exists training_sessions_date_idx on public.training_sessions(session_date);
create index if not exists training_sessions_term_idx on public.training_sessions(term_id);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_status text not null
    check (attendance_status in ('present', 'absent', 'excused', 'late', 'trial')),
  arrival_time time,
  attendance_notes text,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (training_session_id, student_id)
);

create index if not exists attendance_records_student_idx on public.attendance_records(student_id);
create index if not exists attendance_records_session_idx on public.attendance_records(training_session_id);

-- =========================================================
-- BELTS, GRADINGS AND PROGRESS
-- =========================================================

create table if not exists public.belt_ranks (
  id uuid primary key default gen_random_uuid(),
  rank_code text not null unique,
  rank_name text not null,
  belt_colour text,
  kyu_dan_level text,
  rank_order integer not null unique,
  minimum_age_years numeric(5,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_version integer not null default 1 check (record_version > 0)
);

alter table public.students
  drop constraint if exists students_current_belt_rank_fk;
alter table public.students
  add constraint students_current_belt_rank_fk
  foreign key (current_belt_rank_id) references public.belt_ranks(id) on delete set null;

create table if not exists public.grading_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.dojo_events(id) on delete set null,
  grading_date date not null,
  grading_location text,
  examiner text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.grading_records (
  id uuid primary key default gen_random_uuid(),
  grading_event_id uuid references public.grading_events(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  previous_belt_rank_id uuid references public.belt_ranks(id) on delete set null,
  new_belt_rank_id uuid references public.belt_ranks(id) on delete set null,
  grading_date date not null,
  grading_location text,
  examiner text,
  result text not null default 'pending'
    check (result in ('pending', 'passed', 'failed', 'deferred', 'withdrawn')),
  grading_fee numeric(12,2) check (grading_fee is null or grading_fee >= 0),
  financial_charge_id uuid,
  fee_payment_status text,
  certificate_received boolean not null default false,
  belt_received boolean not null default false,
  jka_passport_updated boolean not null default false,
  notes text,
  instructor_approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists grading_records_student_idx on public.grading_records(student_id);
create index if not exists grading_records_date_idx on public.grading_records(grading_date);

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  review_date date not null default current_date,
  kihon_rating smallint check (kihon_rating between 1 and 5),
  kata_rating smallint check (kata_rating between 1 and 5),
  kumite_rating smallint check (kumite_rating between 1 and 5),
  fitness_rating smallint check (fitness_rating between 1 and 5),
  flexibility_rating smallint check (flexibility_rating between 1 and 5),
  discipline_rating smallint check (discipline_rating between 1 and 5),
  focus_rating smallint check (focus_rating between 1 and 5),
  confidence_rating smallint check (confidence_rating between 1 and 5),
  attitude_rating smallint check (attitude_rating between 1 and 5),
  effort_rating smallint check (effort_rating between 1 and 5),
  technical_notes text,
  parent_shareable_summary text,
  next_review_date date,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.student_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  goal_text text not null,
  goal_category text,
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused', 'cancelled')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

-- =========================================================
-- FEES, CHARGES, PAYMENTS AND INVOICES
-- =========================================================

create table if not exists public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_name text not null,
  version_number integer not null check (version_number > 0),
  effective_from date not null,
  effective_to date,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired', 'locked')),
  notes text,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint fee_schedule_dates_check check (
    effective_to is null or effective_to >= effective_from
  ),
  unique (schedule_name, version_number)
);

create table if not exists public.fee_schedule_items (
  id uuid primary key default gen_random_uuid(),
  fee_schedule_id uuid not null references public.fee_schedules(id) on delete cascade,
  fee_code text not null,
  fee_name text not null,
  fee_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  billing_frequency text,
  applicable_belt_rank_id uuid references public.belt_ranks(id) on delete set null,
  family_position text,
  condition_data jsonb not null default '{}'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (fee_schedule_id, fee_code)
);

create table if not exists public.student_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  payment_plan text,
  default_fee_schedule_id uuid references public.fee_schedules(id) on delete set null,
  is_exempt boolean not null default false,
  exemption_reason text,
  billing_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.student_discounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  discount_name text not null,
  discount_type text not null check (discount_type in ('fixed', 'percentage', 'full_exemption')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  valid_from date not null default current_date,
  valid_to date,
  approval_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint student_discounts_target_check check (
    student_id is not null or family_id is not null
  ),
  constraint student_discounts_dates_check check (
    valid_to is null or valid_to >= valid_from
  )
);

create table if not exists public.referral_reward_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  qualifying_referrals integer not null check (qualifying_referrals > 0),
  reward_type text not null,
  reward_value numeric(12,2),
  description text,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint referral_reward_rule_dates_check check (
    effective_to is null or effective_to >= effective_from
  )
);

create table if not exists public.referral_reward_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  referral_reward_rule_id uuid references public.referral_reward_rules(id) on delete set null,
  qualifying_student_id uuid references public.students(id) on delete set null,
  awarded_on date not null default current_date,
  reward_description text not null,
  reward_amount numeric(12,2) check (reward_amount is null or reward_amount >= 0),
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'used', 'cancelled')),
  used_on date,
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.charge_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  term_id uuid references public.terms(id) on delete set null,
  fee_schedule_id uuid references public.fee_schedules(id) on delete set null,
  status text not null default 'proposed'
    check (status in ('proposed', 'reviewed', 'confirmed', 'cancelled')),
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.charge_batch_items (
  id uuid primary key default gen_random_uuid(),
  charge_batch_id uuid not null references public.charge_batches(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  fee_schedule_item_id uuid references public.fee_schedule_items(id) on delete set null,
  description text not null,
  original_amount numeric(12,2) not null check (original_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  final_amount numeric(12,2) not null check (final_amount >= 0),
  is_included boolean not null default true,
  exclusion_reason text,
  sibling_position integer,
  resulting_charge_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint charge_batch_item_amount_check check (
    final_amount = greatest(original_amount - discount_amount, 0)
  )
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  charge_number text unique,
  charge_batch_id uuid references public.charge_batches(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  term_id uuid references public.terms(id) on delete set null,
  event_id uuid references public.dojo_events(id) on delete set null,
  grading_record_id uuid references public.grading_records(id) on delete set null,
  fee_schedule_id uuid references public.fee_schedules(id) on delete set null,
  fee_schedule_item_id uuid references public.fee_schedule_items(id) on delete set null,
  fee_type text not null,
  description text not null,
  charge_date date not null default current_date,
  due_date date,
  original_amount numeric(12,2) not null check (original_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  final_amount numeric(12,2) not null check (final_amount >= 0),
  status text not null default 'unpaid'
    check (status in ('draft', 'unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'reversed')),
  reason_for_charge text,
  notes text,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint charges_target_check check (
    student_id is not null or family_id is not null
  ),
  constraint charges_amount_check check (
    final_amount = greatest(original_amount - discount_amount, 0)
  )
);

alter table public.grading_records
  drop constraint if exists grading_records_financial_charge_fk;
alter table public.grading_records
  add constraint grading_records_financial_charge_fk
  foreign key (financial_charge_id) references public.charges(id) on delete set null;

alter table public.charge_batch_items
  drop constraint if exists charge_batch_items_resulting_charge_fk;
alter table public.charge_batch_items
  add constraint charge_batch_items_resulting_charge_fk
  foreign key (resulting_charge_id) references public.charges(id) on delete set null;

create index if not exists charges_student_idx on public.charges(student_id);
create index if not exists charges_family_idx on public.charges(family_id);
create index if not exists charges_term_idx on public.charges(term_id);
create index if not exists charges_due_date_idx on public.charges(due_date);
create index if not exists charges_status_idx on public.charges(status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text unique,
  family_id uuid references public.families(id) on delete set null,
  payer_guardian_id uuid references public.guardians(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  payment_status text not null default 'confirmed'
    check (payment_status in ('pending_confirmation', 'confirmed', 'reversed', 'refunded')),
  bank_description text,
  bank_reference text,
  associated_term_id uuid references public.terms(id) on delete set null,
  notes text,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists payments_family_idx on public.payments(family_id);
create index if not exists payments_date_idx on public.payments(payment_date);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  charge_id uuid not null references public.charges(id) on delete restrict,
  allocation_amount numeric(12,2) not null check (allocation_amount > 0),
  allocation_date date not null default current_date,
  status text not null default 'active'
    check (status in ('active', 'reversed')),
  reversal_of_allocation_id uuid references public.payment_allocations(id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index if not exists payment_allocations_charge_idx on public.payment_allocations(charge_id);

create table if not exists public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_number text unique,
  adjustment_type text not null
    check (adjustment_type in ('discount', 'credit', 'write_off', 'charge_reversal', 'payment_reversal', 'correction')),
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  charge_id uuid references public.charges(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  adjustment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  direction text not null check (direction in ('increase_balance', 'decrease_balance')),
  reason text not null,
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint financial_adjustments_target_check check (
    student_id is not null or family_id is not null or charge_id is not null or payment_id is not null
  )
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_number text unique,
  payment_id uuid references public.payments(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  refund_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.document_number_sequences (
  document_type text primary key,
  prefix text not null,
  current_year integer not null,
  next_number bigint not null default 1 check (next_number > 0),
  padding_length smallint not null default 4 check (padding_length between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  family_id uuid not null references public.families(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  credits_applied numeric(12,2) not null default 0 check (credits_applied >= 0),
  payments_applied numeric(12,2) not null default 0 check (payments_applied >= 0),
  outstanding_amount numeric(12,2) not null default 0,
  payment_reference text,
  notes text,
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint invoice_dates_check check (due_date is null or due_date >= invoice_date)
);

create index if not exists invoices_family_idx on public.invoices(family_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_due_date_idx on public.invoices(due_date);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  charge_id uuid references public.charges(id) on delete restrict,
  student_id uuid references public.students(id) on delete set null,
  description_snapshot text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_amount numeric(12,2) not null check (unit_amount >= 0),
  line_amount numeric(12,2) not null check (line_amount >= 0),
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (invoice_id, charge_id)
);

-- =========================================================
-- EXPENSES
-- =========================================================

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  category_code text not null unique,
  category_name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_version integer not null default 1 check (record_version > 0)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  email citext,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  account_nickname text not null unique,
  account_type text not null
    check (account_type in ('bank', 'cash', 'pending_deposits', 'petty_cash', 'other')),
  currency_code char(3) not null default 'NZD',
  opening_balance numeric(14,2) not null default 0,
  opening_balance_date date,
  include_in_dashboard boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text unique,
  expense_date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_or_payee text,
  expense_category_id uuid references public.expense_categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  account_id uuid references public.financial_accounts(id) on delete set null,
  payment_status text not null default 'unpaid'
    check (payment_status in ('proposed', 'unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded')),
  associated_term_id uuid references public.terms(id) on delete set null,
  associated_event_id uuid references public.dojo_events(id) on delete set null,
  receipt_reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists expenses_date_idx on public.expenses(expense_date);
create index if not exists expenses_category_idx on public.expenses(expense_category_id);
create index if not exists expenses_status_idx on public.expenses(payment_status);

create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  account_id uuid references public.financial_accounts(id) on delete set null,
  payment_method text,
  bank_reference text,
  status text not null default 'confirmed'
    check (status in ('pending_confirmation', 'confirmed', 'reversed')),
  notes text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_name text not null,
  expense_category_id uuid references public.expense_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  normal_amount numeric(12,2) not null check (normal_amount >= 0),
  frequency text not null
    check (frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly', 'one_time')),
  next_due_date date,
  amount_type text not null default 'fixed'
    check (amount_type in ('fixed', 'variable')),
  payment_mode text not null default 'manual'
    check (payment_mode in ('automatic', 'manual')),
  account_id uuid references public.financial_accounts(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.expense_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references public.recurring_expenses(id) on delete cascade,
  proposed_due_date date not null,
  proposed_amount numeric(12,2) not null check (proposed_amount >= 0),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'skipped', 'cancelled')),
  resulting_expense_id uuid references public.expenses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (recurring_expense_id, proposed_due_date)
);

-- =========================================================
-- BANK IMPORTS, MATCHING AND RECONCILIATION
-- =========================================================

create table if not exists public.bank_column_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_name text not null,
  bank_name text not null default 'Kiwibank',
  mapping_config jsonb not null,
  sample_headers text[],
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  column_mapping_id uuid references public.bank_column_mappings(id) on delete set null,
  file_name text not null,
  file_hash text,
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users(id) on delete set null,
  statement_start_date date,
  statement_end_date date,
  imported_opening_balance numeric(14,2),
  imported_closing_balance numeric(14,2),
  row_count integer not null default 0 check (row_count >= 0),
  confirmed_row_count integer not null default 0 check (confirmed_row_count >= 0),
  duplicate_row_count integer not null default 0 check (duplicate_row_count >= 0),
  error_row_count integer not null default 0 check (error_row_count >= 0),
  status text not null default 'preview'
    check (status in ('preview', 'reviewed', 'confirmed', 'reversed', 'failed')),
  safety_snapshot_reference text,
  notes text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists bank_import_batches_account_idx on public.bank_import_batches(account_id);
create index if not exists bank_import_batches_date_idx on public.bank_import_batches(imported_at desc);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_import_batch_id uuid not null references public.bank_import_batches(id) on delete restrict,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  transaction_date date,
  original_date_text text,
  description text,
  reference text,
  particulars text,
  code text,
  money_in numeric(14,2) check (money_in is null or money_in >= 0),
  money_out numeric(14,2) check (money_out is null or money_out >= 0),
  signed_amount numeric(14,2) not null,
  balance numeric(14,2),
  original_values jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  categorisation_status text not null default 'uncategorised'
    check (categorisation_status in ('uncategorised', 'suggested', 'confirmed', 'transfer', 'ignored')),
  confirmation_status text not null default 'pending_review'
    check (confirmation_status in ('pending_review', 'confirmed', 'rejected', 'duplicate')),
  duplicate_of_transaction_id uuid references public.bank_transactions(id) on delete set null,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists bank_transactions_fingerprint_unique
  on public.bank_transactions(account_id, fingerprint)
  where deleted_at is null and confirmation_status <> 'duplicate';
create index if not exists bank_transactions_date_idx on public.bank_transactions(transaction_date);
create index if not exists bank_transactions_status_idx on public.bank_transactions(confirmation_status, categorisation_status);

create table if not exists public.matching_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  match_field text not null,
  match_text text not null,
  match_type text not null
    check (match_type in ('contains', 'equals', 'starts_with', 'ends_with', 'regex')),
  suggested_category text,
  suggested_student_id uuid references public.students(id) on delete set null,
  suggested_family_id uuid references public.families(id) on delete set null,
  suggested_account_id uuid references public.financial_accounts(id) on delete set null,
  suggested_expense_category_id uuid references public.expense_categories(id) on delete set null,
  priority integer not null default 100,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.bank_payment_matches (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  matched_amount numeric(14,2) not null check (matched_amount > 0),
  confidence text check (confidence in ('high', 'medium', 'low')),
  status text not null default 'confirmed'
    check (status in ('suggested', 'confirmed', 'reversed')),
  matched_at timestamptz not null default now(),
  matched_by uuid references auth.users(id) on delete set null,
  notes text,
  unique (bank_transaction_id, payment_id)
);

create table if not exists public.bank_expense_matches (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete restrict,
  expense_payment_id uuid not null references public.expense_payments(id) on delete restrict,
  matched_amount numeric(14,2) not null check (matched_amount > 0),
  confidence text check (confidence in ('high', 'medium', 'low')),
  status text not null default 'confirmed'
    check (status in ('suggested', 'confirmed', 'reversed')),
  matched_at timestamptz not null default now(),
  matched_by uuid references auth.users(id) on delete set null,
  notes text,
  unique (bank_transaction_id, expense_payment_id)
);

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_date date not null default current_date,
  from_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  to_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  description text,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'reversed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint account_transfer_distinct_accounts check (from_account_id <> to_account_id)
);

create table if not exists public.bank_transfer_matches (
  id uuid primary key default gen_random_uuid(),
  account_transfer_id uuid not null references public.account_transfers(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete restrict,
  transfer_side text not null check (transfer_side in ('outgoing', 'incoming')),
  matched_amount numeric(14,2) not null check (matched_amount > 0),
  status text not null default 'confirmed'
    check (status in ('suggested', 'confirmed', 'reversed')),
  matched_at timestamptz not null default now(),
  matched_by uuid references auth.users(id) on delete set null,
  unique (account_transfer_id, bank_transaction_id)
);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  imported_opening_balance numeric(14,2),
  imported_closing_balance numeric(14,2),
  calculated_closing_balance numeric(14,2),
  difference_amount numeric(14,2),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'balanced', 'difference_found', 'closed')),
  notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint bank_reconciliation_dates_check check (period_end >= period_start),
  unique (account_id, period_start, period_end)
);

create table if not exists public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  bank_reconciliation_id uuid not null references public.bank_reconciliations(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete restrict,
  status text not null default 'unreconciled'
    check (status in ('reconciled', 'unreconciled', 'duplicate', 'missing', 'ignored')),
  notes text,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  unique (bank_reconciliation_id, bank_transaction_id)
);

-- =========================================================
-- COMMUNICATION, BACKUP AND SYNCHRONISATION
-- =========================================================

create table if not exists public.communication_history (
  id uuid primary key default gen_random_uuid(),
  communication_date timestamptz not null default now(),
  communication_type text not null
    check (communication_type in (
      'email_sent', 'phone_call', 'text_message', 'in_person_discussion',
      'follow_up_required', 'parent_concern', 'payment_reminder',
      'trial_follow_up', 'grading_discussion', 'other'
    )),
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  subject text,
  summary text not null,
  follow_up_required boolean not null default false,
  follow_up_date date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  record_version integer not null default 1 check (record_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.backup_history (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null
    check (backup_type in ('manual_export', 'safety_snapshot', 'restore_safety_backup', 'local_recovery_snapshot')),
  backup_version text not null,
  schema_version text not null,
  file_name text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  reason text,
  record_counts jsonb not null default '{}'::jsonb,
  validation_status text not null default 'not_tested'
    check (validation_status in ('not_tested', 'valid', 'invalid', 'restored_successfully', 'restore_failed')),
  validation_message text,
  encryption_method text,
  storage_location_note text,
  checksum text
);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  local_version jsonb not null,
  cloud_version jsonb not null,
  local_record_version integer,
  cloud_record_version integer,
  detected_at timestamptz not null default now(),
  detected_by uuid references auth.users(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'resolved_local', 'resolved_cloud', 'resolved_merged', 'dismissed')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists sync_conflicts_status_idx on public.sync_conflicts(status, detected_at desc);

create table if not exists public.device_sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.registered_devices(id) on delete set null,
  checkpoint_name text not null,
  last_successful_sync_at timestamptz,
  last_seen_server_version text,
  pending_change_count integer not null default 0 check (pending_change_count >= 0),
  last_error text,
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, checkpoint_name)
);

-- =========================================================
-- INITIAL SCHEMA VERSION MARKER
-- =========================================================

insert into public.schema_versions (version, description)
values ('0.2.0', 'Initial JKA GardenCity Dojo Manager relational schema')
on conflict (version) do nothing;

commit;
