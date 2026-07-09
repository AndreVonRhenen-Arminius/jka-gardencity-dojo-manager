# Validation — v1.2.0

Completed before packaging:

- JavaScript syntax validation passed for all modules and the service worker.
- The manifest parses as valid JSON.
- Every local JavaScript import resolves.
- Every service-worker app-shell file exists in the complete deployment tree.
- All referenced database tables exist in the Stage 2 schema.
- The new app-setting keys use the existing `app_settings` JSON structure.
- Student-specific billing uses the existing `student_billing_profiles` table.
- Referral rules use the existing `referral_reward_rules` table.
- Automatic current-term enrolment uses the existing `term_enrolments` table.
- Term synchronisation preserves sessions that already have attendance history.
- The patch excludes `config.js` and contains no secret or service-role key.
- The safe family deletion update remains included.

Live browser and Supabase testing must still be completed using fictional records after deployment.
