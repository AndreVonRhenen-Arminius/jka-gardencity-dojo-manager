# Upgrade Instructions — v1.2.1

This patch corrects Tuesday and Thursday session dates that were displayed
one day late.

## Cause

The database already stored the correct dates. The browser formatter treated a
date-only value as a UTC time and then converted it to New Zealand time. That
moved Tuesday to Wednesday and Thursday to Friday on screen.

## Important

- Do not delete or regenerate existing sessions.
- No SQL needs to be run.
- The ZIP does not contain `config.js`.
- Your Supabase key and Microsoft login settings remain unchanged.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted folder.
5. Use commit message:

   `Fix Tuesday and Thursday session dates v1.2.1`

6. Commit directly to `main`.
7. Wait for the GitHub Pages deployment to show a green tick.

## Open the corrected version

1. Close all browser tabs and installed Dojo Manager windows.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.2.1`

3. Press `Ctrl + F5`.
4. Confirm the bottom-left corner shows `Version 1.2.1`.
5. Open **Sessions** and **Attendance**.
6. Confirm the generated dates display on Tuesdays and Thursdays.
