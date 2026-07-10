# JobSphere — Pred-produkčný testovací report

**Dátum:** 2026-07-10 · **Vetva:** `main` · **Prostredie:** živá produkcia `jobsphere.eu` (Neon DB) + statický audit kódu
**Metóda:** 10 agentov — 4 paralelní audit agenti (kód) + 6 sekvenčných QA prechodov (live browser, QA účty)

---

## 1. Verdikt: **GO (podmienené)**

Jadro aplikácie je pripravené do produkcie. Build je zelený, žiadny Critical nález, žiadna rozbitá stránka ani 500-ka, RBAC/multi-tenancy je konzistentne správne. Nájdené problémy sú v **okrajových integráciách** (e-mail OAuth, upload fotky, scraper consent), nie v hlavnom hiring flow.

**Podmienky pred „ostrým" spustením marketingu:**

1. Opraviť **H1** (OAuth tokeny v plaintext) — alebo **nezapínať** e-mail OAuth integráciu, kým sa neopraví.
2. Opraviť 2 auth Mediums: `user/cvs` (cross-user PII) a `upload/photo` (chýba auth).
3. Zvyšok (CSRF medzery, i18n, SEO tituly) doriešiť v prvom údržbovom PR — neblokuje spustenie.

| Kontrola                       | Výsledok                                    |
| ------------------------------ | ------------------------------------------- |
| `yarn typecheck`               | ✅ PASS — 0 chýb (5/5 packages)             |
| `yarn lint`                    | ✅ PASS — 0 errorov / 0 warningov           |
| `yarn test` (vitest)           | ✅ PASS — **726/726** testov                |
| Playwright discovery           | ✅ 392 testov / 31 súborov, bez import chýb |
| Live stránky (~35 URL, 4 role) | ✅ 0 console errorov, 0 rozbitých stránok   |
| RBAC / redirect matica         | ✅ všetky 4 prípady správne                 |

**Security posture (prepočet): 62/100** pri audite → **91/100 po remediácii** (vetva `fix/pre-prod-security-remediation`). Zostáva 1 Medium (M5, deferred — schema refactor) + scraper consent (legal). **0 Critical, 0 High, 0 open blocker.**
Prepočet od 100: audit High −10 · 5× Medium −20 · 8× Low −8 = 62; po oprave H1 + 5 Medium + 6 Low ostáva 1 Medium (−4) + ~5 Low (−5) = 91.

> **Stav remediácie (2026-07-10):** ✅ opravené — H1 (OAuth tokeny šifrované + CSRF/Zod), M1 (`user/cvs` userId scoping), M2 (`upload/photo` auth), M3 (OAuth CSRF), M4 (`sequences/enroll` CSRF), M6 (markdown na kartách) + všetky Low (CSRF na `cv/parse`/`jobs.save|view`, info-leak `candidates/search`, IP hash `web-vitals`, rate-limit `members/[userId]`, PII redakcia logger, funkčný bug `match-score`/`recommended`, SEO tituly, SK/EN i18n). Doplnené testy: `user/cvs`, `upload/photo`, `email/oauth/gmail`. **Deferred:** M5 (mŕtve šifrovanie IMAP/SMTP — schema refactor workerov, samostatný PR) + scraper consent (legal).

---

## 2. Nálezy podľa severity

### 🔴 High (1)

**H1 — E-mail OAuth POST endpointy ukladajú tokeny v plaintext** (obchádzajú AES-256-GCM)
`api/email/oauth/gmail/route.ts:106` · `api/email/oauth/microsoft/route.ts:108`
Callbacky tokeny šifrujú, ale manuálne POST endpointy ukladajú `oauthJson` s access/refresh tokenmi (scope `Mail.ReadWrite`, `gmail.modify`) ako **čistý text**. Navyše nemajú CSRF/rate-limit/Zod (viď M3), takže cez `text/plain` telo sa dá tokeny aj podvrhnúť.
**Dopad:** firemné mailbox tokeny čitateľné z DB dumpu/replík/logov; možnosť čítať/odosielať org e-maily cez podvrhnutý mailbox.
**Fix:** šifrovať `encrypt(JSON.stringify(...))` ako v callbacku (alebo tieto „test" endpointy odstrániť z prod) + obaliť `withCsrfProtection(withRateLimit(...))` + Zod.

### 🟠 Medium (6)

**M1 — `user/cvs` vracia CV iného usera v rámci org** (chýba `userId` scoping)
`api/user/cvs/route.ts:31` — kandidát sa rezolvuje len podľa `orgId`, takže vráti prvého kandidáta org a jeho resume-summary. Cross-user PII únik v rámci org. **Fix:** `where: { orgId, userId: session.user.id }`.

**M2 — `upload/photo` bez `auth()` guardu** — neautentikovaný zápis do verejného Blobu
`api/upload/photo/route.ts:18` — na rozdiel od `logo`/`video` chýba auth; MIME sa neoveruje z obsahu. Free file-hosting / náklady na storage. **Fix:** pridať auth guard + magic-byte check.

**M3 — `email/oauth/*` POST bez CSRF/rate-limit/Zod** (viď aj H1)
Umožňuje CSRF token-injection cez `text/plain` telo. **Fix:** bezpečnostné wrappery + Zod.

**M4 — `sequences/[id]/enroll` POST bez `withCsrfProtection`**
`api/sequences/[id]/enroll/route.ts:18` — reálna mutácia, ktorá spúšťa odosielanie e-mailov kandidátovi; CSRF-om sa dá vyvolať nechcený enroll. **Fix:** doplniť CSRF wrapper.

**M5 — Šifrovanie mail tokenov je fakticky „mŕtve"; IMAP/SMTP heslá plaintext**
Workeri (`packages/workers/...`) čítajú plaintext stĺpce `accessToken`/`refreshToken`, ktoré v `apps/web` schéme ani neexistujú (schema divergencia); `oauthJson` nikto nedešifruje; `imapPass`/`smtpPass` sú `String` bez šifrovania. **Fix:** zjednotiť model tokenov, čítať cez `decrypt()`, šifrovať IMAP/SMTP heslá.

**M6 — UI: karty ponúk zobrazujú surový markdown** — na `/jobs` sa `## O pozícii …` renderuje ako holý text namiesto naformátovaného/oskráteného náhľadu. Kozmeticky kazí verejný listing. **Fix:** markdown render alebo strip + truncate v komponente karty.

### 🟡 Low (výber z 11)

- **Scraper DATA_IMPORT consent je globálny** (`profesia-import.ts:78`) — jediný granted consent spustí import pre všetkých; neviazaný na subjekt/org. (Zmierňuje: importujú sa verejné ponuky, nie PII osôb.)
- **`candidates/search` leakuje `error.message`** v 500 odpovedi (`route.ts:119`).
- **`analytics/web-vitals` ukladá IP bez consentu** (GDPR) — anonymizovať/hashovať.
- **`members/[userId]` PATCH/DELETE bez rate-limitu** (citlivá zmena roly).
- **GDPR export nepokrýva EmailMessage/notifikácie/savedJobs** (Art. 15 úplnosť).
- **Logger bez PII redakcie** (`lib/logger.ts`) — doplniť denylist `token/secret/password`.
- **`jobs/[id]/match-score` a `jobs/recommended`** používajú chybný `where: { orgId: session.user.id }` → vždy 404 (fail-closed, funkčne mŕtve, nie exploit).
- **SEO/i18n (live):** zdvojený title suffix `… | JobSphere | JobSphere` na väčšine lokalizovaných stránok; SK/EN mix na `/en` (nav „Profily firiem/Freelanceri/Zákazky", SK tituly); niektoré stránky bez špecifického `<title>` (`/dashboard/cv`, `/employer/gigs`, `/admin/organizations|jobs|subscriptions|settings` → len „JobSphere").
- **`jobs/new` nemá „Uložiť ako koncept"** — inzerát ide priamo na „Publish"; chýba draft stav (produktová medzera + komplikuje QA).

---

## 3. Matica pokrytia (live QA)

| Oblasť                   | Stránky                                                                                                                                                                                                          | Výsledok                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **B1 Verejné/anon**      | `/`, `/jobs`(+detail), `/companies`, `/freelancers`, `/gigs`, `/pricing`, `/features`, `/for-employers`, `/about`, `/contact`, `/blog`, `/career-advice`, `/academy`, `/api-docs`, `/privacy`, `/terms`, `/gdpr` | ✅ všetky render, 0 errorov                                                             |
| **B2 Auth & RBAC**       | login (candidate/owner/superadmin) · anon→`/employer`→`/login` · candidate→`/employer`→`/dashboard?error=no_organization` · owner→`/admin`→`/login?error=forbidden` · superadmin→`/admin`→OK                     | ✅ všetko správne                                                                       |
| **B3 Candidate**         | dashboard, profile, CV; **apply flow end-to-end** (prihláška vytvorená, zobrazená v dashboarde)                                                                                                                  | ✅ funguje                                                                              |
| **B4 Employer**          | dashboard, **pipeline (4-stĺpcový kanban)**, analytics, calendar, applicants, sequences, gigs, settings/team, **jobs/new (kompletný formulár: sub-HR recruiter, ad media, screening/test)**                      | ✅ render OK; job NEODOSLANÝ (žiadny draft → nechcel som publikovať na verejný listing) |
| **B5 Employer advanced** | assessment builder, calendar, branches — stránky render; interview/override/dual-role vyžadujú seed dáta (QA org je prázdna)                                                                                     | ⚠️ čiastočne (bez dát)                                                                  |
| **B6 Admin**             | `/admin`, users, organizations, jobs, subscriptions, settings                                                                                                                                                    | ✅ všetky render, guard OK                                                              |

**Poznámka:** hĺbkové write-journeys (kanban drag, HR override %, plánovanie pohovoru → kalendár, dual-role prepínač, assessment runner + anti-cheat) neboli dokončené naostro, lebo QA org nemá inzeráty/uchádzačov a vytvorenie inzerátu by ho publikovalo na verejný `/jobs`. Tieto flow sú pokryté E2E testami (`tests/e2e/journeys/*`) — odporúčam spustiť ich v CI proti test DB.

---

## 4. Odporúčané dopísanie testov (z A4)

Endpointy bez dedikovaných testov, poradie podľa rizika:

- **Critical (6):** `cv/upload`, `cv/parse`, `webhooks/email`, `email/oauth/*`, `admin/gdpr/dsar/[id]`, `organizations/current/billing`.
- **High (8):** `applications/[id]/send-email`, `applications/[id]/notes`, `sequences` list/create, `assessments/[id]/submit`, `organizations/current/members/[userId]`, `admin/scraper/run`, `upload/photo`, `freelancer/profile`.
- **Medium (6):** `jobs/[id]/save|view`, `jobs/recommended`, `dashboard/stats`, `user/preferences`, `analytics/web-vitals`.

Vzor: `mockDeep<PrismaClient>()` route testy (napr. `gigs/[id]/proposals/[proposalId]/__tests__/proposal-idor.test.ts`), dôraz na org-scoping / IDOR / authZ.

---

## 5. Overené ako správne (bez nálezu)

Auth jadro (session-epoch revocation, dual-role switch-authz), `requireGlobalAdmin` na všetkých `/api/admin/*`, org-scoping cez resource (`job.orgId`/`candidate.userId`/`gig.orgId` + `UserOrgRole`), **žiadna SQL injection** (všetky `$queryRaw` parametrizované), file-upload (magic-byte MIME + ClamAV + DOCX/DOCM macro detekcia, SVG vylúčené), Stripe webhook (podpis + idempotencia) + checkout/portal RBAC, OAuth state (HMAC + timingSafeEqual + expirácia), DSAR DELETE = reálne mazanie, `cv/[documentId]/download` (owner-OR-org + SSRF allowlist + private blob), assessment runner (žiadny leak odpovedí), cron bez nechráneného triggeru, žiadne hardcoded secrets.

---

## 6. Upratovanie QA artefaktov

Počas testu vznikla **1 testovacia prihláška** (qa.candidate → „Senior React Developer"). Cleanup (spusti v Neon SQL editore, keď skončíš testovanie):

```sql
-- Zmazať QA testovaciu prihlášku
DELETE FROM "Application"
WHERE "candidateId" IN (
  SELECT c.id FROM "Candidate" c
  JOIN "User" u ON u.id = c."userId"
  WHERE u.email = 'qa.candidate@test.jobsphere.eu'
);

-- (Voliteľné) kompletné zmazanie QA účtov po testovaní:
-- DELETE FROM "UserOrgRole" WHERE "orgId" = 'qa-test-org';
-- DELETE FROM "FreelancerProfile" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'qa.%@test.jobsphere.eu');
-- DELETE FROM "Application" WHERE "candidateId" IN (SELECT id FROM "Candidate" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'qa.%@test.jobsphere.eu'));
-- DELETE FROM "Candidate" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE 'qa.%@test.jobsphere.eu');
-- DELETE FROM "User" WHERE email LIKE 'qa.%@test.jobsphere.eu';
-- DELETE FROM "Organization" WHERE id = 'qa-test-org';
```
