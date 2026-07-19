# Change Log

## 1.2.2 — Akahu Edge Function foundation

- Added Supabase Edge Function source for `kiwibank-sync`.
- Added explicit request-origin validation.
- Added signed-in Supabase user validation.
- Restricted bank-sync calls to the configured owner user ID.
- Added banking-access confirmation through the existing authorised-user and role model.
- Added Akahu account listing, account connection, manual sync, status and disconnect actions.
- Added review-first transaction import logic.
- Added duplicate checks using Akahu transaction ID and transaction fingerprint.
- Added safe match suggestions for student payments, expenses, transfers and uncategorised transactions.
- Added Supabase config for the function.
- Added setup, security and validation documentation.

No tokens or credentials are included.
