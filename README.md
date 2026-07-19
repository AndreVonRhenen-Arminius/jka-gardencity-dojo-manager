# JKA GardenCity Dojo Manager

Secure dojo administration and finance PWA for JKA GardenCity.

## Current version

Version **1.3.0** adds the Kiwibank Sync account-mapping user interface.

## Bank-sync security model

- Kiwibank credentials are never stored by the app.
- Akahu token values are stored only as Supabase Edge Function secrets.
- Browser JavaScript calls only the deployed `kiwibank-sync` function.
- Only the selected dojo Kiwibank account should be mapped.
- CSV import remains available as a fallback.
- Uncertain transactions go to review instead of being guessed.
- Transfers remain visible but are excluded from dojo income and expenses.

## Required setup order

1. Database prep SQL completed.
2. Edge Function deployed.
3. Supabase secrets set.
4. Upload this v1.3.0 app patch.
5. Redeploy the `kiwibank-sync` Edge Function from the updated source.
6. Open Banking → Kiwibank Sync and map only the dojo account.
7. Run a 7-day test sync first.
