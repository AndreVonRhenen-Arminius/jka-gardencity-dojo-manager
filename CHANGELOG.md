# Change Log

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
