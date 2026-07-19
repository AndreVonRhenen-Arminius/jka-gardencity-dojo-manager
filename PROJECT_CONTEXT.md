# Project Context — JKA GardenCity Dojo Manager v1.3.1

This release continues the Akahu/Kiwibank bank-sync implementation for the JKA GardenCity dojo app.

The issue fixed in this release was identified from the Supabase Edge Function log:

```text
Akahu API request failed. details: path=/accounts/{accountId}/transactions; status=400; message=Invalid cursor
```

The fix is limited to Edge Function pagination/error handling. It does not alter student, fee, payment, attendance or authentication workflows.
