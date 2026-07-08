# Microsoft Profile Permission Fix v0.3.2

This patch addresses:

`Error getting user profile from external provider`

Before uploading this patch, add the following delegated Microsoft Graph permissions to the Microsoft Entra app registration:

- email
- offline_access
- openid
- profile
- User.Read

Then upload all files in this patch to the GitHub repository root.

The patch does not contain `config.js`, so the live Supabase publishable key is preserved.

After GitHub Pages shows a green deployment tick:

1. Close every Dojo Manager tab.
2. Open an Edge InPrivate window.
3. Visit:
   `https://andrevonrhenen-arminius.github.io/jka-gardencity-dojo-manager/?v=0.3.2`
4. Press Ctrl+F5 once.
5. Test Microsoft login again.
