# TODO

Open follow-ups z post-MVP code review (commit aa13273) + bulk actions review.

## P1

- **Race condition: find-or-create Candidate** —
  `apps/web/src/app/api/applications/route.ts:148-167`.
  Súbežné apply requesty od jedného usera na rôzne joby v rovnakej
  org môžu vytvoriť duplicitné Candidate záznamy. Riešenie:
  obal find-or-create do `prisma.$transaction`, alebo pridaj unique
  index `(orgId, email)` na CandidateContact a chyť P2002.

## P2

- **In-memory rate limit fallback je no-op v serverless** —
  `apps/web/src/lib/rate-limit.ts:191`. Bez Upstash sa counter resetuje
  pri každom cold starte. Buď zalogovať warn pri startup ak chýba
  `KV_REST_API_URL` v produkcii, alebo zablokovať deploy.
- **`emailVerified: new Date()` pri signup obchádza email verification** —
  `apps/web/src/app/api/auth/signup/route.ts:53`. MVP shortcut.
  Odstrániť keď bude funkčný email verification flow (Resend / SendGrid).

## P3

- **`consumeEntitlement` ticho preskočí chýbajúci entitlement record** —
  `apps/web/src/lib/entitlements.ts:247`. Nové orgs bez seedovaných
  entitlements sa správajú ako unlimited. Pridať alert pri zlyhaní seedu
  alebo failnúť explicitne keď `updateMany` vráti `count: 0`.
- **GET /api/applications: overiť že `total` count zohľadňuje filter** —
  `apps/web/src/app/api/applications/route.ts:36-50`. Skontrolovať že
  `prisma.application.count` používa rovnaký `where` ako findMany;
  inak `hasMore` v pagination je nesprávny.

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

## Bulk actions follow-ups (z gstack review)

### P2

- **HTML sanitization je obchádzateľná** —
  `apps/web/src/app/api/applications/bulk/route.ts:129-131` a per-id
  `send-email/route.ts`. Regex blokuje len `on*="..."` (s úvodzovkami)
  a `<script>`. Bypass: `<img onerror=fn()>` (bez quotes),
  `<a href="javascript:">`, `<iframe>`, `<svg onload>`. Email klienti
  síce sanitizujú, ale platforma by mala použiť DOMPurify (isomorphic)
  alebo posielať ako `text` namiesto `html`.
- **Sync SMTP loop v bulk send-email** —
  `apps/web/src/app/api/applications/bulk/route.ts:113-181`. Pri cap 50
  emailov × 2-5s SMTP = až 250s wall-clock per HTTP request. Použiť
  `emailQueue` (BullMQ) — enqueue per-email job, vrátiť 202 hneď,
  status track cez audit log.
- **Pipeline/applicants sticky bar positioning v browseri** —
  `apps/web/src/components/employer/bulk-action-bar.tsx:130`. `sticky
top-0 z-10` sa môže nesprávne lepiť pod employer header. Otestovať
  vizuálne po deploy a prípadne pridať `top-[64px]` (offset header
  výšky) a `z-20`.

### P3

- **`PHONE_SCREEN` vs `PHONE` typ nesúlad** —
  `apps/web/src/app/api/applications/bulk/route.ts:78,97` má `as`
  cast na `Parameters<typeof bulkUpdateStage>[1]`. Service signature
  používa `'PHONE'` ale `APPLICATION_STAGES` má `'PHONE_SCREEN'`.
  Funguje runtime (`stage String` v Prisma bez enum), ale krehké.
  Fix: v `apps/web/src/services/application.service.ts` použiť
  `ApplicationStage` z constants ako typ stage parametra.
