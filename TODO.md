# TODO

Open follow-ups z post-MVP code review (commit aa13273).

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
