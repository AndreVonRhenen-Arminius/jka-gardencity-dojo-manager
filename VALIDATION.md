# Validation — v1.0.0

Completed before packaging:

- JavaScript syntax validation passed for every module and the service worker.
- The web manifest parses as valid JSON.
- Every local JavaScript import resolves to a file in the release.
- Every service-worker app-shell file exists.
- The login page and complete module import graph load in headless Chromium.
- The patch excludes `config.js`.
- The patch contains no Supabase service-role key, Microsoft client secret,
  database password, banking password, PIN or card credential.
- The patch uses the separate JKA Supabase project configuration already live.
- The service-worker cache is unique to version 1.0.0.
- No household Finance PWA records or configuration are included.
- Existing Stage 2 tables, functions, triggers and RLS policies cover this release;
  no database migration is required.

Operational testing with fictional records is still required after deployment,
because live Supabase permissions and browser installation behaviour can only be
fully confirmed in the deployed environment.
