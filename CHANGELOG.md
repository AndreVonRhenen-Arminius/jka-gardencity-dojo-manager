# Change Log

## 0.3.1 — Microsoft sign-in repair

- Fixed the Microsoft sign-in loop caused by asynchronous Supabase calls inside `onAuthStateChange`.
- Deferred authenticated database checks until after the auth callback completes.
- Improved sign-in error messages.
- Updated service-worker caching so application fixes load reliably.
- Preserved the live dojo `config.js`.

## 0.3.0 — Stage 3 starter

- Added Microsoft authentication through Supabase.
- Added authorised-user profile linking.
- Added administrator role detection.
- Added dark charcoal and red JKA theme.
- Added responsive application shell and grouped navigation.
- Added dashboard with live counts.
- Added 30-minute inactivity sign-out.
- Added PWA manifest and service worker.
- Added separate dojo configuration and storage identifiers.
