# Setup Guide — Akahu Edge Function v1.2.2

## Stage A — Apply this patch to the repository

1. Extract the ZIP.
2. Upload the extracted contents to the root of the GitHub repository.
3. Commit directly to `main`.
4. Keep `config.js` unchanged.

## Stage B — Deploy the Edge Function

Run these commands from the local repository folder, not in Supabase SQL Editor:

```powershell
supabase --version
supabase login
supabase link --project-ref ystfxuwuzbdecphovero
supabase functions deploy kiwibank-sync --project-ref ystfxuwuzbdecphovero
```

## Stage C — Add non-token secrets first

```powershell
supabase secrets set DOJO_APP_ORIGIN=https://andrevonrhenen-arminius.github.io --project-ref ystfxuwuzbdecphovero
supabase secrets set DOJO_APP_PATH=/jka-gardencity-dojo-manager/ --project-ref ystfxuwuzbdecphovero
supabase secrets set DOJO_OWNER_USER_ID=<YOUR_SUPABASE_AUTH_USER_UUID> --project-ref ystfxuwuzbdecphovero
supabase secrets set DOJO_CRON_SECRET=<GENERATE_A_LONG_RANDOM_VALUE> --project-ref ystfxuwuzbdecphovero
```

Do not set Akahu token secrets until the function is deployed and you are ready for account testing.

## Stage D — Later Akahu token secrets

After MyAkahu is prepared:

```powershell
supabase secrets set AKAHU_USER_ACCESS_TOKEN=<DO_NOT_SHARE> --project-ref ystfxuwuzbdecphovero
supabase secrets set AKAHU_APP_ID_TOKEN=<DO_NOT_SHARE> --project-ref ystfxuwuzbdecphovero
```

Do not paste the token values into chat.

## Stage E — First sync rule

The first live sync must be a 7-day lookback and review-first. Do not enable scheduled sync until manual matching has been validated.
