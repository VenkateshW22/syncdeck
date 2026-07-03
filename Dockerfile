# syntax=docker/dockerfile:1

# ---- Deps -------------------------------------------------------------------
# Full (incl. dev) dependencies only. Used directly by docker-compose.yml for
# local development (tsx + Vite dev middleware, no build step needed).
FROM node:20-alpine AS deps

WORKDIR /app

# python3/make/g++ are needed to build native addons pulled in transitively
# by some dependencies during `npm ci`.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ---------------------------------------------------------------
# Produces the production build:
#   dist/            -> static client assets + index.html (vite build)
#   dist/server.cjs  -> bundled Express/Socket.IO server (esbuild)
#   dist/scripts/migrate.cjs -> bundled migration runner (esbuild)
FROM deps AS builder

WORKDIR /app
COPY . .

# Declare build-time variables so Docker passes them through to the build.
# Without these ARG lines, --build-arg values from CI are silently ignored
# and Vite bakes in the defaults (empty string) instead of staging/production values.
ARG VITE_APP_ENV=production
ARG VITE_APP_NAME=SyncDeck
ENV VITE_APP_ENV=${VITE_APP_ENV}
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

# ---- Staging ----------------------------------------------------------------
# Same runtime image as production but with NODE_ENV=staging so the server
# validates all env vars (no in-memory fallbacks) while still logging at
# a higher verbosity than production.
FROM node:20-alpine AS staging

ENV NODE_ENV=staging
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./dist/drizzle

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/server.cjs"]

# ---- Runtime ----------------------------------------------------------------
# Only production dependencies + the compiled build are shipped. No compiler
# toolchain, no TypeScript source, no devDependencies, no test files.
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./dist/drizzle

# node:20-alpine ships a non-root "node" user (uid 1000) out of the box —
# use it instead of running the server as root.
RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/server.cjs"]
