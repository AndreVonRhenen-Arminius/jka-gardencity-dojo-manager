# Change Log

## 0.3.2 — Microsoft profile permission repair

- Requests the Microsoft OpenID Connect scopes required for the user profile endpoint.
- Adds `profile` and Microsoft Graph delegated `User.Read` to the login request.
- Retains the required `openid` and `email` scopes.
- Updates cache-busting and the service-worker cache version.
- Preserves the live dojo `config.js`.

## 0.3.1 — Microsoft sign-in callback repair

- Deferred authenticated database calls outside the Supabase auth callback.
- Improved authentication error handling.
