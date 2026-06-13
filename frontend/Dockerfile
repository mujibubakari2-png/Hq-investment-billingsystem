# =============================================================================
# DO-004: Frontend Dockerfile — Vite + React SPA
# =============================================================================
#
# Multi-stage build:
#   1. deps    — install all dependencies
#   2. builder — vite build → dist/
#   3. runner  — nginx:alpine serves the static bundle
#
# The frontend is a pure SPA — no Node.js required at runtime.
# nginx handles:
#   • Static file serving with gzip + cache-control headers
#   • SPA fallback: all routes → index.html (client-side routing)
#   • Security headers: X-Frame-Options, CSP, HSTS, etc.
#
# Build args:
#   NODE_VERSION          — Node.js version for build stage
#   VITE_API_URL          — Backend API URL baked into the bundle at build time
#   VITE_HARAKAPAY_URL    — HarakaPay callback URL
# =============================================================================

ARG NODE_VERSION=22-alpine

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile 2>/dev/null || npm install

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args must be declared here to be used as ENV during build
ARG VITE_API_URL=http://localhost:3000
ARG VITE_HARAKAPAY_URL=""

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_HARAKAPAY_URL=${VITE_HARAKAPAY_URL}
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN npm run build

# ── Stage 3: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config for SPA + security headers
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
