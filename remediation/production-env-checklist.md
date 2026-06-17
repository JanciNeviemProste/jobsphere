# Production env checklist — JobSphere

Source of truth: `apps/web/src/lib/env.ts` (a Zod schema **validated at import**) and the
`apps/web/build` script (`prisma generate && node scripts/verify-env.js && next build`).

> **The build FAILS on Vercel** with `❌ Invalid environment variables` if any **required**
> var below is missing. The error names the missing var.

> **Why this file and not `.env.example`:** `.env*` files are blocked by the agent's
> permission policy, so this checklist was generated alongside instead. Paste the
> "missing lines" below into `apps/web/.env.example` yourself (names only, no secrets).

---

## REQUIRED — web app (set in Vercel → Project → Settings → Environment Variables)

| Variable              | Notes                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Postgres connection string. DB must have the `pgvector` extension.                                              |
| `REDIS_URL`           | Redis connection string. **Same instance** the worker uses.                                                     |
| `NEXTAUTH_SECRET`     | ≥ 32 chars. Generate: `openssl rand -base64 32`                                                                 |
| `NEXTAUTH_URL`        | Public app URL, e.g. `https://app.jobsphere.eu`                                                                 |
| `ENCRYPTION_KEY`      | ≥ 64 hex chars (32 bytes). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPENROUTER_API_KEY`  | CV parsing (primary).                                                                                           |
| `ANTHROPIC_API_KEY`   | CV parsing fallback (Claude).                                                                                   |
| `OPENAI_API_KEY`      | Embeddings generation.                                                                                          |
| `NEXT_PUBLIC_APP_URL` | Public app URL (client-visible).                                                                                |
| `NEXT_PUBLIC_API_URL` | Public API base, e.g. `https://app.jobsphere.eu/api`                                                            |

## REQUIRED — worker host (set wherever `Dockerfile.worker` runs)

The worker validates the **same** `env.ts` schema → give it **all 10 vars above**, pointing
`REDIS_URL` / `DATABASE_URL` at the **same** instances as the web app. See
[`worker-deploy-runbook.md`](./worker-deploy-runbook.md).

## OPTIONAL but needed for specific features

| Variable                                                                             | Enables                                                                                            |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `CSRF_SECRET`                                                                        | CSRF protection (≥ 32 chars; `openssl rand -base64 32`).                                           |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Billing. Also seed `Price.providerPriceId` = live Stripe price ids (webhook fail-louds otherwise). |
| `BLOB_READ_WRITE_TOKEN`                                                              | Vercel Blob (CV upload + delete-on-GDPR-erase).                                                    |
| `RESEND_API_KEY` **or** `SENDGRID_API_KEY`                                           | Transactional + sequence email (else log-only).                                                    |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`                                          | Google OAuth login.                                                                                |
| `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY`                                 | Error tracking / analytics.                                                                        |
| `EMBEDDING_PROVIDER` (`openai`\|`voyage`\|`cohere`, default `openai`)                | Embedding backend selection.                                                                       |

---

## Lines to add to `apps/web/.env.example` (paste manually)

`env.ts` requires these four, but they are absent from `.env.example` — add them so the
next person doesn't hit a build failure:

```dotenv
# Required — Redis (rate limiting + BullMQ queues)
REDIS_URL="redis://localhost:6379"

# Required — AI providers
OPENROUTER_API_KEY=""        # CV parsing (primary)
OPENAI_API_KEY=""            # embeddings

# Required — public API base URL
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

---

## Quick verify before deploy

```bash
cd apps/web && yarn verify:env   # runs scripts/verify-env.js against the current env
```
