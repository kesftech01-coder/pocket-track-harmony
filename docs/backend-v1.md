# Pocket Track backend v1

## Scope

The first backend milestone records pocket-money payment notifications and matches them to students through verified authorized payers. It does not move, store, or process funds.

## Flow

1. A school registers students.
2. Authorized payers are registered with phone numbers and relationships.
3. A payer is linked to one or more students.
4. A payment notification is ingested with an external transaction ID.
5. The database prevents the same transaction ID from being credited twice for the same school.
6. Matching uses the normalized sender phone number and only `verified` payers.
7. If exactly one active student is linked to the payer, the payment becomes `matched` and one immutable ledger credit is created.
8. If no payer matches, the payment becomes `unmatched`.
9. If a verified payer maps to multiple active students, the payment becomes `review` and no student balance changes.

## Important rule

Never infer a student's balance from the current payment table alone. The ledger is the accounting history. A balance is derived from ledger entries.

## Next implementation step

Add authenticated API endpoints for school/student/payer administration and a protected payment-ingestion endpoint that calls `match_pending_payment` after insertion. Then add automated tests for duplicate payments, unknown senders, one-to-one matches, and one-to-many payer relationships.
