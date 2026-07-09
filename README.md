# JKA GardenCity Dojo Manager

A secure, installable Progressive Web App for **JKA Christchurch – GardenCity**.

## Release

Version **1.0.0** completes the approved dojo-management scope.

## Functional areas

- Dashboard
- Students and protected student records
- Families and guardians
- Enquiries and trials
- Attendance
- Terms and training sessions
- Gradings
- Progress and goals
- Fees, charges and ledgers
- Payments, allocations, receipts and invoices
- Expenses and recurring expenses
- Banking imports, matching and reconciliation
- Reports and CSV export
- Communication history and follow-ups
- Encrypted backup and controlled restore
- Audit history, recycle bin and conflict review
- Dojo settings and authorised-user management
- PWA installation

## Security

- Microsoft authentication through the separate dojo Supabase project
- Application allowlist and role checks
- Row Level Security on all public application tables
- Protected medical information
- Audit history for important changes
- Thirty-minute default inactivity sign-out, configurable in Settings
- No service-role key or Microsoft client secret in browser code
- No connection to Fortnight Finance

## Upgrade

This release is supplied as an upgrade patch. It deliberately excludes
`config.js`, so the working live Supabase URL and publishable key are preserved.

See:

- `PATCH-INSTRUCTIONS.md`
- `docs/USER-GUIDE.md`
- `docs/FINAL-TEST-CHECKLIST.md`
