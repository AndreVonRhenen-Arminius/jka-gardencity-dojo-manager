# Validation — v1.3.0

Completed before packaging:

- JavaScript syntax check passed for every browser module.
- `js/kiwibank-sync.js` uses Supabase Functions only and contains no token values.
- `js/banking.js` preserves CSV import, matching rules and reconciliation.
- The Kiwibank Sync panel only calls the Edge Function.
- The service-worker cache version is `jka-dojo-manager-v1.3.0`.
- `config.js` is excluded from the patch.
- No Akahu token values, bank credentials or service-role key values are included.
- The Edge Function duplicate-return source issue was corrected for redeployment.

Live validation still required:

- Load Akahu accounts from the deployed app.
- Map only the dojo Kiwibank account.
- Run the 7-day controlled sync.
- Compare imported records to Kiwibank.
