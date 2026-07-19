# Patch Instructions — v1.3.0

This patch adds the Kiwibank Sync account-mapping UI and updates the Edge Function source.

## Upload to GitHub

1. Extract the ZIP.
2. Upload all extracted files and folders to the repository root.
3. Commit message:

   `Add Kiwibank Sync account mapping v1.3.0`

4. Wait for GitHub Pages deployment.

## Redeploy Edge Function

From the repository root:

```powershell
npx.cmd supabase functions deploy kiwibank-sync --project-ref ystfxuwuzbdecphovero
```

## Open app

```text
https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.3.0
```

Press `Ctrl + F5`.

## Use

Open **Banking → Kiwibank Sync**, load Akahu accounts, select only the dojo Kiwibank account, save mapping, then run the 7-day test sync.
