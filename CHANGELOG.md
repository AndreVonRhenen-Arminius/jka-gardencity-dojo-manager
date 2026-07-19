# Change Log

## 1.3.0 — Kiwibank Sync account mapping UI

- Added a Banking → Kiwibank Sync panel.
- Added server-side Akahu account loading through the `kiwibank-sync` Edge Function.
- Added account mapping from one selected Akahu/Kiwibank account to one dojo financial account.
- Added 7-day controlled test sync and 30-day manual sync buttons.
- Added disconnect control for the mapped account.
- Added Kiwibank review queue display for possible matches, uncategorised items and transfers.
- Preserved Kiwibank CSV import as a fallback.
- Updated the Edge Function source to remove a duplicate return statement before redeployment.
- Updated service-worker cache to version 1.3.0.
- No Akahu token values, Kiwibank credentials or Supabase service-role keys are included.

## 1.2.2 — Akahu Edge Function foundation

- Added server-side Supabase Edge Function files for Akahu bank sync.
- Added project documentation for bank-sync setup.

## 1.2.1 — Tuesday and Thursday calendar-date correction

- Corrected date-only display throughout the app.
