# Upgrade Instructions — v0.4.0

This is an upgrade patch for the existing JKA GardenCity Dojo Manager v0.3.3.

## Important

The patch deliberately does **not** contain `config.js`.

Your existing dojo Supabase URL and publishable key will remain unchanged.

No new SQL script is required. The existing Stage 2 database already contains the tables, functions, triggers and Row Level Security policies used by these modules.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload every file and folder inside the extracted patch.
5. Use commit message:

   `Add first functional dojo modules v0.4.0`

6. Commit directly to `main`.
7. Wait for the GitHub Pages deployment to show a green tick.

## Refresh

1. Close every open Dojo Manager tab.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=0.4.0`

3. Press `Ctrl + F5` once.
4. Confirm the bottom-left version shows `0.4.0`.

## First tests

Use fictional records first:

1. Open Settings and save the dojo defaults.
2. Create a fictional family and guardian.
3. Create two fictional sibling students.
4. Create a term.
5. Generate Tuesday and Thursday sessions.
6. Create the versioned fee schedule.
7. Add fictional charges.
8. Record one family payment and split it between the sibling charges.
9. Create and print an invoice.
10. Record attendance for a fictional session.

## Install the app

When Edge reports that the PWA is installable, the app displays an **Install app** button on the login screen or top bar.

If the button does not appear:

1. Open the Edge three-dot menu.
2. Select **Apps**.
3. Select **Install JKA GardenCity Dojo Manager**.
