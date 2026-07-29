# PROMPT: Analýza zmeny.md pre JobSphere

> Spusti v Claude Code s `/model opusplan` (alebo priamo `/model opus` na túto fázu — je to čisto analýza/plánovanie, exekúcia ešte nezačína).

---

## Kontext

Pracujeme na projekte **JobSphere** (Next.js 15, TypeScript, Turborepo, Prisma/Neon, NextAuth, shadcn/ui). V roote repa je súbor `zmeny.md` — nesystematický zoznam feature requestov a bugfixov od klienta/produktového vlastníka, písaný voľne, po slovensky, bez technických detailov. Niektoré body sú jasné bugfixy, iné sú veľké architektonické features (AI matching, anti-cheat testovanie, superadmin, scraper).

**Cieľ tejto fázy: NEIMPLEMENTOVAŤ nič. Iba pochopiť, rozklasifikovať, spýtať sa na nejasnosti a navrhnúť rozdelenie práce.**

---

## Krok 1 — Načítanie kontextu

1. Prečítaj celý `zmeny.md`.
2. Prejdi si aktuálnu štruktúru repa (`apps/`, `packages/`, Prisma schému, existujúce API routes, existujúce komponenty pre: firemný profil, joby, kanban/ATS, invite flow, e-maily).
3. Over si, čo z požadovaných vecí **už čiastočne existuje** (napr. kanban môže už existovať v inej forme, invite systém môže existovať ale byť rozbitý).

## Krok 2 — Rozdelenie na agentov pre paralelnú analýzu

Rozdeľ `zmeny.md` na **logické epicy** (odhad, uprav podľa reálneho obsahu):

1. Firemný profil & nastavenia (menu, subHR, invite e-maily, pobočky, logo/video)
2. Vyhľadávanie & filtre ponúk (poradie polí, rozšírené filtre, freelancer/firma duálna rola)
3. Komunikácia (chat medzi firmou a uchádzačom, kalendár, plánovanie hovorov/pohovorov)
4. Kanban/ATS (zjednotenie kanban+list, mini profil, AI % vhodnosti, presmerovania)
5. AI matching & testy (top 5/15/30 kandidátov, test builder, anti-cheat kamera/recording)
6. Verejná stránka & firemné profily (logá firiem, AI/drag-and-drop editor, brand manuál upload)
7. Superadmin & scraper (superadmin rola, pridávanie firiem, scraper z Profesie, súhlas/legal)

Pre **každý epic spusti samostatného subagenta** (Task tool) s týmto zadaním:

> "Prečítaj si tieto body zo zmeny.md: [konkrétne body]. Preskúmaj relevantnú časť codebase (uveď presné cesty k súborom, ktoré si preskúmal). Pre každý bod vráť:
> - **ROZUMIEM** — presne čo treba spraviť + kde v codebase + odhad zložitosti (S/M/L/XL)
> - **NEJASNÉ** — čo presne nie je jasné, prečo, a konkrétnu otázku na klienta
> - **KONFLIKT** — ak to naráža na existujúcu implementáciu alebo dátový model
> - **ZÁVISLOSŤ** — ak tento bod potrebuje najprv iný bod (napr. AI matching potrebuje najprv dátovú štruktúru kandidátov)
>
> Nič neimplementuj. Len analýza a otázky."

## Krok 3 — Konsolidácia (späť v hlavnom vlákne, nie v subagentovi)

Po tom, čo sa subagenti vrátia, spracuj ich výstupy do **jedného spoločného reportu** v tomto formáte:

```
## Epic: [názov]

### ✅ Rozumiem a je to jasné
- [bod] — odhad zložitosti, poznámka k implementácii

### ❓ Potrebujem upresniť
- [bod] — konkrétna otázka

### ⚠️ Konflikt s existujúcim
- [bod] — popis konfliktu, navrhované riešenie A/B

### 🔗 Závislosti medzi bodmi
- [bod X] potrebuje najprv [bod Y]
```

Report ulož ako `ZMENY_ANALYZA_REPORT.md` v roote repa.

## Krok 4 — Návrh poradia a rozdelenia práce na exekúciu

Na koniec reportu pridaj:

1. **Odporúčané poradie epicov** na implementáciu (podľa závislostí a rizika — najprv dátový model, potom UI, potom AI/nice-to-have).
2. **Návrh, ktoré epicy sa dajú robiť paralelne** (rôzne subagenty/session naraz) a ktoré musia byť sekvenčné (napr. kvôli zdieľanej Prisma schéme).
3. Pre každý epic navrhni, či implementáciu robiť ako `opusplan` (komplexná architektúra) alebo priamo `sonnet` (bežné CRUD/UI) — podľa zložitosti, ktorú si sám odhadol v kroku 2.
4. Uprav si TODO/plán ale **nepokračuj do implementácie** — na to počkaj na moje potvrdenie po tom, čo si spolu prejdeme report.

---

## Dôležité

- Toto je **analytická fáza**, žiadny kód sa nemení.
- Ak je bod v `zmeny.md` nejasný natoľko, že by rôzne interpretácie viedli k úplne inej implementácii (napr. "AI vyhodnotí % vhodnosti" — akým modelom, na základe akých dát, real-time alebo batch?) — vždy sa spýtaj, nehádaj.
- Otázky formuluj tak, aby sa na ne dalo odpovedať jednou vetou alebo výberom z možností (A/B/C) — nie otvorené filozofické otázky.
