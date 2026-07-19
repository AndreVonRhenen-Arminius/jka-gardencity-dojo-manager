# Patch Instructions — v1.3.1

This patch fixes the Akahu `Invalid cursor` error during transaction sync.

## Upload to GitHub

1. Extract `JKA-Dojo-Akahu-Cursor-Fix-v1.3.1.zip`.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted patch folder.
5. Use commit message:

   `Fix Akahu cursor pagination v1.3.1`

6. Commit directly to `main`.

## Redeploy the Edge Function

From the local repository folder, run:

```powershell
npx.cmd supabase functions deploy kiwibank-sync --project-ref ystfxuwuzbdecphovero
```

Then confirm:

```powershell
npx.cmd supabase functions list --project-ref ystfxuwuzbdecphovero
```

The function should show `kiwibank-sync | ACTIVE`, with an increased version number.

## Test

1. Open the app.
2. Go to **Banking → Kiwibank Sync**.
3. Run only the **7-day test sync**.
4. Check the sync summary and review queue.
5. Do not run the 30-day sync until the 7-day result is correct.
