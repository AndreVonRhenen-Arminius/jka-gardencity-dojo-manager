# JKA GardenCity Dojo Manager — v1.2.1

This maintenance update corrects date-only display throughout the app.

The database sessions were generated on the correct Tuesday and Thursday dates.
The previous interface converted those calendar dates through the
Pacific/Auckland timezone, which displayed them one day later.

Version 1.2.1 treats database `date` values as calendar dates. Existing records
are retained and immediately display on the correct weekday after deployment.

The patch excludes `config.js` and requires no SQL.
