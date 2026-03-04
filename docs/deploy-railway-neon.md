# Deploy Backend to Railway (with Neon Postgres)

This project already supports Neon via `DATABASE_URL`, so the clean production setup is:

- Host the **backend API** on Railway.
- Keep using **Neon** for PostgreSQL.
- Point the frontend to Railway with `VITE_API_BASE_URL`.

## 1) Create Railway project

1. In Railway, click **New Project**.
2. Choose **Deploy from GitHub repo** and select this repository.
3. Keep the service rooted at the repository root (the build and start scripts are configured there).

> Note: `railway.json` in this repo sets build/start commands automatically, including schema push before boot.

## 2) Database setup

### Option A (recommended for your current setup): keep Neon

1. Copy your Neon connection string.
2. In Railway service variables, set:
   - `DATABASE_URL=<your neon url>`

### Option B: Railway Postgres plugin

If you prefer fully in Railway, add the Postgres plugin and map its connection URL into `DATABASE_URL`.

## 3) Required Railway environment variables

Set these in Railway service variables:

- `NODE_ENV=production`
- `DATABASE_URL=...`
- `AUTH_SECRET=<long-random-secret>`
- `FRONTEND_URL=https://<your-frontend-domain>` (used for CORS/session behavior in hosted setups)

If using Stripe/GitHub OAuth, also set the existing integration vars currently used by the backend.

## 4) Deploy domain + callback URLs

1. Create/attach a Railway domain (or custom domain).
2. Use that backend URL for any webhook or OAuth callback settings, for example:
   - `https://<railway-domain>/api/auth/github/callback`
   - `https://<railway-domain>/api/stripe/webhook`

## 5) Frontend → backend API URL

The frontend now supports a dedicated API base URL via `VITE_API_BASE_URL`.

Set this in your frontend hosting provider:

```bash
VITE_API_BASE_URL=https://<railway-domain>
```

All calls like `/api/...` will resolve to Railway automatically.

## 6) CI on pull requests

This repo now includes `.github/workflows/ci.yml` which runs on every PR:

1. `npm ci`
2. `npm run check`
3. `npm run build`

That gives a basic lint/type/build gate before merge.
