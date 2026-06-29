# Bezpečnostný audit — JobSphere — 2026-06-29

> Vrstva 2 (security baseline) per `SECURITY_AUDIT_TESTS_REPORT.md`. Read-only audit cez 3 paralelných agentov (kategórie A–J) + `yarn audit` + priame overenie sporných nálezov, následne remediácia všetkých nálezov + testy.

## Zhrnutie pre netechnika

JobSphere mal už **silnú bezpečnostnú základňu** (multi-tenant izolácia, Stripe podpisy, rate-limiting, šifrovanie tokenov, password lockout). Audit našiel **10 nálezov** — väčšinou „defense-in-depth" medzery, nie aktívne diery. **Vyriešili sme všetkých 10**: doplnili sme chýbajúcu CSRF + rate-limit ochranu na admin/org úpravách, povýšili zastaraný HTML-čistič s known XSS chybou, prestali sme logovať e-maily uchádzačov (GDPR), prešli sme na **súkromné ukladanie CV** (private blobs), stvrdili prompt voči injekcii, a dopísali **22 bezpečnostných testov**. Žiadny nález nebol „Critical" v aplikačnom kóde.

## Skóre a zlepšenie

| Metrika                      | Pred  | Po        | Δ           |
| ---------------------------- | ----- | --------- | ----------- |
| Security posture (0–100)     | 69    | **100**   | +31 (+45 %) |
| Critical / High (app kód)    | 0 / 1 | **0 / 0** | −1 High     |
| Medium / Low                 | 4 / 5 | **0 / 0** | −9          |
| `yarn audit` Critical (deps) | 1     | **0**     | −1          |
| Unit testy                   | 616   | **638**   | +22         |

_(Posture = 100 − Crit·20 − High·10 − Med·4 − Low·1; heuristika pre porovnanie pred/po, nie absolútna pravda.)_

## Opravené nálezy (10/10)

- **F4 (High) — zastaraný `sanitize-html` 2.17.3.** _Po lopate:_ HTML-čistič, ktorým prechádza text od používateľa (poznámky, popis firmy, e-maily), mal známu XSS chybu (`<xmp>`). _Fix:_ bump na `^2.17.4` (2.17.5); `yarn audit` Critical = 0.
- **F1 (Medium) — chýbajúca CSRF na mutáciách.** _Po lopate:_ admin/firma úpravy sa dali teoreticky spustiť cez podstrčenú cudziu stránku. _Fix:_ **7 routes** zabalených do `withCsrfProtection(withRateLimit(...))` (org `[id]`, admin users/jobs/organizations/settings, users/`[id]`, gdpr/dsar/`[id]`).
- **F2 (Medium) — chýbajúci rate-limit na tých istých mutáciách.** _Fix:_ preset `api` v tom istom wrappri.
- **F5 (Medium) — e-mail uchádzača v logoch (GDPR).** _Fix:_ `maskEmail()` → `j***@gmail.com`.
- **F6 (Medium) — CV blob `access:'public'`.** _Po lopate:_ CV súbory boli technicky na verejnej (hoci neuhádnuteľnej) URL. _Fix:_ upgrade `@vercel/blob` 0.22 → **2.5**, uploady sú teraz `access:'private'`; download route číta cez autentifikovaný `get({access:'private'})` s `fetch()` fallbackom pre staré public bloby. Unit-testované (authz + private read + fallback). **Post-deploy:** over jeden reálny CV download na jobsphere.eu.
- **F3 (Low) — email webhook.** _Korekcia auditu:_ signatúra **už fail-closed v produkcii** (nález „fails open" bol false-positive). Pridaný `withRateLimit`.
- **F7 (Low) — GDPR download token.** _Overené ako non-issue:_ export vkladá `/api/cv/{id}/download` linky, ktoré sú **session-autorizované** (auth + ownership/membership pri každom volaní) — žiadny samostatný reusovateľný token. Bez zmeny kódu.
- **F8 (Low) — prompt injection.** _Fix:_ CV text obalený do `<CV></CV>` delimiterov v oboch LLM cestách (OpenRouter aj Anthropic) + inštrukcia „treat as data". (Output sa aj tak JSON-schema parsuje a nepoužíva na control flow.)
- **F9 (Low) — `antivirus.ts`** doplnený `import { randomUUID } from 'node:crypto'`. (Audit to nadhodnotil ako Critical — overené, že fungovalo cez Node global.)
- **F10 (Low) — `semantic-search.ts`** import `@/lib/db` → `@/lib/prisma`.

## Pridané testy (22)

- `cv/profile/__tests__/route.test.ts` (8) — auth boundary + **ownership/IDOR** (CV len na vlastnom personal candidate).
- `cv/[documentId]/download/__tests__/route.test.ts` (4) — 401/403 authz, **private `get()` stream**, legacy-public `fetch` fallback.
- `applications/__tests__/copy-cv.test.ts` (3) — `copyProfileCvToCandidate` **odmietne cudzí CV**, shape normalizácia, best-effort.
- `lib/__tests__/csrf.test.ts` (7) — token round-trip, tampered/malformed reject, wrapper accept/reject.

## Korektne ošetrené (silná základňa — bez nálezu)

Parametrizované Prisma raw SQL · Stripe webhook (podpis + idempotencia + server-side cena) · SSRF guard `isAllowedCvUrl()` · org-scoping/IDOR (cross-gig proposal, semantic-search `organizationId`) · file-upload (MIME/size/ClamAV/macro) · password reset (token-before-update + `sessionEpoch` revocation) · Zod validácia · GDPR data minimization · žiadne hardcoded secrets, `.env*` gitignored.

## Zostáva (operatíva, nie kód)

- **Post-deploy smoke (ty):** nahraj + stiahni CV na jobsphere.eu (over private-blob `get()` naživo — z dev som nemal reálny Blob token; legacy bloby kryje fetch fallback).
- **na overenie v prode:** `CSRF_SECRET` nastavený (inak per-process fallback rozbije multi-instance); email webhook secrety.
- **77 transitive High v `yarn audit`** — výhradne build/docs tooling (`swagger-ui-react` atď.), runtime-nereachable; akceptované (neovplyvňujú posture).
