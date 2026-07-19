# Project Context — JKA GardenCity Dojo Manager

This application manages JKA GardenCity dojo records, training, fees, payments,
expenses, banking review, reports and backups.

## Current bank-sync stage

Version 1.3.0 introduces the account-mapping UI for Akahu/Kiwibank sync.

## Source of truth

- Student master data: Student Hub
- Family and guardian data: linked records used by Student Hub
- Fee rules: Settings and Fees & Ledgers
- Bank data: Kiwibank Sync via Akahu, with CSV fallback
- Secrets: Supabase Edge Function secrets only

## Non-negotiable separation

This dojo app is separate from André's household finance app. Do not reuse
household Supabase projects, Akahu tokens, bank mappings, matching rules or
GitHub configuration.
