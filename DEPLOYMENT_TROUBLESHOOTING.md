# PM2 and Next.js Production Troubleshooting

## The error

If PM2 logs show:

```text
SyntaxError: missing ) after argument list
```

and the stack points to:

```text
/node_modules/.bin/next
```

with shell lines like:

```sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")
```

PM2 is trying to run a shell wrapper as JavaScript.

## Why it happens

`node_modules/.bin/next` is not the best PM2 target when `interpreter: 'node'` is set. On Linux/package-manager installs, `.bin/next` can be a shell shim that locates and launches the real Next.js binary.

When PM2 is configured like this:

```js
{
  script: 'node_modules/.bin/next',
  interpreter: 'node',
  args: 'start --port 3000'
}
```

PM2 effectively runs:

```sh
node node_modules/.bin/next start --port 3000
```

Node then parses shell syntax such as `basedir=$(dirname ...)` as JavaScript and throws the syntax error.

Your app can still show `Ready` if another PM2 process, a previous `npm start`, or a manually started process is already running correctly. That is why the server may work while PM2 keeps logging errors from a stale or misconfigured process.

## Correct PM2 target

Use the real Next.js JavaScript CLI:

```text
node_modules/next/dist/bin/next
```

with:

```js
interpreter: 'node'
```

Do not use `node_modules/.bin/next` with the Node interpreter.

## What to use

| Option | Production PM2 recommendation | Notes |
| --- | --- | --- |
| `npm start` / `pnpm start` | OK for manual testing | PM2 manages a package manager subprocess, not the Next process directly. |
| `next start` | OK inside package scripts | Good for local/manual production checks after `next build`. |
| `node_modules/.bin/next` | Avoid with `interpreter: 'node'` | Can be a shell shim and cause the syntax error. |
| `node_modules/next/dist/bin/next` | Best for PM2 | Real JavaScript CLI, cleanly managed by Node/PM2. |

## Correct ecosystem.config.js

The project root has a production-ready `ecosystem.config.js` using:

```js
script: 'node_modules/next/dist/bin/next',
interpreter: 'node',
args: 'start --hostname 127.0.0.1 --port 3000',
instances: 1,
exec_mode: 'fork'
```

Backend runs on `127.0.0.1:3000`.
Landing page runs on `127.0.0.1:3001`.

The Vite frontend should be served by Nginx from `frontend/dist`; it does not need PM2.

## Fork mode vs cluster mode

Use fork mode by default:

```js
instances: 1,
exec_mode: 'fork'
```

This is the most stable setup for a small Ubuntu VPS, especially a single-core droplet.

Avoid this unless you have tested it:

```js
instances: 'max',
exec_mode: 'cluster'
```

Cluster mode can create port conflicts or confusing reload behavior with Next.js if the app and proxy are not designed for it. If you need horizontal scaling, a safer pattern is multiple explicit app instances on different ports and an Nginx upstream.

## Package scripts

Backend:

```json
{
  "scripts": {
    "build": "prisma generate && node --max-old-space-size=1536 node_modules/next/dist/bin/next build",
    "start": "next start --hostname 127.0.0.1 --port ${PORT:-3000}",
    "start:droplet": "bash scripts/droplet-start.sh",
    "next:start": "next start --hostname 127.0.0.1 --port ${PORT:-3000}",
    "db:migrate": "prisma migrate deploy"
  }
}
```

Landing page:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start --hostname 127.0.0.1 --port ${PORT:-3001}"
  }
}
```

## Clean PM2 state

Use this when old/stale PM2 processes are still logging errors:

```bash
cd /var/www/Hq-investment-billingsystem
pm2 list
pm2 delete backend landing-page || true
pm2 delete all || true
pm2 kill
sleep 2
pm2 flush
```

Then start fresh:

```bash
cd /var/www/Hq-investment-billingsystem
mkdir -p logs
pm2 start ecosystem.config.js --env production
pm2 save
```

## Clean rebuild

```bash
cd /var/www/Hq-investment-billingsystem
git pull
corepack enable
pnpm install --frozen-lockfile

cd /var/www/Hq-investment-billingsystem/backend
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate deploy

cd /var/www/Hq-investment-billingsystem
pnpm --filter backend build
pnpm --filter landing-page build
pnpm --filter frontend build

pm2 reload ecosystem.config.js --env production --update-env
pm2 save
```

If the PM2 process list is polluted with bad old commands, use `pm2 delete all` and `pm2 start ecosystem.config.js --env production` instead of reload.

## Nginx reverse proxy checks

Next.js should listen only on localhost:

```text
127.0.0.1:3000
127.0.0.1:3001
```

Nginx should expose public HTTP/HTTPS and proxy to those local ports.

Useful checks:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

Local app checks:

```bash
curl -I http://127.0.0.1:3000
curl -sS http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3001
```

Public checks:

```bash
curl -I https://your-domain.com
curl -I https://app.your-domain.com
```

When Cloudflare is enabled, first verify the origin directly with localhost/127.0.0.1 checks on the VPS. Then verify public HTTPS through Cloudflare.

## Healthy deployment checklist

```bash
pm2 list
pm2 show backend
pm2 show landing-page
pm2 logs backend --lines 50
pm2 logs landing-page --lines 50
ss -tlnp | grep -E ':3000|:3001'
curl -sS http://127.0.0.1:3000/api/health
sudo nginx -t
```

Expected:

- PM2 status is `online`.
- No `.bin/next` syntax errors appear in new logs.
- Ports `3000` and `3001` listen on `127.0.0.1`.
- `/api/health` returns successfully.
- Nginx config test passes.

## Common mistakes

- Starting PM2 with `script: 'node_modules/.bin/next'` and `interpreter: 'node'`.
- Running both an old PM2 process and a new correct process at the same time.
- Using `npm start` when that script runs migrations/seeding every restart.
- Using cluster mode on a single-core VPS.
- Forgetting to run `next build` before `next start`.
- Letting Next listen publicly on `0.0.0.0` when Nginx should be the public entry point.
- Not using `--update-env` after changing environment variables.
- Forgetting `pm2 save` after fixing the process list.

## Copy-paste recovery

```bash
cd /var/www/Hq-investment-billingsystem

pm2 delete all || true
pm2 kill
sleep 2
pm2 flush

corepack enable
pnpm install --frozen-lockfile

cd backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy

cd ..
pnpm --filter backend build
pnpm --filter landing-page build
pnpm --filter frontend build

mkdir -p logs
pm2 start ecosystem.config.js --env production
pm2 save

sudo nginx -t
sudo systemctl reload nginx

pm2 list
pm2 logs backend --lines 50
curl -sS http://127.0.0.1:3000/api/health
```
