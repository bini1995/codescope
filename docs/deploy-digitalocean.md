# Deploy CodeAudit to DigitalOcean with GoDaddy DNS

This guide gets `codeauditapp.com` live quickly using a DigitalOcean Droplet, Nginx, PM2, and Let's Encrypt.

## 1) Create infrastructure

1. Create a **Droplet** (Ubuntu 22.04 LTS recommended).
2. Create a **Managed PostgreSQL** database in DigitalOcean (recommended) or another hosted Postgres provider.
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

Create `.env`:

```bash
cat > .env <<'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<db>?sslmode=require
AUTH_SECRET=<random-long-secret>
REPLIT_DOMAINS=codeauditapp.com,www.codeauditapp.com
ENV
```

Build + DB schema + run:

```bash
npm run build
npm run db:push
pm2 start npm --name codeauditapp -- start
pm2 save
pm2 startup
```

Verify app is running:

```bash
curl -I http://127.0.0.1:5000
pm2 status
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

From server directory (`/var/www/codeauditapp`), use:

```bash
git pull
npm ci
npm run build
npm run db:push
pm2 restart codeauditapp
```

## 8) Quick troubleshooting

- App logs: `pm2 logs codeauditapp --lines 200`
- Nginx logs: `sudo tail -n 200 /var/log/nginx/error.log`
- If app crashes on boot, verify required env vars (`DATABASE_URL`, `AUTH_SECRET`) and DB connectivity.
