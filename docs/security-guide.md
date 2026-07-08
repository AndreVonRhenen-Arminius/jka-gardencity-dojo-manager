# Security Notes

- The dojo uses a separate GitHub repository and Supabase project.
- `config.js` may contain only the public Supabase URL and publishable key.
- Never commit a service-role key, database password or Microsoft client secret.
- Row Level Security is enabled on all public dojo tables.
- Microsoft authentication is not sufficient on its own; the email must also be active in `authorised_users`.
- The starter app signs out after 30 minutes of inactivity.
- Local storage keys use the `jka_dojo_` prefix and do not share Fortnight Finance storage.
- Full medical information is not cached by this starter release.
- Do not enter real student data until login and RLS testing are complete.
