# Deploy & env

## Stack

Next.js 14.2.35 (App Router, React 18) · TypeScript 5.3 · Turborepo (yarn 1.22.x) · Prisma 5.22 + Neon Postgres (pgvector) · NextAuth 4.24.7 · BullMQ + Redis · Vercel.

## Commands (turbo at root, cached)

- `yarn dev` (`next dev --port 3000`), `yarn build` (= `prisma generate && node scripts/verify-env.js && next build`), `yarn build:skip-verify` (skips env verification — used for prod/migrations), `yarn start`.
- `yarn typecheck`, `yarn lint`, `yarn test`, `yarn test:e2e`.
- DB: `yarn db:push | db:migrate | db:seed | db:reset` — see `@agent_docs/data-model.md`.
- Local infra: `yarn docker:up | down | logs` (Postgres, Redis, ClamAV).

## Workers / background jobs

`yarn workers` → `apps/web/src/workers/index.ts` (BullMQ). Workers: `emailSequence`, `assessmentGrading`, `embedding`, `assessmentReminder`, `matchScoreCache`, `retention`. Cron via `apps/web/src/lib/cron.ts` (`initializeCronJobs()`): assessment reminders daily 09:00 UTC, email sequences every 15 min. Redis via `REDIS_URL` / `KV_REST_API_*`. NOTE: a dedicated worker host is a **deferred follow-up** (not yet deployed in production).

## Env keys (names only — NEVER read/write/log `.env*` values)

- **Required:** `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`.
- **Recommended/optional:** `KV_REST_API_URL` / `KV_REST_API_TOKEN`, `REDIS_URL`, `EMAIL_SERVICE` (`log|resend|sendgrid`), `RESEND_API_KEY` / `SENDGRID_API_KEY`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `APPLE_ID` / `APPLE_SECRET`, `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, `CSRF_SECRET`, `GDPR_ADMIN_EMAIL`, `STORAGE_PROVIDER` (`local|vercel-blob`), `NEXT_PUBLIC_APP_URL`, `PREVIEW_SKIP_EMAIL_VERIFICATION`. Template: `.env.example`.

## next.config.js

Security headers: HSTS (`max-age=31536000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo off), CSP (Stripe/Sentry/Google/Vercel script & frame; Anthropic/OpenAI/Voyage/Sentry connect-src; Vercel Blob img-src). `swcMinify`, `transpilePackages: ['@jobsphere/db']`, Server Actions `bodySizeLimit: '10mb'`, webpack `canvas`/`pdfjs-dist` aliased to `false` on client. CSP nonce propagation (SEC-005) deferred.

## Vercel

Two projects from the same repo: **`jobsphere-master`** (canonical production, owns the domains) and a legacy `jobsphere` project (git-disconnected). Apex `jobsphere.eu` 308 → `www.jobsphere.eu` (canonical). Domains are the project's **production** domains, so they auto-follow each new production deploy. A single Neon DB serves preview + production; some production env values are still placeholders (follow-ups). Background context: memory `project_remediation_branch.md`.
