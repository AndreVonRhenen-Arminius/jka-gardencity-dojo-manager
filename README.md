# JKA GardenCity Dojo Manager

A secure, installable Progressive Web App for **JKA Christchurch – GardenCity**.

## Release

Version **1.1.0** adds a linked Student Hub and automatic missing-information email drafts.

## Main source of truth

**Student Hub** is the default place to add and edit:

- student identity and status
- start date, school and JKA numbers
- current belt and payment plan
- family and billing information
- primary guardian name, email and mobile number
- consent decisions

The database stores these records once and links them by ID. Attendance, Gradings,
Progress, Fees, Payments, Invoices, Banking, Reports and Communication read the
same records rather than maintaining separate copies.

Use **Profile & missing info** within Student Hub for emergency contacts, protected
medical information, student notes, safety alerts and parent or guardian email drafts.

## Missing-information email drafts

The profile checks the saved student, family, guardian, emergency, medical and
consent information. When information is missing, it creates a personalised email
that can be:

- copied
- opened in the default email application
- logged in Communication with a seven-day follow-up task

## Security

- Microsoft authentication through the separate dojo Supabase project
- authorised-user and role checks
- Row Level Security
- protected medical information
- inactivity sign-out
- no service-role key or Microsoft client secret in the browser files
- no connection to Fortnight Finance

See `PATCH-INSTRUCTIONS.md` and `docs/STUDENT-HUB-GUIDE.md`.
