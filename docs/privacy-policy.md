# Privacy Policy (CodeAudit / CodeScope)

_Last updated: 2026-03-05_

## What we collect
When you use the audit platform, we store:
- Account information: email, full name, password hash.
- Audit intake data: repository URL, stack, deployment target, contact name, contact email, and concerns you submit.
- Audit artifacts: repository metadata, file tree summaries, scan logs, findings, and generated scores/reports.
- Billing metadata: Stripe checkout/session IDs and payment status.

## How we use data
We use this data to:
- authenticate users and secure accounts,
- run and deliver code audits,
- provide remediation guidance,
- process and reconcile billing,
- support operations and abuse prevention.

We do **not** sell personal data.

## Encryption and security controls
- Session authentication uses server-side sessions with secure cookie settings.
- Sensitive audit fields are encrypted at rest at the application layer (including `contactEmail`, `fileTree`, and `scanLog`) before being written to the database.
- Access to customer data is limited to authorized application/runtime access and operational personnel with legitimate need.

## Who can access data
Data may be accessed by:
- the authenticated account owner,
- authorized operators/engineers for support, incident response, and platform maintenance,
- subprocessors necessary to provide the service (e.g., hosting, database, billing provider).

## Your choices and deletion
You can request deletion of your account data from within the app using the self-service delete endpoint:
- `POST /api/privacy/delete-my-data`
- authenticated request body: `{ "confirmation": "DELETE" }`

This deletes the user account and associated audits/findings.

## Contact
For privacy questions or requests, contact: **privacy@codeaudit.dev**.
