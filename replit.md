# CodeScope - Professional Code Audit Platform

## Overview
CodeScope is a SaaS code audit tool that analyzes GitHub repositories for security vulnerabilities, hallucinated dependencies, maintainability issues, scalability bottlenecks, and CI/CD gaps. It produces premium audit reports with severity-ranked findings, business impact analysis, and 14-day remediation roadmaps.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI (Vite)
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Integrations**: GitHub (via Replit connector for OAuth, @octokit/rest), Stripe (via Replit connector for payments)

## Key Files
- `shared/schema.ts` - Data models: audits, findings tables
- `server/routes.ts` - API endpoints for audits, findings, Stripe checkout, and GitHub operations
- `server/storage.ts` - DatabaseStorage class (Drizzle-based CRUD)
- `server/github.ts` - GitHub OAuth client (Replit connector)
- `server/stripeClient.ts` - Stripe client (Replit connector, never cached)
- `server/webhookHandlers.ts` - Stripe webhook processing (payment confirmation)
- `server/stripe-seed.ts` - Seeds Stripe product: "CodeScope Audit Unlock" at $49
- `server/scanner.ts` - Automated code scanner engine (pattern detection, score generation)
- `server/seed.ts` - Seed data with realistic sample audits
- `client/src/pages/landing.tsx` - Landing page with intake form and repo picker (no pricing)
- `client/src/pages/dashboard.tsx` - Audit management dashboard
- `client/src/pages/audit-detail.tsx` - Full audit report with scan controls, paywall, file tree, scan log
- `client/src/components/finding-card.tsx` - Finding card with paid/free content gating

## Data Model
- **audits**: repo info, contact details, status (pending/in_progress/complete), 5 category scores (0-10), executive summary, remediation plan, repoMeta (JSON), fileTree (JSON), scanLog (JSON), scannedAt, paidAt, stripeSessionId
- **findings**: linked to audit, category (security/stability/maintainability/scalability/cicd), severity (critical/high/medium/low), file references, code snippets, business impact, fix steps, effort (S/M/L), autoDetected flag

## Paywall / Monetization
- **Free tier**: Scan results, findings (title, severity, description, file paths, business impact), risk scores, executive summary, file tree, scan log
- **Paid tier ($49/audit)**: Fix steps for every finding, code evidence/snippets, 14-day remediation roadmap
- Stripe Checkout (one-time payment, not subscription) with `checkout.session.completed` webhook
- API-level enforcement: `/api/audits` and `/api/audits/:id` strip remediation plan; `/api/audits/:id/findings` strips fix steps and code snippets for unpaid audits
- Both client-side verification (on redirect) and server-side webhook confirmation update `paidAt`

## Scanner Engine
- `server/scanner.ts` connects to GitHub API to fetch repo metadata, file tree, and file contents
- Pattern detection for: hardcoded secrets (Stripe/AWS/GitHub tokens), SQL injection, unsafe CORS, eval(), sensitive files, missing .gitignore/lockfiles/CI/CD, large files, package.json analysis
- Auto-generates findings tagged with `autoDetected: true` (cleared on re-scan, manual findings persist)
- Produces 5 category scores and executive summary
- Generates 3-phase remediation roadmap based on finding severity
- Async workflow: POST /api/audits/:id/scan triggers background scan, frontend polls every 3s

## Design
- Dark-first theme inspired by Socket.dev
- Blue primary color (hue 217)
- No pricing section on landing page
- Radar chart for score visualization
- Expandable finding cards with evidence and fix steps
- 14-day remediation roadmap with phase timeline
- Collapsible file tree viewer and scan log
- Amber/gold paywall UI with blurred roadmap preview

## Running
- `npm run dev` starts both Express backend and Vite frontend
- Database schema pushed via `npm run db:push`
- Stripe webhook registered before `express.json()` middleware
