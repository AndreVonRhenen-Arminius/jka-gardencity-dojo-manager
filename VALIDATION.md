# Validation — v1.2.1

Completed before packaging:

- JavaScript syntax checks passed for every module and the service worker.
- The manifest parses as valid JSON.
- Every local JavaScript import resolves.
- PostgreSQL date-only values are formatted as calendar dates in UTC,
  preventing New Zealand timezone conversion from adding one day.
- Test dates:
  - 2026-07-21 displays as Tuesday.
  - 2026-07-23 displays as Thursday.
  - 2026-10-13 displays as Tuesday during New Zealand daylight saving.
  - 2026-10-15 displays as Thursday during New Zealand daylight saving.
- The patch excludes `config.js`.
- No secret keys or credentials are included.
- No SQL migration is required.
