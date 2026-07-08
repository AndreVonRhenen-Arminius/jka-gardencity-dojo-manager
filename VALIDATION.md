# Validation — v0.4.0

Validated before packaging:

- `index.html` contains HTML.
- `manifest.webmanifest` parses as JSON.
- `css/styles.css` contains the dark charcoal and JKA red interface.
- JavaScript module files pass syntax validation.
- `sw.js` uses the unique dojo cache `jka-dojo-manager-v0.4.0`.
- The patch does not include `config.js`.
- No service-role key, Microsoft secret, database password or banking credential is included.
- No household finance records or household configuration are included.
- Microsoft login remains configured for the working personal-account flow.
- Existing Stage 2 tables and Row Level Security policies are used; no database migration is required.
