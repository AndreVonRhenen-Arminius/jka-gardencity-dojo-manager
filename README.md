# JKA GardenCity Dojo Manager — v1.1.1

This upgrade adds safe deletion for accidental or unused family records.

## Behaviour

- **Delete family** appears in Families & Guardians.
- The app checks linked students and historical records first.
- Used families cannot be deleted.
- Unused families are moved to the recycle bin.
- Unlinked guardian test records can be archived at the same time.
- Shared guardians are preserved.

The patch excludes `config.js` and requires no database migration.
