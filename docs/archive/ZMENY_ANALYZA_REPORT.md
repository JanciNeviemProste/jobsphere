# ZMENY — Analýza & rozdelenie práce (JobSphere)

> Analytická fáza per `CC_ZMENY_ANALYZA_PROMPT.md`. Vstup = `zmeny.md` (~30 bodov od klienta). Zmapované cez 3 read-only agentov + Prisma schému. **Žiadny kód sa nemení** — implementácia čaká na potvrdenie po prejdení tohto reportu.
>
> **Rozhodnutia klienta (AskUserQuestion):** Q1 = quick-wins & bugfixy najprv · Q2 = chat **odložiť** · Q3 = editor firemného profilu = **AI-generovaná šablóna** (nie full drag-drop) · Q4 = scraper Profesie **stavať teraz** (akceptované právne riziko).
>
> Legenda statusov: **EXISTUJE** / **ČIASTOČNE** / **CHÝBA** · zložitosť **S / M / L / XL**.
> Pozn.: Prisma schéma je v repe **dvakrát** (`packages/db/prisma/schema.prisma` + `apps/web/prisma/schema.prisma`) — každá migrácia musí ísť do oboch.

---

## Status — Vlna 0 implementovaná (2026-07-01, branch `feat/zmeny-vlna-0`)

**Rozhodnutia z 5 otvorených otázok (vyriešené):**

1. **L44** → HR override **prepíše** AI %, pôvodné AI skóre sa archivuje _(Vlna 1)_.
2. **L57** → anti-cheat = **lock okna + fullscreen** MVP, bez kamery/nahrávania _(Vlna 2)_.
3. **L9** → stav prod Resendu **neznámy** → doplnené surface chyby do UI (nižšie); Jan overí doménu/kľúče.
4. **L11** → ostáva potvrdenie cez `/reset-password?token` (bez dedikovanej `/invite/accept`).
5. **L50** → **org-scoped default** + HR prepínač „naprieč firmami" **odložený do Vlny 2** (cross-org = GDPR súhlas). Vo Vlne 0 len presety 5/15/30.

**Vlna 0 — hotové (typecheck ✅ · lint ✅ · 638/638 testov ✅):**

- **L5** — „Nastavenia spoločnosti" v hornom menu (dropdown, gated `orgId`) — `components/layout/header.tsx`.
- **L42** — klik na meno v kanbane → detail uchádzača (`employer/applicants/[id]`) — `components/employer/pipeline-board.tsx`.
- **L15** — fix filtra `MEDIOR→MID`, doplnené `FREELANCE`/`INTERNSHIP`, SK labely — `jobs/jobs-client.tsx`.
- **L13** — samostatné pole **Lokalita** (poradie pozícia→lokalita, à la Profesia), search v `city`/`region` cez `AND` — `jobs-client.tsx` + `api/jobs/route.ts` + `jobs/page.tsx`.
- **L50** — presety **Top 5/15/30** (org-scoped AI matching) — `search-candidates-client.tsx`.
- **L9** — pozvánkové maily: API vracia `emailSent`, UI zobrazí varovanie pri zlyhaní — `api/organizations/current/members/route.ts` + oba invite dialógy (+ upravený test).
- **L48** — počet zobrazení **už existoval** (`Job.viewCount`), bez zmeny.

---

## Epic 1 — Firemný profil & nastavenia

### ✅ Rozumiem a je to jasné

- **L5 — Presunúť „Nastavenia spoločnosti" do horného menu.** ČIASTOČNE · **S**. Settings existujú na `/employer/settings`, chýba len položka v `components/layout/header.tsx` (navItems / account dropdown, podmienene pre `session.user.orgId`).
- **L11 — SubHR potvrdí pozvánku cez invite e-mail.** **EXISTUJE** · **S**. `api/organizations/current/members` POST → `User` + `VerificationToken` (7 dní) + `getInvitationEmail`; potvrdenie cez `/reset-password?token`. Invite dialóg pozná rolu **SUB_HR**.
- **L36 — Video + logo firmy v nastaveniach.** CHÝBA · **M**. `Organization.logo` pole existuje, ale `components/settings/profile-tab.tsx` nemá upload a PATCH `updateOrgSchema` ho neprijíma; `video` pole neexistuje. Blob upload infra hotová (`api/upload/photo`).
- **L7 — /jobs/new priradiť subHR pre pozíciu.** CHÝBA · **M**. Treba select členov vo `new-job-client.tsx`, prijať `assigneeId` v `api/jobs` POST a pole `Job.assignedRecruiterId` (migrácia).

### ❓ Potrebujem upresniť

- **L9 — „nastavenie e-mailov — pozvánky nefungujú".** Kód je OK (`lib/email.ts`, members route posiela best-effort a chyby len loguje). Root cause je najpravdepodobnejšie **konfigurácia** — máte v produkcii overenú doménu v Resend + `RESEND_API_KEY` a `EMAIL_FROM`? (A/B)
- **L11 — Chcete dedikovanú `/invite/accept` stránku,** alebo stačí súčasné potvrdenie cez nastavenie hesla (`/reset-password?token`)? (A: stačí súčasné / B: dedikovaná stránka)

### ⚠️ Konflikt s existujúcim

- **L7 vs. práva SUB_HR.** `api/jobs/route.ts` povoľuje vytvárať joby len `ORG_ADMIN`/`RECRUITER` (nie SUB_HR). Ak má subHR spravovať „svoju" pozíciu, treba rozšíriť oprávnenia — návrh **A:** subHR je len _priradený_ (job vytvára MainHR), **B:** subHR smie vytvárať/upravovať priradené joby.

### 🔗 Závislosti

- Pole „adresa pobočky" pri pozvánke na pohovor (L32) potrebuje **Branch** model → viď Epic 4.

---

## Epic 2 — Vyhľadávanie & filtre + duálna rola + CV

### ✅ Rozumiem a je to jasné

- **L13 — Poradie 1. Pracovná pozícia, 2. Lokalita (à la Profesia).** ČIASTOČNE · **M**. Dnes 1 kombinované search pole (`jobs/jobs-client.tsx`); pridať samostatné pole **Lokalita** (`city`/`region` do `where` v `api/jobs/route.ts`) + poradie.
- **L15 — Rozšíriť filtre typov prác.** ČIASTOČNE · **M**. Existujú workMode/jobType/seniority; doplniť plat, región/mesto, a `FREELANCE`/`INTERNSHIP` (enum ich už má).
- **L19 (časť) — Bežný človek vidí svoje CV.** **HOTOVÉ**. `/dashboard/cv`, `/create-cv`, `/api/cv/profile` fungujú.

### ⚠️ Konflikt s existujúcim

- **L15 — bug `MEDIOR` ↔ `MID`.** UI seniority používa `MEDIOR`, API enum je `MID` → hodnota sa nikdy nezhodne. Opraviť pri rozširovaní filtrov.

### 🔗 Závislosti

- **L17 — Freelancer = zároveň firma aj reaguje (duálna rola).** ČIASTOČNE · **L**. Dátovo možné (`UserOrgRole` M:N + `Candidate.userId` + `FreelancerProfile`), ale blokuje **jednohodnotová session** (`lib/auth.ts:208–220` → `token.role/orgId`), header routing (`/employer` vs `/dashboard`) a signup (núti 1 rolu). → **L19 (firma reaguje na ponuky) je ten istý problém** a rieši sa spolu: multi-rolová session + prepínač kontextu.

---

## Epic 3 — Komunikácia (chat, kalendár, plánovanie)

### ✅ Rozumiem a je to jasné

- **L23 — Kalendár do horného menu.** CHÝBA · **S/M**. Žiadna calendar route; `components/ui/calendar.tsx` je len date-picker.
- **L24 — Naplánovať hovor pre uchádzača + kolegov/HR.** CHÝBA · **L**. Žiadny scheduling model; `Notification` model = základ. Zdieľa **Interview/scheduling** model s L28/L32.

### ❓ Potrebujem upresniť

- **L21 — Gated chat firma↔uchádzač.** CHÝBA · **XL** → **ODLOŽENÉ (Q2).** Zaradiť do neskoršej vlny. (Pri návrate: real-time nový model + websocket, alebo postaviť na existujúcom e-mail inboxe.)

---

## Epic 4 — Kanban/ATS + pohovory + view count

### ✅ Rozumiem a je to jasné

- **L48 — Počet zobrazení inzerátu.** **EXISTUJE**. `Job.viewCount` + `api/jobs/[id]/view` + `view-tracker.tsx` + `employer/analytics`. Prípadne len doladiť, kde sa zobrazuje.
- **L42 — Klik v kanbane → profil uchádzača.** CHÝBA (cieľ existuje) · **S**. `pipeline-board.tsx` karta je `div` bez linku; cieľ `candidates/[id]/page.tsx` existuje — pridať `<Link>`.
- **L26 — Kanban → 4 stĺpce.** ČIASTOČNE · **S–M**. Teraz 7 stavov (`lib/constants/application-stages.ts`); prepísať konštanty + mapping.
- **L46 — Fotka uchádzača v mini-profile.** ČIASTOČNE · **S–M**. `User.avatar` je, ale `Candidate`/`CandidateContact` nemá avatar pole → migrácia + prepojenie.
- **L30 — Zjednotiť kanban + zoznam, filtre a tlačidlá.** ČIASTOČNE · **M**. Obe view existujú oddelene (`pipeline-board.tsx` / `applicants-table.tsx`); treba prepínač + bohatšie filtre.

### ❓ Potrebujem upresniť

- **L44 — „AI vyhodnotí % vhodnosti, HR to vie zmeniť vpravo hore".** ČIASTOČNE · **L**. % badge existuje (`applicant-summary-card.tsx`, číta `MatchScore`), ale nie v kanban karte a **HR override neexistuje**. Otázka: „HR zmení %" = manuálny override AI skóre uložený natrvalo (nové pole na `Application`/`MatchScore`)? Prepisuje AI hodnotu, alebo je to zvlášť „HR skóre"?

### ⚠️ Konflikt s existujúcim

- **L26 — migrácia dát.** `Application.stage` je voľný string v DB → zmena na 4 stavy vyžaduje **dátovú migráciu** existujúcich hodnôt (`PHONE_SCREEN`, `OFFER`, `HIRED`… → nové 4) + úpravu `z.enum` v `api/applications/[id]/route.ts`. Mapovanie starých→nových stavov treba odsúhlasiť.
- **L42 — nekonzistentný cieľ.** `applicants-table` dnes linkuje na `applicants/{id}` (detail žiadosti), nie `candidates/{id}` (profil). Zjednotiť, kam „klik na profil" smeruje.

### 🔗 Závislosti

- **L28 (video/fyzický pohovor v žiadosti)** + **L32 (pozvať na pohovor z inzerátu, adresa pobočky)** → oboje potrebujú **Interview model** (typ, dátum, meeting link / adresa) **a Branch model** (pobočky). L32 → Branch → adresa v pozvánke.

---

## Epic 5 — AI matching & testy

### ✅ Rozumiem a je to jasné

- **L50 — AI matching top 5/15/30 s %.** ČIASTOČNE · **M**. Engine hotový (`lib/semantic-search.ts` pgvector, `lib/ai-matching.ts` Claude 0–100, `packages/ai/match-score.ts`, `MatchScore`, worker, search UI). Chýbajú len **presety top 5/15/30**.
- **L52 — /jobs/new: otázky ALEBO test (checkbox).** CHÝBA · **M**. `new-job-client.tsx` nemá napojenie na assessment.
- **L54 — Test (Google-form) + AI tvorba + zobraziť pri reagovaní.** ČIASTOČNE · **L**. Builder + runner + AI-grading + invite token **existujú**; chýba **AI-generovanie testu** a **inline test v `apply-client.tsx`** (dnes len cez e-mail invite).

### ❓ Potrebujem upresniť

- **L50 — „celá databáza uchádzačov" (top 30).** Dnes je matching **org-scoped** (multitenant izolácia, GDPR fail-closed). Cross-org zdieľaný talent pool by porušil izoláciu a vyžadoval zvlášť právny základ. Potvrdiť: stačí **v rámci vlastnej firmy** (odporúčané), alebo naozaj cez všetky firmy? (A: len moja firma / B: cross-org + legal)
- **L57 — Anti-cheat (lock okna, kamera, nahrávanie).** CHÝBA · **L–XL**. `take-assessment-client.tsx` má len časovač. Otázka rozsahu: (A) len tab-focus/fullscreen lock, (B) + kamera náhľad, (C) + **nahrávanie** — kam ho uložiť (blob) a ako dlho (GDPR retention)?

### 🔗 Závislosti

- **L54** nadväzuje na **L52** (voľba testu v inzeráte). **L57** je nadstavba nad L54 (runner). AI-matching (L50) je nezávislé, môže ísť skoro.

---

## Epic 6 — Verejná stránka & firemné profily _(Q3: AI-generovaná šablóna)_

### ✅ Rozumiem a je to jasné

- **L34 — Landing logá firiem → verejný firemný profil (všetky inzeráty) + editor + brand manuál.** CHÝBA · **L** _(Q3 znížil z XL)_. Editor = **AI-generovaná šablóna** z nahraného brand manuálu (logo/farby/sekcie), **nie** voľný drag-drop.
- **L38 — Video/obrázok do inzerátu.** CHÝBA · **L**. `Job` nemá media polia → migrácia + upload (blob infra hotová) + render + validácia videa.
- **L40 — Sekcia „Profily firiem" (firma ako inzerát + logo).** CHÝBA · **M**. Nav nemá položku; listing firiem (karta = logo + prezentácia).

### ⚠️ Konflikt s existujúcim

- **L34 — rozbitý odkaz.** Job detail (`jobs/[id]/page.tsx:390,537`) už odkazuje na `/${locale}/company/${org.id}`, ale **stránka neexistuje → 404**. Pri implementácii treba dodržať túto route (`[locale]/company/[id]`), aby sa odkaz opravil.

### 🔗 Závislosti

- **L40** stavia na verejnom firemnom profile z **L34**. Media upload (L38) zdieľa blob infra s firemným videom (L36).

---

## Epic 7 — Superadmin & scraper _(Q4: scraper teraz)_

### ✅ Rozumiem a je to jasné

- **L61 — Superadmin rola.** **EXISTUJE**. `User.isGlobalAdmin` + `[locale]/admin/*` + `requireGlobalAdmin()`.
- **L59 — Pozvánka pre novú firmu e-mailom.** CHÝBA · **M**. Firmy dnes len self-signup; treba admin endpoint create org + invite token/email.
- **L63 — Superadmin pridá firmu + jej inzeráty.** ČIASTOČNE · **M–L**. `admin/organizations` + `admin/jobs` majú len GET+PATCH; **chýba POST create**.
- **L64 — Súhlas že to môžeme spraviť.** ČIASTOČNE · **S–M**. `ConsentRecord` infra existuje; pridať `consentType` `DATA_IMPORT`/`SCRAPING`.
- **L65 — Scraper z Profesie → import inzerátov.** CHÝBA · **XL** → **STAVAŤ TERAZ (Q4)**. Cron/queue základ hotový (`lib/cron.ts`, `lib/queue.ts`); nový worker fetch+parse Profesia → `Job` + dedup + plánovanie.

### ⚠️ Konflikt / riziko

- **L65 — právne riziko.** Scraping Profesia.sk môže porušovať ich ToS / autorské práva / GDPR. Klient akceptuje riziko (Q4), ale **odporúčam pred produkčným nasadením právne posúdenie** a rate-limit/robots rešpekt. Tech-debt na okraj: `requireGlobalAdmin()` je duplikovaný v každom admin route (zvážiť zdieľaný helper).

---

## Krok 4 — Poradie, paralelizácia a odporúčaný model

### Odporúčané poradie (vlny)

**Vlna 0 — Quick-wins & bugfixy (Q1, najprv; prevažne bez migrácie → paralelizovateľné) — model `sonnet`:**
L5 menu · L42 klik→profil · L48 viewCount UI · L15 fix `MEDIOR↔MID` + `FREELANCE`/`INTERNSHIP` · L50 presety top 5/15/30 · L9 invite maily (config) · L11 doladenie potvrdenia.

**Vlna 1 — Dátový model (mení Prisma schému — obe kópie! → koordinovane, nie slepo paralelne):**
L26 kanban 4 stĺpce + migrácia `stage` · L46 `Candidate.avatar` + L44 % v karte · L36 `Organization.video` + logo upload · L38 `Job` media · L32/Epic1 **Branch** model · L24/L28 **Interview** model · L7 `Job.assignedRecruiterId`.
Model: **`opusplan`** pre nové modely (Interview, Branch, dual-role), **`sonnet`** pre jednoduché polia.

**Vlna 2 — Väčšie features (po dátovom modeli):**
L17/L19 duálna rola — multi-rolová session (**`opusplan`**) · L30 zjednotiť kanban+zoznam (`sonnet`) · L52/L54 test v inzeráte + AI-generovanie + inline apply (**`opusplan`**) · L57 anti-cheat proctoring (**`opusplan`**) · L34/L40 verejné firemné profily + landing logá + „Profily firiem" + AI-šablóna editor (**`opusplan`**) · L23 kalendár (`sonnet`) · L59/L63 admin create org+jobs (`sonnet`) · L64 consent (`sonnet`) · L65 scraper Profesia (**`opusplan`**, XL).

**Odložené (Q2):** L21 chat.

### Čo sa dá robiť paralelne vs. sekvenčne

- **Paralelne:** celá Vlna 0 + čisto UI body (rôzne súbory, žiadna migrácia).
- **Sekvenčne / koordinovane:** všetko z Vlny 1 (mení zdieľanú Prisma schému + migrácie). Duálna rola (session/JWT) je cross-cutting → radšej samostatná session.

### Reťaze závislostí (🔗)

- Interview model: **L24 → L28 → L32** (adresa pobočky ⇐ **Branch**).
- Verejný profil: **L34 → L40**.
- Duálna rola: **L17 → L19**.
- Test: **L52 → L54 → L57**.
- Scraper: **L64 (consent) + L63 (admin-create) → L65**.

---

## Zhrnutie statusov (všetkých ~30 bodov)

| Epic                 | EXISTUJE       | ČIASTOČNE           | CHÝBA                   |
| -------------------- | -------------- | ------------------- | ----------------------- |
| 1 Firemný profil     | L11            | L5, L9              | L7, L36                 |
| 2 Vyhľadávanie/CV    | L19a (CV view) | L13, L15, L17, L19b | —                       |
| 3 Komunikácia        | —              | —                   | L21*(odlož.)*, L23, L24 |
| 4 Kanban/ATS         | L48            | L26, L30, L44, L46  | L28, L32, L42           |
| 5 AI/testy           | —              | L50, L54            | L52, L57                |
| 6 Verejné profily    | —              | —                   | L34, L38, L40           |
| 7 Superadmin/scraper | L61            | L63, L64            | L59, L65                |

**Najsilnejšie základy na stavanie:** AI matching engine, assessment engine (builder/runner/AI-grading/invite), `viewCount`, list+kanban views, e-mail infra, blob upload, `ConsentRecord`, superadmin.
**Najväčšie diery (od nuly):** scraper (L65), duálna rola session (L17/L19), Interview+Branch modely (L24/L28/L32), anti-cheat (L57), verejné firemné profily + AI editor (L34).

> **Ďalší krok:** prejsť tento report, doplniť odpovede na ❓ otázky, potom spustiť implementáciu Vlny 0. Bez potvrdenia sa neimplementuje.
