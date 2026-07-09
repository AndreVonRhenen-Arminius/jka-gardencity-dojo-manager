# JKA GardenCity Dojo Manager — v1.2.0

Version 1.2.0 adds a complete dojo Settings profile, automatic term-session synchronisation and linked student-specific billing.

## Main sources of truth

- **Settings:** dojo details, venue, normal class schedule, term calendar, fee defaults, referral rules, invoice preferences and user access.
- **Student Hub:** student, family, guardian, payment plan, custom amount, family position and referral reward status.
- **Terms:** authoritative term dates and calculated payment weeks.
- **Sessions:** individual classes and exceptions.
- **Attendance:** uses the synced Sessions and Student Hub records.
- **Fees & Ledgers:** calculates charges using the linked student billing rules.

## Fee rules included

- $20 per week per student
- $120 per term for the first family member
- $100 per term for each additional family member
- 1 referral: 50% off the next term
- 2 referrals: one free term
- 3 referrals: two free terms
- 4 referrals: free normal training permanently, excluding gasshukus and gradings

The upgrade patch excludes `config.js` and requires no database migration.
