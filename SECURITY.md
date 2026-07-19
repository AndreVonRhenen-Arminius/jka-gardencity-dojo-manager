# Security — Akahu / Kiwibank Sync

## Credentials

Do not put any of these in GitHub, chat, screenshots, `config.js`, browser JavaScript or app settings:

- Kiwibank username
- Kiwibank password
- Kiwibank PIN
- Card details
- Authentication codes
- Akahu User Access Token
- Akahu App ID Token
- Supabase service-role key

## Required Supabase secrets

These must be stored as Supabase Edge Function secrets:

```text
AKAHU_USER_ACCESS_TOKEN
AKAHU_APP_ID_TOKEN
DOJO_OWNER_USER_ID
DOJO_APP_ORIGIN
DOJO_APP_PATH
DOJO_CRON_SECRET
```

## Access controls

The function checks:

1. Exact app origin for browser requests.
2. Valid signed-in Supabase user JWT for user actions.
3. Supabase user ID equals `DOJO_OWNER_USER_ID`.
4. User has authorised banking access in the dojo database.
5. Akahu tokens are read only from server-side secrets.

## Review-first policy

This stage does not automatically mark fees as paid. Transactions are imported and suggestions are created for review.

## Disconnect

The app-level disconnect marks the dojo account mapping as disconnected. Revoke Akahu access separately in MyAkahu when required.
