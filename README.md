# JKA GardenCity Dojo Manager

Secure, installable Progressive Web App for **JKA Christchurch – GardenCity**.

## Starter release

Version **0.4.0** provides:

- Microsoft sign-in through the separate dojo Supabase project
- Authorised-user allowlist enforcement
- Administrator role detection
- Dark charcoal and JKA red interface
- Dashboard shell with live database counts
- Grouped navigation for dojo administration and finances
- 30-minute inactivity sign-out
- PWA manifest and service worker
- Separate browser storage, cache and configuration identifiers
- No connection to Fortnight Finance

The business modules are intentionally presented as secured shells in this starter release. They will be implemented in controlled stages.

## Required configuration

Open `config.js` and replace:

```text
PASTE_DOJO_SUPABASE_PUBLISHABLE_KEY_HERE
```

with the **publishable key** from the new dojo Supabase project.

Do not use:

- the service-role key
- a Microsoft client secret
- the database password
- any household Supabase key

## Deployment

Upload the contents of this folder to the root of:

`jka-gardencity-dojo-manager`

Then enable GitHub Pages from:

- Branch: `main`
- Folder: `/(root)`

Published URL:

`https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/`

See `docs/setup-guide.md`.


## Functional modules in v0.4.0

- Settings
- Families and Guardians
- Students
- Terms and generated sessions
- Sessions
- Attendance
- Versioned fees and charges
- Payments and allocations
- Invoices and printing
- In-app installation prompt
