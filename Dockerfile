# Multi-stage build for JobSphere Backend (API + Workers)
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/workers/package.json ./apps/workers/
COPY packages/*/package.json ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the applications
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build all packages and apps
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 jobsphere

# Copy built artifacts
COPY --from=builder --chown=jobsphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=jobsphere:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=jobsphere:nodejs /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder --chown=jobsphere:nodejs /app/packages ./packages
COPY --from=builder --chown=jobsphere:nodejs /app/package.json ./
COPY --from=builder --chown=jobsphere:nodejs /app/pnpm-workspace.yaml ./

USER jobsphere

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Default to API (can override with CMD for workers)
CMD ["node", "apps/api/dist/index.js"]
