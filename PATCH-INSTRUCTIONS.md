# JKA Dojo Authentication Fix v0.3.1

Replace only the files included in this patch.

The patch deliberately does not contain `config.js`, so the live dojo Supabase publishable key is preserved.

After uploading:
1. Wait for the GitHub Pages deployment to show a green tick.
2. Close all open dojo app tabs.
3. Open the dojo URL with `?v=0.3.1` appended.
4. Press Ctrl+F5 once.
5. Test Microsoft sign-in again.
