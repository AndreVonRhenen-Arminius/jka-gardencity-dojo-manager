# Project Context — JKA GardenCity Dojo Manager

## Current application

- App: JKA GardenCity Dojo Manager
- Hosting: GitHub Pages
- Database and auth: Supabase project `ystfxuwuzbdecphovero`
- Login: Microsoft sign-in through Supabase Auth
- Owner/admin login: authorised Microsoft account only
- Bank provider being added: Akahu for a read-only Kiwibank dojo account

## Separation rule

This app must remain separate from the household finance PWA. Do not reuse the household Supabase project, origin, Akahu account mapping, bank rules or database data.

## Bank-sync architecture

```text
Kiwibank
  ↓ authorised read-only consent
Akahu
  ↓ server-side API request
Supabase Edge Function: kiwibank-sync
  ↓ normalised records
Dojo Supabase database
  ↓ Row Level Security
JKA GardenCity Dojo Manager
```

## Safety rules

- Never store Kiwibank username, password, PIN, card details or authentication codes.
- Never store Akahu tokens in GitHub, browser JavaScript, `config.js`, app settings or screenshots.
- Akahu tokens must be stored only as Supabase Edge Function secrets.
- CSV import remains available as a fallback.
- The first live sync must use a 7-day lookback and review-first matching.
