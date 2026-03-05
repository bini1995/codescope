# Data Retention Policy (CodeAudit / CodeScope)

_Last updated: 2026-03-05_

## Default retention windows
- Account records: retained while account is active.
- Audit records (intake, findings, report artifacts): retained while account is active.
- Stripe webhook/payment linkage metadata: retained for financial reconciliation and fraud prevention.
- Operational logs: retained according to infrastructure logging defaults.

## User-initiated deletion
When an authenticated user submits:

`POST /api/privacy/delete-my-data` with `{ "confirmation": "DELETE" }`

we delete:
- user profile/auth record,
- audits tied to the user,
- findings tied to those audits.

## Exceptions
Data may be retained where required by law, security investigations, or payment dispute/compliance obligations.

## Policy review
This policy is reviewed periodically and updated as product/data practices evolve.
