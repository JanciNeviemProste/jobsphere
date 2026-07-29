# TODO

Open follow-ups z post-MVP code review (commit aa13273) + bulk actions review.

## P2

- **`emailVerified: new Date()` pri signup obchádza email verification** —
  `apps/web/src/app/api/auth/signup/route.ts:53`. MVP shortcut.
  Odstrániť keď bude funkčný email verification flow (Resend / SendGrid).

## CI infra

### P1

- **Integration test DB setup detection zlyháva v niektorých invocation
  patternoch** — `apps/web/tests/integration/setup.ts:28-31`.
  `process.argv.some(arg => arg.includes('tests/integration'))` neprejde
  pri `vitest run tests/integration/api/jobs/create.test.ts` (Windows
  alebo niektorých CI shell variantoch). Setup sa preskočí → žiadny
  `seedTestData()` → 500 errors keď route hľadá usera/org. Po oprave
  schema field mismatchu zostali 13× failing tests s 500.
  Riešenie: spoľahnúť sa na env var (napr. `TEST_TYPE=integration`)
  alebo na config-level setupFiles routing namiesto argv-based detection.

## Bulk actions follow-ups

### P2

- **Sync SMTP loop v bulk send-email** — P3 (acknowledged, logger.warn pri >200s pridaný).
  `apps/web/src/app/api/applications/bulk/route.ts`. Pri cap 50
  emailov × 2-5s SMTP = až 250s wall-clock per HTTP request. Migrácia na
  BullMQ queue vyžaduje worker v separátnom `apps/workers` package
  (iný build kontext, bez prístupu k `@/lib/email`). Riešenie: extrahovať
  email odosielanie do zdieľaného package alebo použiť HTTP callback.

### P3

- **Pipeline/applicants sticky bar positioning v browseri** —
  `apps/web/src/components/employer/bulk-action-bar.tsx:130`. `sticky
top-0 z-10` sa môže nesprávne lepiť pod employer header. Otestovať
  vizuálne po deploy a prípadne pridať `top-[64px]` (offset header
  výšky) a `z-20`.
