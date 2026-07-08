# Setup Guide — Starter v0.3.0

## 1. Add the Supabase publishable key

1. Open the **JKA GardenCity Dojo Manager** project in Supabase.
2. Open **Project Settings**.
3. Open **API Keys**.
4. Copy the browser-safe **Publishable key**.
5. Do not copy the `service_role` or secret key.
6. Open `config.js`.
7. Replace:

   `PASTE_DOJO_SUPABASE_PUBLISHABLE_KEY_HERE`

   with the publishable key.
8. Save `config.js`.

The Supabase project URL and GitHub Pages URL are already set for this dojo project.

## 2. Upload to GitHub

1. Extract the ZIP.
2. Open the extracted folder.
3. Confirm `index.html` is visible immediately.
4. Open the GitHub repository `jka-gardencity-dojo-manager`.
5. Open **Code**.
6. Select **Add file → Upload files**.
7. Select all contents inside the extracted folder.
8. Upload them to the repository root.
9. Use commit message:

   `Initial JKA Dojo Manager starter app v0.3.0`

10. Commit directly to `main`.

## 3. Enable GitHub Pages

1. Open **Settings → Pages**.
2. Set Source to **Deploy from a branch**.
3. Select branch `main`.
4. Select folder `/(root)`.
5. Select **Save**.
6. Wait for the deployment to finish.
7. Keep **Enforce HTTPS** enabled.

## 4. Confirm Supabase URL configuration

Site URL:

`https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/`

Redirect URLs:

- `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/`
- `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/index.html`

Remove any redirect URL ending in `.git`.

## 5. Test Microsoft login

1. Open the published site in Microsoft Edge.
2. Select **Sign in with Microsoft**.
3. Use `andrevonrhenen83@gmail.com`.
4. Confirm the dashboard opens.
5. Confirm the role shows **Administrator**.
6. Confirm no household finance information appears.

## 6. Install as a PWA

1. Open the deployed site in Edge.
2. Open the Edge menu.
3. Select **Apps**.
4. Select **Install JKA GardenCity Dojo Manager**.
