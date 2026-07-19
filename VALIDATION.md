# Validation — v1.3.1

Completed before packaging:

- Confirmed the logged failure was `Akahu API request failed ... Invalid cursor`.
- Located the cursor parser in `supabase/functions/_shared/akahu.ts`.
- Updated cursor handling so only non-empty strings are sent back as the `cursor` query parameter.
- Prevented cursor objects from being converted to `[object Object]`.
- Added safer provider-error detail storage for future diagnostics.
- Confirmed the patch contains no `config.js`.
- Confirmed the patch contains no Akahu token values, Kiwibank credentials or Supabase service-role key values.

Live validation required after deployment:

- Run the 7-day test sync.
- Confirm the error no longer appears.
- Confirm transactions import only from the mapped dojo account.
- Review all suggestions before expanding the lookback period.
