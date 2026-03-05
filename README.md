# CodeAudit

Professional codebase audit platform for fast-moving SaaS teams that want expert-level security and reliability insights.

## Current Status
- **Beta**: actively evolving with a manual audit-first workflow.
- **Positioning**: high-ticket expert service for founders and startup teams that need confidence before scaling.
- **Delivery model (current)**: expert-led code audit with prioritized report and remediation guidance.

## Pricing Model
Productized for fast purchase decisions and rapid time-to-value:

1. **Quick Triage — $499**
   - 45–60 minute session, top 10 risks, short walkthrough call.
2. **Full Audit — $1,500**
   - Detailed report + remediation roadmap with expert context.
3. **Fix Sprint — $3,000**
   - Implementation of top fixes with production-ready pull requests.

Each engagement starts with an instant scan preview (repo metadata, file tree, 10 heuristic checks, and sample findings), then upgrades into expert review and optional implementation support.

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
- Existing DigitalOcean deployment guide: `docs/deploy-digitalocean.md` (includes `script/vps-deploy-update.sh` for pull/build/restart deploys).

## Privacy & Retention
- Privacy policy: `docs/privacy-policy.md`
- Retention policy: `docs/retention-policy.md`
- Self-service deletion endpoint: `POST /api/privacy/delete-my-data` with body `{ "confirmation": "DELETE" }` (authenticated).

## Scan reliability safeguards

- Queue-based scanning: scan requests are queued and processed asynchronously so API requests return quickly.
- Repository limits: deep scans are bounded by file count and total repository size to prevent timeouts/rate-limit exhaustion on large repos.
- SHA-based tree caching: file tree metadata is cached per commit SHA and reused on repeat scans of the same revision.


## Code formatting and linting

- Prettier and ESLint are enforced in CI (`format:check` + `lint`).
- A Git pre-commit hook under `.githooks/pre-commit` auto-formats/lints staged files and re-adds them to the commit.
- Install hooks locally with `npm run hooks:install` (also runs automatically on `npm install` via `prepare`).
