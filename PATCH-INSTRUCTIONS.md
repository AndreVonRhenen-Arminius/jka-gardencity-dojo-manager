# JKA Dojo Manager Fix — v1.0.1

This patch fixes the Family form and prevents accidental dialog closure.

## Important

- The ZIP does not contain `config.js`.
- Your Supabase publishable key remains unchanged.
- No SQL needs to be run.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted folder.
5. Commit directly to `main` using:

   `Fix family creation dialog v1.0.1`

6. Wait for the GitHub Pages deployment to show a green tick.

## Refresh and test

1. Close all browser and installed-app windows for Dojo Manager.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.0.1`

3. Press `Ctrl + F5` once.
4. Confirm the version shows `1.0.1`.
5. Open **Families & Guardians → Add family**.
6. Click beside the dialog and confirm it stays open.
7. Create a fictional family and confirm it appears in the list.

If Supabase rejects the save, the exact error now appears inside the dialog.
