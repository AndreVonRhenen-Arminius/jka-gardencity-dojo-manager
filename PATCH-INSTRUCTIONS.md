# Azure Personal-Account Compatibility Fix v0.3.3

This patch addresses the Supabase Azure callback error:

`Error getting user profile from external provider`

Required Supabase setting before testing:

1. Open Authentication → Sign In / Providers → Azure.
2. Delete the entire value in **Azure Tenant URL**.
3. Leave the field blank so Supabase uses its default `common` endpoint.
4. Keep Azure enabled.
5. Keep Allow users without an email turned off.
6. Save the provider settings.

The Microsoft app registration can remain set to **Personal Microsoft accounts only**. Microsoft Entra will still limit who can authenticate.

Upload all files in this patch to the GitHub repository root. The patch deliberately does not contain `config.js`.

After deployment:

1. Wait for the GitHub Pages deployment to show a green tick.
2. Close all Dojo Manager tabs.
3. Open an Edge InPrivate window.
4. Visit:
   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=0.3.3`
5. Press Ctrl+F5 once.
6. Test Microsoft sign-in again.
