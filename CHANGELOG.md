# Change Log

## 1.3.2 — Receipt instructor-name correction

- Prevented the receipt and invoice contact block from displaying the instructor name twice when the saved instructor title already includes the full name.
- The contact block now displays `Sensei André Von Rhenen` once.
- Updated browser cache-busting references and the service-worker cache version so GitHub Pages clients receive the corrected receipt template.
- No database migration or Supabase Edge Function deployment is required.

## 1.3.1 — Akahu cursor pagination fix

- Fixed Akahu transaction pagination when the API response includes cursor metadata as an object.
- Prevents the Edge Function from sending an invalid cursor value back to Akahu.
- Fixes the observed sync error: `Akahu API request failed ... Invalid cursor`.
- Stores safer, more specific provider error details in `bank_sync_runs.error_message` without exposing tokens.
- No database migration is required.
- No browser configuration, Akahu token, Kiwibank credential or `config.js` value is included.

## 1.3.0 — Akahu account mapping UI

- Added Banking → Kiwibank Sync panel.
- Added account loading, mapping, manual test sync and review queue display.
