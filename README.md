# CodeAudit

Professional codebase audit platform for fast-moving SaaS teams that want expert-level security and reliability insights.

## Current Status
- **Beta**: actively evolving with a manual audit-first workflow.
- **Positioning**: high-ticket expert service for founders and startup teams that need confidence before scaling.
- **Delivery model (current)**: expert-led code audit with prioritized report and remediation guidance.

## Pricing Model (Locked)
To match current product maturity and customer needs:

1. **Instant Automated Scan — $99 one-time (coming soon)**
   - Self-serve, lightweight scan path for quick signal.
2. **Expert Code Audit — $1,500 per audit (current focus)**
   - Manual intake + expert review + detailed report.

> Why this split: fully automated scanner pricing in the market is typically lower, while manual/expert audits command premium project-based pricing.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express, TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Integrations**: GitHub API (Octokit), Stripe, Replit connector services

## Run Locally
### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment variables
Create a `.env` file (or export vars in your shell):

```bash
DATABASE_URL=postgres://...
NODE_ENV=development
PORT=5000

# Optional / integration-specific (needed for connector-backed Stripe + GitHub flows)
REPLIT_DOMAINS=...
REPLIT_CONNECTORS_HOSTNAME=...
REPL_IDENTITY=...
WEB_REPL_RENEWAL=...
REPLIT_DEPLOYMENT=0

# Frontend -> hosted backend URL (optional for local dev)
VITE_API_BASE_URL=https://your-backend.example.com

# Security (required in production)
SESSION_SECRET=change-me
DATA_ENCRYPTION_KEY=base64-or-hex-32-byte-key
```

### 3) Push database schema
```bash
npm run db:push
```

### 4) Start dev server
```bash
npm run dev
```

The app runs with Express + Vite together in development mode.

## Project Highlights
- Security, stability, maintainability, scalability, and CI/CD-focused audit findings.
- Severity-ranked issues with business impact framing.
- Premium report workflow with remediation roadmap.

## Beta Access / Contact
If you want beta access to the expert audit service, contact: **beta@codeaudit.dev**.


## Deployment
- Railway + Neon backend deployment guide: `docs/deploy-railway-neon.md`.
- Existing DigitalOcean deployment guide: `docs/deploy-digitalocean.md`.

## Privacy & Retention
- Privacy policy: `docs/privacy-policy.md`
- Retention policy: `docs/retention-policy.md`
- Self-service deletion endpoint: `POST /api/privacy/delete-my-data` with body `{ "confirmation": "DELETE" }` (authenticated).
