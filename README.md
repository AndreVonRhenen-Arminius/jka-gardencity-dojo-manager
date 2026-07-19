# JKA GardenCity Dojo Manager — Akahu Edge Function Patch v1.2.2

This patch adds the Supabase Edge Function structure for secure read-only Akahu/Kiwibank synchronisation.

## Included

- `supabase/functions/kiwibank-sync/index.ts`
- Shared CORS, auth, Akahu and matching helpers
- `supabase/config.toml`
- Bank-sync setup and security documentation
- Database migration record file for `supabase/07-akahu-bank-sync.sql`

## Not included

- No Akahu tokens
- No Kiwibank credentials
- No Supabase service-role key in browser code
- No change to `config.js`
- No front-end UI changes yet
- No automatic scheduled sync yet

## Function actions

- `status`
- `listAccounts`
- `connectAccount`
- `syncTransactions`
- `disconnectAccount`

The function uses review-first matching. It creates suggestions and does not automatically mark student fees as paid in this stage.
