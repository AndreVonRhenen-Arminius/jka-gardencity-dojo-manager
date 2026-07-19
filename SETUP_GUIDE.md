# Setup Guide — Akahu/Kiwibank Sync v1.3.0

## Prerequisites

- Supabase database preparation has passed verification.
- `kiwibank-sync` Edge Function exists.
- Supabase secrets are set:
  - `AKAHU_USER_ACCESS_TOKEN`
  - `AKAHU_APP_ID_TOKEN`
  - `DOJO_APP_ORIGIN`
  - `DOJO_APP_PATH`
  - `DOJO_OWNER_USER_ID`
  - `DOJO_CRON_SECRET`
- Kiwibank is connected in MyAkahu.
- An encrypted dojo backup has been created.

## GitHub Pages upload

1. Extract the v1.3.0 patch ZIP.
2. Open the GitHub repository.
3. Upload everything inside the extracted folder.
4. Commit directly to `main`.
5. Wait for GitHub Pages deployment to finish.
6. Open `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.3.0`.
7. Press `Ctrl + F5`.

## Edge Function redeploy

From the local repository root, run:

```powershell
npx.cmd supabase functions deploy kiwibank-sync --project-ref ystfxuwuzbdecphovero
```

Then verify:

```powershell
npx.cmd supabase functions list --project-ref ystfxuwuzbdecphovero
```

## Account mapping

1. Open the app.
2. Go to **Banking**.
3. Select **Kiwibank Sync**.
4. Select **Load Akahu accounts**.
5. Select only the dojo Kiwibank account.
6. Map it to the dojo financial account, for example `Kiwibank Dojo Account`.
7. Save mapping.

Do not map personal or household accounts.

## Controlled test

1. Create an encrypted backup.
2. Run **7-day test sync**.
3. Compare each imported transaction to Kiwibank.
4. Confirm no personal transactions were imported.
5. Confirm duplicates are ignored.
6. Review possible matches and uncategorised items.
7. Do not run a 30-day import until the 7-day test is correct.
