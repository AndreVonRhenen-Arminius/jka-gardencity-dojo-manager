# Change Log

## 1.0.2 — Family dialog reliability fix

- Fixed the Create Family button by removing invalid nested HTML forms.
- Changed family and guardian save actions to proper form submission events.
- Prevented dialogs from closing when the dark area beside them is clicked.
- Added visible error messages inside dialogs so database or permission errors are no longer hidden behind the modal.
- Updated the service-worker cache and browser module versions.

## 1.0.0 — Feature-complete approved scope

- Completed every navigation module in the approved JKA GardenCity scope.
- Added enquiries, trial tracking, follow-ups and enquiry-to-student conversion.
- Added grading events, grading results, belt updates and optional grading charges.
- Added student progress reviews, ratings, goals and completion tracking.
- Added protected student records for notes, guardians, emergency contacts,
  medical information and attendance safety alerts.
- Added expenses, expense payments, suppliers, financial accounts and recurring expenses.
- Added Kiwibank CSV import, duplicate fingerprints, review states, payment and
  expense matching, matching rules and account reconciliation.
- Added reports for students, attendance, family balances and finance,
  including print and CSV export.
- Added communication history and follow-up task management.
- Added encrypted manual backups using PBKDF2-SHA256 and AES-256-GCM,
  validation, history and controlled merge restore.
- Added audit history, recycle-bin recovery, registered-device review and
  sync-conflict review.
- Added payment receipts and payment reversal controls.
- Added authorised-user and role management with safeguards that prevent
  removal of the last active Administrator.
- Applied the saved inactivity timeout immediately after settings changes.
- Updated the service-worker cache to version 1.0.0.
- Preserved the working Microsoft personal-account login flow.
- Preserved the existing live `config.js`; this upgrade contains no secret keys.
- No household finance data or household Supabase configuration is included.

## 0.4.0 — First functional modules

- Added Settings, Families, Students, Terms, Sessions, Attendance,
  Fee Schedules, Charges, Payments and Invoices.
- Added in-app PWA installation support.

## 0.3.3 — Microsoft personal-account authentication repair

- Fixed the Supabase Azure personal-account login flow.
