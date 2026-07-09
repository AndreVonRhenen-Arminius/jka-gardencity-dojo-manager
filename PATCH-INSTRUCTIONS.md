# Upgrade Instructions — Student Hub v1.1.0

This patch upgrades the working JKA GardenCity Dojo Manager v1.0.2 installation.

## Important

- The ZIP deliberately does **not** contain `config.js`.
- Your Supabase publishable key and working Microsoft login configuration are preserved.
- No SQL needs to be run.
- Upload the extracted contents, not the ZIP file itself.

## Upload to GitHub

1. Extract `JKA-Dojo-Manager-Student-Hub-v1.1.0.zip`.
2. Open the GitHub repository `jka-gardencity-dojo-manager`.
3. Open **Code**.
4. Select **Add file → Upload files**.
5. Select everything inside the extracted patch folder.
6. Upload the selected files and folders.
7. Use the commit message:

   `Add linked Student Hub and email drafts v1.1.0`

8. Commit directly to `main`.
9. Open **Actions** and wait for the Pages deployment to show a green tick.

## Load the new release

1. Close every browser tab and installed Dojo Manager window.
2. Open:

   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=1.1.0`

3. Press `Ctrl + F5` once.
4. Confirm the bottom-left corner shows **Version 1.1.0**.

## New default workflow

Use **Student Hub** as the main add and edit section.

1. Select **Add student & family**.
2. Enter student details.
3. Select an existing family or create a new one in the same form.
4. Select an existing primary guardian or create one in the same form.
5. Save once.
6. The same linked record appears automatically in all other modules.

Use **Profile & missing info** for:

- emergency contacts
- protected medical information
- student-specific notes
- attendance safety alerts
- automatic missing-information email drafts

Use **Families & Guardians** mainly as a linked directory or to add an additional guardian.

## Test with fictional records first

1. Create a fictional student with a new family and guardian.
2. Confirm the student appears in Attendance, Gradings, Progress, Fees, Reports and Communication.
3. Edit the guardian email in Student Hub.
4. Confirm the updated email appears in the student profile and invoice-related views.
5. Leave several fields blank and test the automatic missing-information email draft.
