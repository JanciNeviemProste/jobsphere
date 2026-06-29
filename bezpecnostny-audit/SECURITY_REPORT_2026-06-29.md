# Bezpečnostný audit — JobSphere — 2026-06-29

> Vrstva 2 (security baseline) per `SECURITY_AUDIT_TESTS_REPORT.md`. Read-only audit cez 3 paralelných agentov (kategórie A–J) + `yarn audit` + priame overenie sporných nálezov, následne remediácia P0/P1 + testy.

## Zhrnutie pre netechnika

JobSphere mal už **silnú bezpečnostnú základňu** (multi-tenant izolácia, Stripe podpisy, rate-limiting, šifrovanie tokenov, password lockout). Audit našiel **10 nálezov** — väčšinou „defense-in-depth" medzery, nie aktívne diery. Opravili sme **7 z nich**: doplnili sme chýbajúcu CSRF + rate-limit ochranu na admin/org úpravách, povýšili zastaraný HTML-čistič s known XSS chybou, prestali sme logovať e-maily uchádzačov (GDPR), a dopísali sme 18 bezpečnostných testov na nové funkcie. Tri menej dôležité body sme vedome odložili (zdokumentované). Žiadny nález nebol „Critical" v aplikačnom kóde.

## Skóre a zlepšenie

| Metrika                          | Pred      | Po                                      | Δ           |
| -------------------------------- | --------- | --------------------------------------- | ----------- |
| Security posture (0–100)         | 69        | **94**                                  | +25 (+36 %) |
| Critical nálezy (app kód)        | 0         | 0                                       | 0           |
| High                             | 1         | 0                                       | −1          |
| Medium                           | 4         | 1                                       | −3          |
| Low                              | 5         | 2                                       | −3          |
| `yarn audit` Critical (deps)     | 1         | **0**                                   | −1          |
| Unit testy                       | 616       | **634**                                 | +18         |
| Security-critical cesty s testom | čiastočné | +cv/profile, +copy-CV (IDOR), +csrf lib | —           |

_(Posture = 100 − Crit·20 − High·10 − Med·4 − Low·1; heuristika pre porovnanie pred/po, nie absolútna pravda.)_

## Opravené nálezy

- **F4 (High) — zastaraný `sanitize-html` 2.17.3.** _Po lopate:_ HTML-čistič, ktorým prechádza text od používateľa (poznámky, popis firmy, e-maily), mal známu XSS chybu (obídenie cez `<xmp>`). _Fix:_ bump na `^2.17.4` (nainštalované 2.17.5); `yarn audit` Critical je teraz 0.
- **F1 (Medium) — chýbajúca CSRF ochrana na mutáciách.** _Po lopate:_ admin/firma úpravy (org profil, ban užívateľa, feature flags, DSAR) sa dali teoreticky spustiť cez podstrčenú cudziu stránku. _Fix:_ 7 routes zabalených do `withCsrfProtection(withRateLimit(...))` (org `[id]`, admin users/jobs/organizations/settings, users/`[id]`, gdpr/dsar/`[id]`). (SameSite=Lax cookie to už čiastočne tlmila.)
- **F2 (Medium) — chýbajúci rate-limit na tých istých mutáciách.** _Fix:_ preset `api` v tom istom wrappri.
- **F5 (Medium) — e-mail uchádzača v logoch (GDPR).** _Po lopate:_ odhlasovací endpoint logoval celý e-mail. _Fix:_ `maskEmail()` → `j***@gmail.com`.
- **F3 (Low) — email webhook.** _Korekcia auditu:_ signatúra **už fail-closed v produkcii** (pôvodný nález „fails open" bol false-positive). Pridaný len `withRateLimit` (defense-in-depth).
- **F9 (Low) — `antivirus.ts`.** `crypto.randomUUID()` fungoval cez Node global, doplnený explicitný `import { randomUUID } from 'node:crypto'`. (Audit to nadhodnotil ako Critical — overené, že funguje.)
- **F10 (Low) — `semantic-search.ts`** importoval deprecated `@/lib/db`; zmenené na `@/lib/prisma`.

## Pridané testy (18)

- `cv/profile/__tests__/route.test.ts` (8) — auth boundary (401) na GET/POST/DELETE; 400 na nevalidný/prázdny vstup; **ownership/IDOR**: CV sa ukladá/maže/číta len na vlastnom personal candidate.
- `applications/__tests__/copy-cv.test.ts` (3) — `copyProfileCvToCandidate` **odmietne skopírovať cudzí CV** (IDOR), normalizuje builder→employer shape, je best-effort (nikdy nehodí).
- `lib/__tests__/csrf.test.ts` (7) — token round-trip, odmietnutie tampered/malformed tokenov, `withCsrfProtection` accept/reject (same-site vs cross-site).

## Korektne ošetrené (silná základňa — bez nálezu)

Parametrizované Prisma raw SQL · Stripe webhook (podpis + idempotencia + server-side cena) · SSRF guard `isAllowedCvUrl()` · org-scoping/IDOR (cross-gig proposal, semantic-search `organizationId`) · file-upload (MIME/size/ClamAV/macro) · password reset (token-before-update + `sessionEpoch` revocation) · Zod validácia · GDPR data minimization · žiadne hardcoded secrets, `.env*` gitignored.

## Zostáva (P1/P2 follow-up)

- **F6 (Medium, deferred)** — CV blob `access:'public'`. Mitigované app-layer (auth download route + neuhádnuteľná URL). Vyžaduje upgrade `@vercel/blob` na `access:'private'`. _(CLAUDE.md nepravdivé tvrdenie „private" opravené.)_
- **F7 (Low, deferred)** — over single-use/short-lived download tokeny v GDPR exporte.
- **F8 (Low, accepted)** — prompt injection v CV→LLM (mitigované JSON schema parse; output sa nepoužíva na auth/query). Voliteľné: `<CV>` delimitery.
- **na overenie v prode:** `CSRF_SECRET` nastavený (inak per-process fallback rozbije multi-instance); email webhook secrety; 77 transitive High `yarn audit` (väčšinou `swagger-ui-react`/build-tooling — runtime-nereachable).
