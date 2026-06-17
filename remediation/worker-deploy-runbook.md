# Worker deploy runbook — JobSphere background jobs

**Status:** required before production launch (Wave-final, branch `remediation/p0-p1`).
**Artifact:** [`Dockerfile.worker`](../Dockerfile.worker) (repo root, portable to any container host).

---

## Why this exists (read this first)

The JobSphere web app deploys to **Vercel**, which is **serverless** — it cannot run a
persistent process. All background work runs in a **single long-lived Node process**:
`apps/web/src/workers/index.ts` (started by `yarn workers` → `tsx`). It boots 6 BullMQ
workers and calls `initializeCronJobs()`.

If this process is **not** running somewhere always-on, the following **silently never
happen** in production (the web app keeps working, jobs just queue up and never drain):

| Job                                         | Consequence if workers are down                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `retention` cron (3:00 UTC)                 | **GDPR Art.5(1)(e) retention + Art.17 erasure never execute → legal exposure** |
| `email-sequence` (every 15 min + on enroll) | drip campaigns never send                                                      |
| `embeddings`                                | semantic search / matching never backfills new CVs/jobs                        |
| `assessment-grading`                        | submitted assessments never get scored                                         |
| `assessment-reminder` (daily 9:00 UTC)      | candidates never reminded                                                      |
| `match-score-cache`                         | candidate match-scores endpoint stays cold/empty                               |

The **code is correct and wired** (cron + queues + idempotent workers). What was missing
is the **deploy topology** — this runbook + `Dockerfile.worker` close that gap.

---

## What the worker needs

1. **The same Redis** (`REDIS_URL`) the web app enqueues jobs to. If web and worker point
   at _different_ Redis instances, jobs are enqueued in one and drained from the other =
   nothing runs. Use **one managed Redis** shared by both.
2. **The same Postgres** (`DATABASE_URL`, with `pgvector`) — workers read/write the same DB.
3. **The same env set the web app validates** in `apps/web/src/lib/env.ts` (validated at
   import → the worker process refuses to start if any is missing):
   `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`,
   `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_API_URL`.
   Plus, for real side effects: `RESEND_API_KEY` **or** `SENDGRID_API_KEY` (email),
   `BLOB_READ_WRITE_TOKEN` (delete CV blobs on GDPR erasure).
   (Full list: [`production-env-checklist.md`](./production-env-checklist.md).)

> Run **exactly one** worker instance to start. The workers are idempotent (deterministic
> BullMQ job ids, SENT-event dedupe), but a single instance avoids any need to reason about
> cron double-registration across replicas.

---

## Option A — Railway (simplest, recommended to start)

1. Create a Railway project. Add the **PostgreSQL** plugin (enable `pgvector`: run
   `CREATE EXTENSION IF NOT EXISTS vector;`) and the **Redis** plugin — OR reuse the same
   managed Postgres/Redis your Vercel app already uses (paste their URLs as env below).
2. **New Service → Deploy from GitHub repo** → select this repo / branch.
3. Service **Settings → Build**: set **Dockerfile Path** = `Dockerfile.worker`.
   (Railway builds the image; the image's `CMD` already runs `yarn workers`.)
4. Service **Variables**: add every var from "What the worker needs" §3. Point
   `REDIS_URL` / `DATABASE_URL` at the **same** instances the web app uses (Railway lets
   you reference the plugin vars, e.g. `${{Redis.REDIS_URL}}`).
5. Deploy. Check **Logs** for `🚀 All workers started successfully`.

## Option B — Render (render.yaml Background Worker)

Add this file (e.g. `render.yaml` at repo root) when you choose Render, then connect the
repo in the Render dashboard:

```yaml
services:
  - type: worker
    name: jobsphere-workers
    runtime: docker
    dockerfilePath: ./Dockerfile.worker
    plan: starter
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: NEXTAUTH_SECRET
        sync: false
      - key: NEXTAUTH_URL
        sync: false
      - key: ENCRYPTION_KEY
        sync: false
      - key: OPENROUTER_API_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: NEXT_PUBLIC_APP_URL
        sync: false
      - key: NEXT_PUBLIC_API_URL
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: BLOB_READ_WRITE_TOKEN
        sync: false
```

## Option C — Fly.io / generic container / VM

Any host that runs a Docker image works. Generic recipe:

```bash
# from repo root
docker build -f Dockerfile.worker -t jobsphere-worker .

# run with the env file the host injects (do NOT bake secrets into the image)
docker run --rm --env-file worker.env jobsphere-worker
```

For Fly.io: `fly launch --dockerfile Dockerfile.worker --no-deploy`, set secrets with
`fly secrets set KEY=value ...` (all vars from §3), then `fly deploy`. Pick a region close
to your database.

---

## Verify it works

1. **Boot log:** `🚀 All workers started successfully` with the 6 worker names.
2. **Cron registered:** no `Failed to initialize cron jobs on worker startup` error in logs.
3. **Live job:** enroll a candidate into an email sequence (or trigger an embedding) in the
   app → within the cron window the worker log shows the job processed; the email
   provider / DB reflects it.
4. **GDPR retention:** on the next 3:00 UTC tick (or trigger manually) the retention worker
   logs a run on seed data.

---

## Notes / gotchas

- **One Redis, one DB, shared with web.** This is the #1 misconfiguration. Verify the URLs
  match the Vercel project's env.
- **Scaling:** keep it at 1 instance until you have a reason not to. If you later run
  multiple, the cron repeatable jobs are keyed in Redis so re-registration is safe, but
  validate before scaling.
- **The legacy root `./Dockerfile`** targets the dead `apps/api` + `apps/workers` trees —
  do **not** use it for workers. Use `Dockerfile.worker`.
- **Local smoke (optional):** with Docker installed and a reachable Postgres+Redis,
  `docker build -f Dockerfile.worker -t jobsphere-worker .` then run with an env file.
