# Production hardening — what changed

Scope: deploy-blockers and configuration/infra hardening only. Scalability
work from `scalability_report.md` (WebRTC mesh limit, canvas hydration
payload size, poll fan-out, etc.) is a separate, larger effort and was
intentionally **not** touched here.

## Fixed

1. **Dockerfile never built the app.** It ran `npm install` then
   `CMD npm run start`, but `start` runs `dist/server.cjs`, which is only
   produced by `npm run build` — that step was missing. The image as shipped
   could not have booted. Rewrote as a proper 3-stage build (`deps` →
   `builder` → `runtime`): full deps + build in the build stages,
   production-only deps in the final image, non-root user, `HEALTHCHECK`.

2. **Insecure secret fallbacks.** `JWT_SECRET`/`REFRESH_SECRET` fell back to
   the literal strings `"change_this_secret_in_production"` /
   `"change_this_refresh_secret"` if unset — meaning a missing env var
   produced a *working but insecure* server instead of a failure. Same
   pattern for `REDIS_URL` (silently degrades to a per-process in-memory
   mock) and `DATABASE_URL` (silently degrades to an embedded, ephemeral
   PGlite database). Added `server/config/env.ts`, which validates all of
   this at startup and **refuses to boot in production** if secrets are
   missing, too short, or left at a placeholder value, or if required
   infra URLs aren't set. Development is unaffected — it still warns and
   uses local fallbacks.

3. **`dotenv` was a declared dependency but never loaded.** Now loaded once,
   centrally, in `server/config/env.ts`.

4. **Unhandled Redis `error` events would crash the process.** node-redis
   emits `error` on transient connection issues; without a listener, Node
   treats that as fatal. Added a listener so transient blips are logged and
   handled by the client's own reconnect logic instead of taking the whole
   server down.

5. **Graceful shutdown didn't close DB/Redis connections**, only the HTTP
   server and sockets. Added explicit `pool.end()` / `redisClient.quit()`.

6. **Startup failures left a zombie process.** If `startServer()` threw
   (e.g. DB unreachable), the process logged and kept running without ever
   binding to a port. Now exits with a non-zero code so the orchestrator
   restarts it immediately.

7. **Health check endpoint shared the strict global rate limiter** (100
   req/15 min), which orchestrator liveness probes (often every few
   seconds) would exhaust, making a healthy app look "down." Gave health
   checks their own generous limiter and added a separate
   `/api/v1/health/ready` endpoint that actually checks DB + Redis
   connectivity, for use as a load-balancer readiness gate.

8. **`docker-compose.yml` committed plaintext secrets** and its "app"
   service actually ran `npm run dev` (Vite dev server), not a production
   build. Split into:
   - `docker-compose.yml` — local dev, secrets sourced from a git-ignored
     `.env` file (with safe dev-only defaults), targets the lightweight
     `deps` Docker stage.
   - `docker-compose.prod.yml` — builds the `runtime` stage, requires real
     secrets via `.env`, no bind mounts, DB/Redis ports not exposed
     externally.

9. **`.env.example` was leftover boilerplate** from a different starter
   template (Gemini/AI Studio vars) and didn't document any of the real
   variables this app reads. Rewritten to list every var the app actually
   uses, with generation instructions for secrets.

## Known, deliberately not fixed here

- `@google/genai` is a declared dependency with no code referencing it
  anywhere — the README's "AI-Assisted Insights" feature isn't wired up.
  Either implement it or drop the dependency.
- Scalability limits documented in `scalability_report.md` are unchanged
  (WebRTC mesh capped at ~50 viewers, monolithic `HYDRATE_STATE` payload,
  no query caching in front of Postgres, unbatched poll/canvas broadcasts).
  These need real design decisions (e.g. SFU vs mesh) rather than
  config-level fixes.
- No CI pipeline, no automated migrations (drizzle-kit is a devDependency
  but `initializeDb()` runs raw `CREATE TABLE IF NOT EXISTS` SQL inline
  instead), no secrets manager integration (currently plain env vars).

## Before deploying

1. `cp .env.example .env` and fill in real values (`openssl rand -base64 48`
   for the two JWT secrets).
2. `docker compose -f docker-compose.prod.yml up -d --build`
3. Confirm `GET /api/v1/health/ready` returns `200` before routing traffic.
