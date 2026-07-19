# Validation — v1.2.2

Completed before packaging:

- Database preparation verification screenshot showed all PASS.
- Edge Function source contains only secret variable names and no Akahu token values.
- Patch contains no Kiwibank credentials, PINs, card details or authentication codes.
- Patch does not include `config.js`.
- JavaScript/TypeScript brace and import-path validation completed.
- Function uses server-side Supabase service role only inside the Edge Function.
- Function does not expose Akahu tokens in responses.
- Function imports completed transactions into the existing banking tables and creates review suggestions.
- CSV import remains unchanged.

Live validation still required after deployment:

- Deploy function to Supabase.
- Add secrets.
- List Akahu accounts.
- Connect only the dojo Kiwibank account.
- Run a 7-day manual sync.
- Compare imported transactions with Kiwibank.
