# =============================================================================
# DO-004: Backend Dockerfile — Next.js 14 (App Router)
# =============================================================================
#
# Multi-stage build:
#   1. deps    — install production + dev dependencies (layer-cached)
#   2. builder — prisma generate + next build (layer-cached on source change)
#   3. runner  — minimal production image (~280 MB vs ~1.2 GB unbaked)
#
# Build args:
#   NODE_VERSION  — Node.js version (default 22-alpine)
#   PORT          — internal port the server listens on (default 3000)
#
# Security:
#   - Non-root user (nextjs uid=1001) in final stage
#   - No dev dependencies in production image
#   - Secrets are injected at runtime via env vars, NOT baked into the image
# =============================================================================

ARG NODE_VERSION=22-alpine
# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install libc6-compat for Alpine native module compatibility
RUN apk add --no-cache libc6-compat

# Copy only package manifests — maximises cache reuse
COPY package.json package-lock.json* ./
# Install all deps (dev included — needed for prisma generate + tsc)
RUN npm ci --frozen-lockfile 2>/dev/null || npm install

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (must run before next build)
RUN npx prisma generate

# Build Next.js (standalone output bundles only what's needed at runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only the standalone build output + static assets
COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static

# Copy Prisma schema & migrations (needed for migrate deploy at container start)
COPY --from=builder /app/prisma ./prisma
# Copy the generated Prisma client into the standalone node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Healthcheck — polls /api/health every 30 s; marks container unhealthy after 3 failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

USER nextjs

EXPOSE ${PORT:-3000}
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run migrate deploy then start (migrate deploy is idempotent — safe on every boot)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
