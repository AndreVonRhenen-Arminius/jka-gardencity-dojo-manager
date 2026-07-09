# Upgrade Instructions — v1.2.0

This patch upgrades the working JKA GardenCity Dojo Manager v1.1.1 installation.

## Important

- The ZIP does **not** contain `config.js`.
- Your Supabase publishable key and Microsoft login settings are preserved.
- No SQL needs to be run. Version 1.2.0 uses tables already installed during Stage 2.
- Upload the extracted contents, not the ZIP file itself.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted folder.
5. Use commit message:

   `Add dojo settings term sync and student billing v1.2.0`

6. Commit directly to `main`.
7. Open **Actions** and wait for the Pages deployment to show a green tick.

## Open the update

1. Close all browser tabs and installed-app windows for the Dojo Manager.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.2.0`

3. Press `Ctrl + F5` once.
4. Confirm the bottom-left corner shows **Version 1.2.0**.

## First setup after upgrading

1. Open **Settings**.
2. Complete the dojo contact and address fields.
3. Confirm the normal training days, times and venue.
4. Enter the Term 1–4 dates for 2026.
5. Confirm the fee and referral rules.
6. Select **Save settings and sync terms**.
7. Open **Terms** and confirm the calculated payment weeks.
8. Open **Attendance** and confirm the generated sessions appear.
9. Open **Student Hub**, edit a fictional student and confirm the fee preview.
10. Open **Fees & Ledgers** and create a fictional term or weekly charge.

Use fictional records before applying the workflow to real payments.
