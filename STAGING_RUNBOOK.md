# SyncDeck — Staging Runbook

> **Who is this for?** Anyone deploying, debugging, or maintaining the SyncDeck staging environment.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Docker | ≥ 24 | `docker --version` |
| Docker Compose | ≥ 2.20 | `docker compose version` |
| Node.js | 20 LTS | `node --version` |
| Git | any | `git --version` |

---

## Architecture

```
Internet
   │
   ▼
[Nginx :80]  ←── nginx/nginx.staging.conf (HTTP-only, gzip, WebSocket)
   │
   ▼
[SyncDeck :3000]  ←── NODE_ENV=staging, validates all env vars on boot
   │         │
   ▼         ▼
[Postgres] [Redis]  ←── Bundled containers with named volumes
```

> **HTTPS:** Terminate TLS upstream — Cloudflare (Free plan) or a cloud load balancer is the easiest option. The app and Nginx run HTTP-only internally.

---

## First-Time Setup

### 1. Generate secrets
```bash
# Run once. Store outputs in your password manager AND in GitHub Secrets.
python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(48)).decode())"  # JWT_SECRET
python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(48)).decode())"  # REFRESH_SECRET
python3 -c "import secrets; print(secrets.token_hex(24))"                                       # POSTGRES_PASSWORD
```

### 2. Configure `.env.staging`
```bash
cp .env.staging.example .env.staging
# Fill in: JWT_SECRET, REFRESH_SECRET, POSTGRES_PASSWORD, APP_ORIGIN, APP_URL
```

**Required variables:**
| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | ≥ 32 chars, unique | `Pb+cc6yOdh7LW0...` |
| `REFRESH_SECRET` | ≥ 32 chars, ≠ JWT_SECRET | `WRyEpjATzxdlv...` |
| `POSTGRES_PASSWORD` | Strong random string | `9a854f3bed329...` |
| `APP_ORIGIN` | Full public URL (no trailing slash) | `https://staging.syncdeck.example.com` |
| `APP_URL` | Same as APP_ORIGIN | `https://staging.syncdeck.example.com` |

### 3. (If remote server) Copy files
```bash
ssh ubuntu@YOUR_STAGING_HOST "mkdir -p /opt/syncdeck"
scp .env.staging docker-compose.staging.yml ubuntu@YOUR_STAGING_HOST:/opt/syncdeck/
scp -r nginx ubuntu@YOUR_STAGING_HOST:/opt/syncdeck/
```

---

## Spin Up

### Local (on your machine)
```bash
# Build and start the full staging stack
docker compose -f docker-compose.staging.yml up -d --build

# Verify health
./scripts/smoke-test.sh http://localhost:80

# View logs
docker compose -f docker-compose.staging.yml logs -f
```

### Remote (on staging server via SSH)
```bash
ssh ubuntu@YOUR_STAGING_HOST
cd /opt/syncdeck
docker compose -f docker-compose.staging.yml up -d --build
./scripts/smoke-test.sh http://localhost:80
```

---

## Tear Down

```bash
# Stop and remove containers + network (keeps volumes / data)
docker compose -f docker-compose.staging.yml down

# Stop and DELETE all data (full reset — use with caution)
docker compose -f docker-compose.staging.yml down -v
```

---

## Deploy a New Version

The CI/CD pipeline (`deploy-staging.yml`) does this automatically on every push to the `staging` branch. For manual deploys:

```bash
# On the staging server
cd /opt/syncdeck

# Pull the latest image
docker compose -f docker-compose.staging.yml pull syncdeck

# Run migrations first (one-shot, exits after completion)
docker compose -f docker-compose.staging.yml run --rm migrate

# Restart only the app (zero-downtime)
docker compose -f docker-compose.staging.yml up -d --no-deps syncdeck

# Verify
./scripts/smoke-test.sh http://localhost:80
```

---

## Rollback

```bash
# List available image tags
docker images | grep syncdeck

# Roll back to a specific commit SHA tag (e.g. staging-a1b2c3d)
docker compose -f docker-compose.staging.yml stop syncdeck
docker tag ghcr.io/YOUR_ORG/YOUR_REPO:staging-a1b2c3d syncdeck:rollback
# Edit docker-compose.staging.yml syncdeck.image to the rollback tag, then:
docker compose -f docker-compose.staging.yml up -d --no-deps syncdeck
./scripts/smoke-test.sh
```

---

## Useful Commands

```bash
# Live logs from all services
docker compose -f docker-compose.staging.yml logs -f

# Logs from app only
docker compose -f docker-compose.staging.yml logs -f syncdeck

# Container status
docker compose -f docker-compose.staging.yml ps

# Run migrations manually
docker compose -f docker-compose.staging.yml run --rm migrate

# Open a shell in the running app container
docker compose -f docker-compose.staging.yml exec syncdeck sh

# Check DB connectivity from inside the app container
docker compose -f docker-compose.staging.yml exec syncdeck \
  node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT 1').then(()=>console.log('DB OK')).catch(e=>console.error(e))"

# Check Redis connectivity
docker compose -f docker-compose.staging.yml exec redis redis-cli ping

# Run smoke test
./scripts/smoke-test.sh http://localhost:80
```

---

## GitHub Secrets Required

Set these in **GitHub → Repository → Settings → Secrets → Actions → New repository secret**:

| Secret Name | Description |
|-------------|-------------|
| `STAGING_HOST` | IP or hostname of the staging server |
| `STAGING_SSH_USER` | SSH username (e.g. `ubuntu`) |
| `STAGING_SSH_KEY` | Full private SSH key (PEM format) |
| `REGISTRY_USER` | Docker registry username (or use `github.actor`) |
| `REGISTRY_TOKEN` | Docker registry PAT or `secrets.GITHUB_TOKEN` |

---

## Health Check

The app exposes `GET /api/v1/health`. A healthy response looks like:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "uptime": 1234
}
```

Nginx also forwards this through on port 80. The smoke-test script checks for `"status"` in the response body.

---

## Rotate Secrets

Run this every 90 days or after any suspected compromise:

```bash
# Generate new secrets
python3 -c "import secrets,base64; print('JWT_SECRET=' + base64.b64encode(secrets.token_bytes(48)).decode())"
python3 -c "import secrets,base64; print('REFRESH_SECRET=' + base64.b64encode(secrets.token_bytes(48)).decode())"

# Update .env.staging, then restart the app
docker compose -f docker-compose.staging.yml up -d --no-deps --force-recreate syncdeck
```

> ⚠️ Rotating `JWT_SECRET` invalidates all active session tokens. Users will be logged out.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| App container exits immediately | Missing/invalid env vars | `docker compose logs syncdeck` — look for `[Config] Refusing to start` |
| `migrate` container keeps restarting | DB not ready | Wait for `db` healthcheck to pass; check `docker compose logs db` |
| WebSocket disconnects | Nginx WebSocket timeout | Check `proxy_read_timeout` in `nginx.staging.conf` (should be `86400s`) |
| File uploads lost after restart | No `uploads_data` volume | Ensure `volumes: uploads_data:/app/uploads` is in `docker-compose.staging.yml` |
| 401 on file downloads | Token not sent in Bearer header | Should be fixed — `downloadWithAuth()` uses `fetch()` with Authorization header |
| Port 80 already in use | Another service on port 80 | `sudo lsof -i :80` to find it, stop it, then restart compose |
