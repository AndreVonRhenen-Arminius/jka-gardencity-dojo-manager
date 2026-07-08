# Change Log

## 0.3.3 — Azure personal-account compatibility repair

- Restored the Microsoft login request to Supabase's documented `email` scope.
- Removed the unnecessary Microsoft Graph `User.Read` request from the client.
- Prepared the app for the Supabase Azure provider workaround that leaves Azure Tenant URL blank, allowing the default `common` endpoint while the Microsoft app registration still limits access to personal Microsoft accounts.
- Updated cache-busting and the service-worker cache version.
- Preserved the live dojo `config.js`.

## 0.3.2 — Microsoft profile permission repair

- Requested additional Microsoft profile scopes while diagnosing the Azure callback failure.

## 0.3.1 — Microsoft sign-in callback repair

- Deferred authenticated database calls outside the Supabase auth callback.
- Improved authentication error handling.
