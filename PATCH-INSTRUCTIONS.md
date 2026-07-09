# Upgrade Instructions — v1.1.1

This patch adds safe family deletion to the working Student Hub release.

## Important

- The ZIP does not contain `config.js`.
- Your Supabase key and Microsoft login settings will not be overwritten.
- No SQL needs to be run.

## Upload

1. Extract the ZIP.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted folder.
5. Use commit message:

   `Add safe family deletion v1.1.1`

6. Commit directly to `main`.
7. Wait for the GitHub Pages deployment to show a green tick.

## Open the update

1. Close all Dojo Manager tabs and installed-app windows.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.1.1`

3. Press `Ctrl + F5`.
4. Confirm the bottom-left version is `1.1.1`.

## Delete an accidental family

1. Open **Families & Guardians**.
2. Find the unused family.
3. Select **Delete family**.
4. Review the dependency check.
5. Leave guardian cleanup selected when the guardian is also an unused test record.
6. Confirm deletion.

A family with students or historical records will not be deleted. Archived families
can be recovered through Audit History.
