# JKA Dojo Manager Schema Fix — v1.0.2

This patch upgrades the working version 1.0.1 installation.

## What it fixes

The installed database uses the belt-rank column `rank_order`. The app was attempting to read and sort by `display_order`, which does not exist. Version 1.0.2 corrects Students and Gradings to use the installed schema.

The patch also retains the version 1.0.1 family-dialog fixes:

- Create Family submits correctly.
- Errors appear inside the dialog.
- Clicking outside the dialog does not discard entered information.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted folder.
5. Use the commit message:

   `Fix schema compatibility and validate app v1.0.2`

6. Commit directly to `main`.
7. Wait for the GitHub Pages deployment to show a green tick.

## Refresh

1. Close all Dojo Manager browser tabs and installed-app windows.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.0.2`

3. Press `Ctrl + F5` once.
4. Confirm the bottom-left corner shows **Version 1.0.2**.
5. Open Students and Gradings and confirm both pages load.

## Important

- No SQL needs to be run.
- `config.js` is not included, so the working Supabase publishable key is preserved.
- Test with fictional records before entering real medical, financial or banking data.
