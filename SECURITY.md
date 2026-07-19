# Security — Akahu/Kiwibank Sync

## Protected data

The application must never store:

- Kiwibank username
- Kiwibank password
- PIN
- card number
- card security code
- authentication codes
- Akahu token values in GitHub, browser JavaScript, `config.js`, screenshots or chat

## Secrets

Akahu token values must be stored only as Supabase Edge Function secrets:

- `AKAHU_USER_ACCESS_TOKEN`
- `AKAHU_APP_ID_TOKEN`

## Access controls

- Existing Microsoft sign-in remains required.
- The Edge Function restricts access to `DOJO_OWNER_USER_ID`.
- Browser code does not contain the Supabase service-role key.
- Manual sync requires a signed-in authorised user.
- Scheduled sync will require `DOJO_CRON_SECRET`.

## Operational controls

- Map only the dojo Kiwibank account.
- Start with a 7-day test.
- Review uncertain matches.
- Keep CSV import as a fallback.
- Disconnect in the dojo app and revoke consent in MyAkahu if required.
