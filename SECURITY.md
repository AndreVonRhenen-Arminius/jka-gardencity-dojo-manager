# Security Notes — v1.3.1

- Akahu tokens remain stored only as Supabase Edge Function secrets.
- The browser app does not receive Akahu tokens.
- The Supabase service-role key is used only server-side in the Edge Function runtime.
- Kiwibank usernames, passwords, PINs, card numbers and authentication codes are not stored.
- The cursor fix does not expose provider metadata beyond safe error status/path/message information.
- The app continues to require the existing Microsoft/Supabase login.
