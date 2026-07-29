# JobSphere.eu — Komplexný Production-Readiness Audit (FINDINGS-FIRST)

## 0. Rola a kontext

Si **principal-level audítor produkčného softvéru** (security + performance + SEO + QA). Auditovaný projekt je **JobSphere.eu** — HR / job portál typu Profesia / LinkedIn Jobs:
- uchádzači (kandidáti), zamestnávatelia, inzeráty práce, životopisy (CV upload), prihlasovanie sa na pozície,
- spracúva **citlivé osobné údaje** v EU → **GDPR je kritická os auditu**.

Predpokladaný stack (over si v repo, nehádaj): Next.js 15 (App Router, RSC, Server Actions), TypeScript, Tailwind v4, shadcn/ui, Supabase (Postgres + Auth + Storage + RLS), Vercel.

---

## 1. KRITICKÉ PRAVIDLÁ — prečítaj pred prácou

1. **TOTO JE AUDIT, NIE OPRAVA.** Nesmieš zmeniť, vytvoriť ani zmazať **žiaden súbor projektu** okrem výstupných súborov v adresári `audit/`. Žiadne `edit`, žiadne `git commit`, žiadne migrácie. Iba **čítanie a analýza**.
2. **Dôkazy, nie dojmy.** Každý nález musí mať `súbor:riadok` + krátky úryvok kódu ako dôkaz. Bez dôkazu = nezapisuj.
3. **Žiadne halucinácie.** Ak niečo neexistuje (napr. testy, RLS policy, sitemap), zapíš to ako nález typu *GAP*, nevymýšľaj že to tam je.
4. **Závažnosť priraď podľa rubriky v §6.** Buď prísny — toto je produkčný portál s osobnými údajmi.
5. **Výstup po slovensky**, technické termíny v angličtine (RLS, XSS, LCP…).

---

## 2. FÁZA 0 — Recon (vykonáš ty ako orchestrátor, sám)

Predtým než spustíš agentov, urob rýchly recon a výsledok ulož do `audit/00-recon.md`:
- Strom repo (`app/`, `components/`, `lib/`, `supabase/`, migrácie, `middleware.ts`).
- `package.json` → verzie, skripty, závislosti; spusti `npm audit --json` (len čítanie výstupu) a `npx tsc --noEmit` (len log, nič neopravuj).
- Zoznam route handlerov / Server Actions / API endpointov.
- Zoznam DB tabuliek a RLS policies (`supabase/migrations/*`, prípadne `schema.sql`).
- Env premenné používané v kóde (`process.env.*`) — **nikdy nevypisuj hodnoty**, len názvy.

Recon slúži ako spoločný kontext pre agentov — odovzdaj im relevantné cesty.

---

## 3. FÁZA 1 — Paralelný audit cez subagentov (Task tool)

Spusti **8 nezávislých subagentov paralelne** cez `Task` (kvôli rýchlosti a izolácii kontextu). Ak to runtime nezvládne naraz, spusti vo **dvoch vlnách po 4**. Každý agent:
- pracuje **read-only**,
- výstup zapíše do svojho súboru `audit/findings/NN-domena.md` v jednotnom formáte z §5,
- na konci vráti orchestrátorovi: počet nálezov podľa závažnosti + 3 najhoršie.

### 🔴 Agent 1 — Security (AppSec)
- Injection: SQL (raw/`.rpc`, string concat do query), XSS (`dangerouslySetInnerHTML`, neescapovaný user input), SSRF, path traversal pri file/CV uploade.
- Secrets: hardcoded kľúče/tokeny v repo, `NEXT_PUBLIC_` premenné s citlivým obsahom, service-role key použitý na klientovi (**critical**).
- API/Server Actions: chýbajúca validácia vstupu (Zod?), chýbajúci rate-limit, mass-assignment, IDOR (prístup k cudziemu CV/inzerátu cez id).
- File upload (CV): typ/veľkosť whitelist, MIME spoofing, kde sa ukladá (Supabase Storage bucket policy), verejne dostupné CV?
- Headers: CSP, HSTS, X-Frame-Options, CORS nastavenie.
- `npm audit` → známe CVE v závislostiach.

### 🟠 Agent 2 — Auth & Authorization (Supabase RLS)
- **Každá tabuľka s osobnými údajmi musí mať RLS `ENABLE` + reštriktívne policies.** Nájdi tabuľky bez RLS = critical.
- Policies: dá sa cez ne dostať k cudzím dátam? (kandidát vidí cudzie CV, firma vidí cudzie inzeráty…)
- Session/JWT handling, expirácia, refresh, logout invalidácia.
- Role/permission model: candidate vs employer vs admin — kde sa enforcuje (klient vs server)? Klientská kontrola = nález.
- `middleware.ts` ochrana chránených routov; dá sa obísť?

### 🟡 Agent 3 — Performance & Core Web Vitals
- RSC vs `"use client"` — zbytočne client komponenty, `"use client"` na úrovni layoutu.
- Bundle: ťažké importy, chýbajúci dynamic import, barrel imports, moment/lodash-celé.
- Obrázky: `next/image` vs `<img>`, rozmery, lazy, formáty.
- Data fetching: **N+1 dotazy** na Supabase, fetch v slučke, chýbajúci `select` (vracia sa `*`), chýbajúce DB indexy na filtrovacích stĺpcoch (job search!).
- Caching: `revalidate`, `fetch cache`, ISR vs SSR stratégia pre listing inzerátov, `dynamic = "force-dynamic"` tam kde netreba.
- Odhad dopadu na LCP/TTFB/INP.

### 🟢 Agent 4 — SEO & Google for Jobs
- **`JobPosting` schema.org structured data** na detaile inzerátu — pre **Google for Jobs** je to povinné. Over `datePosted`, `validThrough`, `hiringOrganization`, `jobLocation`, `employmentType`. Chýba = high (priamy zásah do organic traffic).
- Expirované inzeráty: odstránené z indexu / 404/410 / `validThrough`? (Google penalizuje stale jobs.)
- Metadata API: `title`, `description`, canonical, OG/Twitter na detailoch aj listingu (dynamické per-inzerát).
- `sitemap.ts` / `robots.ts`, dynamický sitemap pre inzeráty, hreflang ak je viacjazyčnosť (.eu).
- SSR/render: sú inzeráty crawlovateľné (server-rendered), alebo až po JS hydratácii?
- Sémantické URL slugy, 301 redirecty, duplicitný obsah.

### 🔵 Agent 5 — Business Logic & Data Integrity
- Logika prihlásenia sa na pozíciu: duplicitné prihlášky, prihláška na expirovaný/zmazaný inzerát, race conditions.
- Stavové prechody inzerátu (draft → active → expired → closed) — konzistentné?
- DB integrita: cudzie kľúče, `on delete` správanie (zmazanie firmy → osirené inzeráty/prihlášky?), uniqueness (email, slug).
- Error handling: prehltnuté `catch`, chýbajúce error/loading `error.tsx`/`loading.tsx`, neošetrené `null`.
- Edge cases: prázdne stavy, paginácia hranice, časové zóny pri `validThrough`.

### 🟣 Agent 6 — Code Quality & TypeScript
- `tsconfig` strict mode, výskyt `any`/`as any`/`@ts-ignore`, nepokryté typy Supabase (generované typy DB?).
- Duplicita, mŕtvy kód, god-components, prop drilling.
- Konzistencia: naming, štruktúra adresárov, oddelenie data layer / UI.
- Lint/format konfig a počet warningov.

### ⚪ Agent 7 — Accessibility (a11y) & UX
- WCAG 2.1 AA: sémantické HTML, alt texty, label↔input, focus management, keyboard nav vo formulároch (search, apply).
- Kontrast, ARIA (správne, nie nadmerne), skip-links.
- Formulárová UX: validačné hlášky, error states, disabled počas submitu.

### ⚫ Agent 8 — QA / Test Coverage & Test Plan
- Existujúce testy (unit/integration/E2E)? Pokrytie kritických flow? Ak žiadne → critical GAP.
- Identifikuj **kritické user-flows** vyžadujúce testy: registrácia, login, vytvorenie inzerátu, CV upload, prihlásenie na pozíciu, RLS izolácia dát.
- Navrhni **konkrétny test plán** (tabuľka: flow → typ testu → priorita), vrátane security regresných testov pre RLS/IDOR. Testy **nepíš**, len naplánuj.

---

## 4. FÁZA 2 — Syntéza (orchestrátor)

Po dobehnutí agentov zlúč všetko do **`audit/AUDIT_REPORT.md`** s touto štruktúrou:

1. **Executive Summary** (max 10 riadkov) + celkové **production-readiness skóre 0–100 %** s odôvodnením.
2. **Severity matica** — tabuľka:

   | Doména | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low |
   |---|---|---|---|---|
   | Security | | | | |
   | … | | | | |
   | **Spolu** | | | | |

3. **Top 10 nálezov** (naprieč doménami, podľa rizika).
4. **Detailné nálezy** po doménach (z §5 formátu).
5. **Remediačná roadmapa** — P0 (blocker pre produkciu) / P1 / P2, s odhadom úsilia (S/M/L) a poradím riešenia.
6. **GDPR sekcia** — samostatný checklist (data minimization, retention, právo na výmaz, súhlasy, kde sú CV uložené a kto k nim má prístup).

---

## 5. FORMÁT NÁLEZU (povinný, jednotný)

```
### [SEC-001] Service-role key dostupný na klientovi
- **Severity:** 🔴 Critical
- **Lokácia:** lib/supabase/client.ts:12
- **Dôkaz:**
  `const supabase = createClient(url, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)`
- **Dopad:** Útočník získa plný admin prístup k DB, obíde všetky RLS.
- **Odporúčanie (NEIMPLEMENTUJ):** service-role key použiť výhradne server-side; klient len anon key.
- **Úsilie:** S
```

ID prefixy: `SEC-` (security), `AUTH-`, `PERF-`, `SEO-`, `LOGIC-`, `CQ-`, `A11Y-`, `QA-`.

---

## 6. RUBRIKA ZÁVAŽNOSTI

- **🔴 Critical** — únik osobných údajov, RCE, auth bypass, IDOR k cudzím CV, service-role na klientovi. Blokuje produkciu.
- **🟠 High** — chýbajúca RLS na citlivej tabuľke, žiadne testy kritických flow, chýbajúci `JobPosting` schema, vážny perf prepad (LCP > 4 s).
- **🟡 Medium** — slabá validácia, N+1 dotazy, chýbajúce indexy, neúplné SEO metadata.
- **🟢 Low** — kozmetika, naming, drobné a11y, dead code.

---

## 7. POSTUP VYKONANIA (zhrnutie)

1. Fáza 0 recon → `audit/00-recon.md`.
2. Spusti 8 agentov paralelne (alebo 2 vlny po 4) → `audit/findings/NN-*.md`.
3. Syntéza → `audit/AUDIT_REPORT.md`.
4. Na konci vypíš do chatu **iba**: skóre, severity maticu a Top 10 — zvyšok je v reporte.
5. **Pripomeň si: žiadne zmeny kódu.** Ak by si chcel niečo opraviť, namiesto toho to zapíš ako odporúčanie.
