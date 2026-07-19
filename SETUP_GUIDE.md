# Setup Guide — v1.3.1

## Purpose

This update corrects Akahu transaction pagination. It does not change the app UI or database schema.

## Required steps

1. Copy the patch files into the local repository folder.
2. Commit the files to GitHub so the repository stays current.
3. Redeploy the `kiwibank-sync` Edge Function using Supabase CLI.
4. Run a 7-day test sync only.
5. Review every imported or suggested transaction.

## No changes required

Do not change these unless troubleshooting proves they are wrong:

- `AKAHU_USER_ACCESS_TOKEN`
- `AKAHU_APP_ID_TOKEN`
- `DOJO_OWNER_USER_ID`
- `DOJO_APP_ORIGIN`
- `DOJO_APP_PATH`
- `config.js`

## Safe test order

1. Confirm the bank connection is still mapped and active.
2. Run a 7-day sync.
3. Confirm there are no personal transactions.
4. Confirm duplicates are not inserted.
5. Confirm possible matches remain in review unless exact.
