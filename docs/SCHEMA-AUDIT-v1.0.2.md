# Schema Audit — v1.0.2

The application was checked against the installed Stage 2 SQL files.

## Checked

- 70 public database tables
- Explicit selected columns
- Filter and ordering columns
- Direct insert, update and upsert fields
- 69 public database functions and RPC parameter names
- Hard-coded filtered status values against database constraints
- Backup table names
- JavaScript syntax for all 28 application modules
- JavaScript module imports
- Service-worker app-shell references
- Web manifest JSON
- Dialog HTML structure and nested-form protection
- Exclusion of `config.js` and secret keys

## Corrected

The database table `belt_ranks` uses:

`rank_order`

The Students and Gradings modules incorrectly used:

`display_order`

Both modules now use `rank_order`.

## Result

All automated static checks passed after the correction.

Live Supabase writes and Row Level Security should still be tested with fictional records after deployment.
