# JKA GardenCity Dojo Manager — v1.3.1

This is a server-side Akahu/Kiwibank sync maintenance release.

It fixes a cursor-pagination issue in the `kiwibank-sync` Supabase Edge Function. The dojo database, student records, payments, expenses, GitHub Pages configuration and Microsoft sign-in are unchanged.

## Important

- No SQL needs to be run.
- `config.js` is not included.
- Akahu tokens remain only in Supabase Edge Function secrets.
- Kiwibank credentials are never stored by the app.
- CSV import remains available as a fallback.
