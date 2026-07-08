# Final Upgrade Instructions — v1.0.0

This patch upgrades the working JKA GardenCity Dojo Manager v0.4.0 installation.

## Important

- The ZIP deliberately does **not** contain `config.js`.
- Your working Supabase publishable key will not be overwritten.
- No new SQL script is required.
- Do not upload the ZIP file itself. Upload the extracted contents.

## Upload to GitHub

1. Extract `JKA-Dojo-Manager-Final-v1.0.0.zip`.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Open **Code**.
4. Select **Add file → Upload files**.
5. Select everything inside the extracted patch folder.
6. Drag the selected files and folders into GitHub.
7. Use the commit message:

   `Complete JKA Dojo Manager v1.0.0`

8. Commit directly to `main`.
9. Open **Actions** and wait for the Pages deployment to show a green tick.

## Load the release

1. Close every open Dojo Manager browser and installed-app window.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.0.0`

3. Press `Ctrl + F5` once.
4. Sign in with the approved Microsoft account.
5. Confirm the bottom-left corner shows **Version 1.0.0**.

## Installed PWA

If the PWA is already installed, close it fully and reopen it after the
GitHub deployment. The new service worker removes older dojo caches.

## Testing rule

Test the final release using fictional records before adding or importing
real student, medical, payment or banking information.

Use `docs/FINAL-TEST-CHECKLIST.md`.
