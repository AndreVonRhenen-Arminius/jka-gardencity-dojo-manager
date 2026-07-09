# Change Log

## 1.1.0 — Linked Student Hub and missing-information email drafts

- Renamed Students to **Student Hub** and made it the default source of truth.
- Added one guided master form for the student, family, billing details and primary guardian.
- Linked the student record to Attendance, Gradings, Progress, Fees, Payments, Invoices, Banking, Reports and Communication through the existing database IDs.
- Added automatic guardian-to-family and guardian-to-student synchronisation.
- Added family and guardian duplicate checks using student names, dates of birth, family names, email addresses and mobile numbers.
- Changed Families & Guardians into a linked directory with Student Hub as the preferred editor.
- Retained advanced family editing and additional-guardian linking for exceptional cases.
- Added profile completeness scoring to the Student Hub list.
- Added a missing-information checklist to each student profile.
- Added automatic parent or guardian email drafts based on the exact missing information.
- Added Copy email, Open in email app, and Log request with seven-day follow-up actions.
- Added explicit Granted, Declined and Not confirmed photography-consent choices.
- Preserved protected medical, emergency-contact, note and safety-alert sections inside Student Hub.
- No database migration is required.
- The patch excludes `config.js` and does not change the working Microsoft authentication configuration.

## 1.0.2 — Schema compatibility correction

- Corrected belt-rank ordering to use `rank_order`.
- Validated application queries and mutations against the installed Stage 2 schema.

## 1.0.1 — Family dialog correction

- Corrected family and guardian form submission.
- Prevented accidental backdrop clicks from closing forms.
