# Deploy CodeAudit to DigitalOcean with GoDaddy DNS

This guide gets `codeauditapp.com` live quickly using a DigitalOcean Droplet, Nginx, PM2, and Let's Encrypt.

## 1) Create infrastructure

1. Create a **Droplet** (Ubuntu 22.04 LTS recommended).
2. Create a **Managed PostgreSQL** database in DigitalOcean (recommended) or another hosted Postgres provider (Neon/Supabase/etc).
3. Note your Droplet public IPv4 address.

## 2) Point GoDaddy DNS to the Droplet

In GoDaddy DNS for `codeauditapp.com`:

- `A` record: `@` -> `<your_droplet_ip>`
- `A` record: `www` -> `<your_droplet_ip>`

TTL: default/1 hour is fine.

Check propagation:

```bash
dig +short codeauditapp.com
dig +short www.codeauditapp.com
```

Both should return your Droplet IP.

## 3) Prepare server

SSH to your server and install runtime tools:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 4) Pull repository and configure app

```bash
cd /var/www
sudo mkdir -p codeauditapp
sudo chown $USER:$USER codeauditapp
cd codeauditapp

git clone <your_repo_url> .
npm ci
```

Sanity check that you are in the app root (this prevents `ENOENT: package.json` errors):

```bash
pwd
ls package.json package-lock.json
```

Create `.env`:

```bash
cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL='postgresql://DB_USER:DB_PASSWORD@DB_HOST/DB_NAME?sslmode=verify-full'
AUTH_SECRET='REPLACE_WITH_LONG_RANDOM_SECRET'
REPLIT_DOMAINS=codeauditapp.com,www.codeauditapp.com
ENV
```

Important:
- Replace `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_NAME` with real values.
- If your DB password includes special characters (`@`, `:`, `/`, `#`, `?`), URL-encode it first.
- Prefer `sslmode=verify-full` in the URL (avoids current/future `pg` SSL mode warning behavior).
- `AUTH_SECRET` must also be a real random string, not the placeholder text.
- Do **not** keep angle brackets (`<` `>`) in `.env`; in shell files they can be interpreted as redirection and break `source .env`.
- Wrap `DATABASE_URL` in single quotes in `.env` exactly as shown above.
- If your URL has extra params like `&channel_binding=require`, quotes are mandatory; otherwise Bash treats `&` as a background operator when you run `source .env`.
- Quote `AUTH_SECRET` too (especially if it contains `!`, `&`, `$`, or spaces).

Load `.env` into the current shell before DB and PM2 commands:

```bash
set -a
source .env
set +a
```

Build + DB schema + run:

```bash
npm run build
npm run db:push
pm2 start npm --name codeauditapp --cwd /var/www/codeauditapp/codescope -- start --update-env
pm2 save
pm2 startup
```

Verify app is running:

```bash
curl -I http://127.0.0.1:5000
pm2 status
```

If PM2 shows `errored`, check logs immediately:

```bash
pm2 logs codeauditapp --lines 200
```

Also confirm PM2 is using the correct directory:

```bash
pm2 show codeauditapp | grep -E 'exec cwd|script path|status'
```

## 5) Nginx reverse proxy

Create site config:

```bash
sudo tee /etc/nginx/sites-available/codeauditapp >/dev/null <<'NGINX'
server {
  listen 80;
  server_name codeauditapp.com www.codeauditapp.com;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/codeauditapp /etc/nginx/sites-enabled/codeauditapp
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP:

```bash
curl -I http://codeauditapp.com
```

## 6) Enable HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d codeauditapp.com -d www.codeauditapp.com
```

Check renewal timer:

```bash
systemctl status certbot.timer
```

## 7) Ongoing deploys from repo

From server directory (`/var/www/codeauditapp/codescope`), use:

```bash
git pull
npm ci
npm run build
set -a && source .env && set +a
npm run db:push
pm2 restart codeauditapp --update-env
```

## 8) Fixes for the most common deployment mistakes

### A) You cloned into a nested folder (for example `/var/www/codeauditapp/codescope`)

Symptoms:
- `npm run build` fails with `ENOENT: no such file or directory, open '/var/www/codeauditapp/package.json'`
- PM2 process restarts repeatedly and never binds to port 5000

Fix:

```bash
cd /var/www/codeauditapp
rm -f .env
cd codescope

# ensure env file lives beside package.json
cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL='postgresql://DB_USER:DB_PASSWORD@DB_HOST/DB_NAME?sslmode=verify-full'
AUTH_SECRET='REPLACE_WITH_LONG_RANDOM_SECRET'
REPLIT_DOMAINS='codeauditapp.com,www.codeauditapp.com'
ENV

npm ci
npm run build

# make env variables available to drizzle + app startup
set -a
source .env
set +a

npm run db:push
pm2 delete codeauditapp || true
pm2 start npm --name codeauditapp --cwd /var/www/codeauditapp/codescope -- start --update-env
pm2 save
curl -I http://127.0.0.1:5000
```

### B) `npm ci` complains about missing lockfile

You are not in the repository root. Run `pwd`, then `cd` into the directory that contains `package-lock.json` and retry.

### C) `npm run db:push` fails with `TypeError: Invalid URL`

This means `DATABASE_URL` is malformed (often placeholders were not replaced, or password characters were not URL-encoded).

Quick checks:

```bash
grep '^DATABASE_URL=' .env

set -a
source .env
set +a

node -e 'console.log(new URL(process.env.DATABASE_URL).toString())'
```

If the `node -e` command throws, fix `DATABASE_URL` first, then run `npm run db:push` again.

### D) PM2 shows `online` briefly but port 5000 is still closed

The process is crashing after start. Use:

```bash
pm2 logs codeauditapp --lines 200
pm2 restart codeauditapp --update-env
```

Most often this is caused by bad/missing `DATABASE_URL`.

### E) App logs show: `The endpoint has been disabled. Enable it using Neon API and retry.`

This is a Neon-side issue: your project branch endpoint is disabled/suspended, so the app cannot connect.

Fix (Neon):

1. Open Neon Console → your project → **Branches**.
2. Enable/activate the endpoint for your production branch (usually `main`).
3. Copy the branch connection string again from Neon (**Connection Details**).
4. Put that value in `.env` as `DATABASE_URL=` and append `sslmode=verify-full` if missing.

Then rerun:

```bash
cd /var/www/codeauditapp/codescope
set -a && source .env && set +a
node -e 'console.log(new URL(process.env.DATABASE_URL).toString())'
npm run db:push
pm2 restart codeauditapp --update-env
pm2 logs codeauditapp --lines 100
curl -I http://127.0.0.1:5000
```

If you are not using Neon, this specific error does not apply; instead verify your provider allows inbound connections from your Droplet.


### F) `password authentication failed for user 'neondb_owner'` (Postgres code `28P01`)

This means host/network is reachable, but your DB password is wrong.

Most common cause: you left the placeholder password in `.env` (`YOUR_REAL_PASSWORD`) instead of the real Neon password.

Fix exactly:

```bash
cd /var/www/codeauditapp/codescope

# paste REAL Neon password (from Neon Console -> Role -> Reset password)
cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL='postgresql://neondb_owner:PASTE_REAL_NEON_PASSWORD_HERE@ep-steep-lab-aikqzfhl-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require'
AUTH_SECRET='usirn7882b47_ifbe7724buussu288fbbsy7!'
REPLIT_DOMAINS='codeauditapp.com,www.codeauditapp.com'
ENV

set -a
source .env
set +a

# sanity check: this must NOT print YOUR_REAL_PASSWORD
printf '%s
' "$DATABASE_URL" | sed 's#://[^:]*:[^@]*@#://***:***@#'

npm run db:push
pm2 restart codeauditapp --update-env
curl -I http://127.0.0.1:5000
```

If it still says `28P01`, reset the `neondb_owner` password in Neon and repeat the block above.

## 9) Exact recovery flow for your current state

```bash
cd /var/www/codeauditapp/codescope

# verify app root
ls package.json package-lock.json

# set a real .env (no placeholders)
nano .env

# optional: generate a strong AUTH_SECRET
openssl rand -base64 48

npm ci
npm run build

set -a
source .env
set +a

# validate DB URL format before drizzle
node -e 'console.log(new URL(process.env.DATABASE_URL).toString())'

npm run db:push
pm2 delete codeauditapp || true
pm2 start npm --name codeauditapp --cwd /var/www/codeauditapp/codescope -- start --update-env
pm2 save

pm2 status
pm2 logs codeauditapp --lines 100
curl -I http://127.0.0.1:5000
```


## 10) Exact fix for the current errors (`-bash: user: No such file`, `ECONNREFUSED 127.0.0.1:5432`)

Those two errors mean:
- your `.env` currently contains invalid shell syntax (likely `<user>` style placeholders), so `source .env` fails
- because env loading failed, Node falls back to trying local Postgres (`localhost:5432`), which is not running

Run this **exactly**:

```bash
cd /var/www/codeauditapp/codescope

cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL='postgresql://DB_USER:DB_PASSWORD@DB_HOST/DB_NAME?sslmode=verify-full'
AUTH_SECRET='REPLACE_WITH_LONG_RANDOM_SECRET'
REPLIT_DOMAINS='codeauditapp.com,www.codeauditapp.com'
ENV

# edit the placeholders now (no angle brackets, keep single quotes)
nano .env

# load env into shell
set -a
source .env
set +a

# verify env is actually loaded
printf '%s\n' "$DATABASE_URL"
node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.protocol, u.hostname, u.pathname)'

# check remote DB reachability from droplet
node -e 'const u=new URL(process.env.DATABASE_URL); console.log(`testing ${u.hostname}:5432`)'
nc -vz "$(node -e 'console.log(new URL(process.env.DATABASE_URL).hostname)')" 5432

npm run db:push
pm2 restart codeauditapp --update-env
pm2 logs codeauditapp --lines 100
curl -I http://127.0.0.1:5000
```

If `nc -vz ... 5432` fails, the issue is database/network side (disabled endpoint, IP allowlist, or wrong host), not PM2/nginx.

## 11) Exact fix for `source .env` showing `[1]+ Done ...` and empty/truncated `DATABASE_URL`

This happens when `DATABASE_URL` is not quoted and contains `&` (for example `...sslmode=require&channel_binding=require`). Also make sure you replaced any password placeholder with the real Neon password.

Use this exact `.env` format:

```bash
cd /var/www/codeauditapp/codescope

cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL='postgresql://neondb_owner:PASTE_REAL_NEON_PASSWORD_HERE@ep-steep-lab-aikqzfhl-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require'
AUTH_SECRET='usirn7882b47_ifbe7724buussu288fbbsy7!'
REPLIT_DOMAINS='codeauditapp.com,www.codeauditapp.com'
ENV

set -a
source .env
set +a

printf '%s\n' "$DATABASE_URL"
node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.protocol, u.hostname, u.pathname, u.search)'
```

Expected: hostname prints `ep-steep-lab-aikqzfhl-pooler.c-4.us-east-1.aws.neon.tech` (not blank).

Then continue:

```bash
npm run db:push
pm2 delete codeauditapp || true
pm2 start npm --name codeauditapp --cwd /var/www/codeauditapp/codescope -- start --update-env
pm2 save
curl -I http://127.0.0.1:5000
```

## 12) Quick troubleshooting

- App logs: `pm2 logs codeauditapp --lines 200`
- Nginx logs: `sudo tail -n 200 /var/log/nginx/error.log`
- If app crashes on boot, verify required env vars (`DATABASE_URL`, `AUTH_SECRET`) and DB connectivity.
