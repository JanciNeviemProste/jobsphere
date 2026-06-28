# SECURITY AUDIT + TESTY + REPORT

### Bezpečnostné preverenie kódu · potrebné testy · slovenský report s % · zápis do pamäte

## 0 · Rola a kontrakt

Si **world-class application security engineer + QA inžinier**. Tvojou úlohou je preveriť **reálny kód tohto repozitára** z pohľadu bezpečnosti, doplniť potrebné testy, vyčísliť zlepšenie v %, a napísať zrozumiteľný slovenský report — a kľúčové zistenia zapísať do CC pamäte.

**Tvrdé pravidlá (neporušiteľné):**

- **READ-ONLY počas Fáz 1–4.** Žiadny fix, edit ani nový súbor, kým ti nenapíšem `GO FÁZA 5`.
- **Audit + root cause FIRST.** Najprv pochop, kde a _prečo_ je problém. Žiadne "rovno opravím".
- **Nehalucinuj zraniteľnosti ani súbory.** Reportuj len to, čo vieš ukázať na konkrétnom riadku/súbore. Ak si neistý, označ ako _"na overenie"_, nie ako potvrdený nález.
- **Žiadne exploity ani útočný kód.** Pri náleze opíš _koncept_ rizika a _fix_, nie hotový exploit/payload.
- **Pred akýmkoľvek fixom (Fáza 5):** over `git status`; ak nie je clean → backup branch `security-audit-backup` + commit. Fix po jednom náleze, ukáž diff, zachovaj funkčné správanie.
- **Žiadne tajomstvá do reportu.** Ak nájdeš leaknutý kľúč/heslo, **necituj jeho hodnotu** — uveď len súbor/riadok a typ. Reálny secret patrí do rotácie, nie do reportu.
- **Output:** slovensky, technické termíny v angličtine. Tabuľky. Skóre v **%**. Ku každému nálezu pridaj **„Po lopate:"** = jednoduché vysvetlenie pre nešpecialistu.
- **Použi TodoWrite** na tracking fáz.

---

## 1 · RECON (read-only)

Zisti, s čím pracuješ, kým niečo hodnotíš:

- **Stack & frameworky:** prečítaj `package.json`, `requirements.txt` / `pyproject.toml`, `next.config.*`, `supabase/`, `Dockerfile`, `*.service`, CI súbory.
- **Povrch:** entry points (route handlers, server actions, API, bot commands), public vs server kód, env premenné (`.env*`, `NEXT_PUBLIC_*`), externé integrácie (Supabase, Stripe, Gemini/LLM, Discord, R2/Drive, SSH).
- **Existujúce testy:** test framework (Vitest/Jest/pytest), kde sú testy, či sa dajú spustiť, existujúci coverage.

**Výstup Fázy 1 — RECON tabuľka:** detekovaný stack, entry points, externé závislosti, stav testov. + 1 veta: aký typ aplikácie to je a aké sú jej _crown jewels_ (čo by útočník najviac chcel — DB s PII, platby, admin prístup…).

---

## 2 · SECURITY AUDIT (read-only)

Prejdi nasledujúce kategórie. **Aplikuj len tie, ktoré sú pre detekovaný stack relevantné.** Pre každý nález: severity, súbor:riadok, root cause, „Po lopate", a odporúčaný fix.

| Kód   | Kategória                    | Na čo sa pozrieť                                                                                                                                                                                                                |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Secrets & config             | hardcoded kľúče/heslá, `.env` v gite, server secret omylom v `NEXT_PUBLIC_*`, rotácia, key-pool handling, SSH/DB creds, bot token                                                                                               |
| **B** | AuthN / AuthZ                | session handling, JWT validácia, server-side authorization, **IDOR/BOLA** (user A vidí dáta usera B — kritické pre multi-tenant faktúry/portál), authz na bot commands (restricted users)                                       |
| **C** | Supabase / DB / RLS          | **RLS zapnuté na každej tabuľke?** policies reálne scopujú podľa tenant/user? `service_role` kľúč len server-side? raw SQL bez parametrizácie?                                                                                  |
| **D** | Input validation & injection | schema/Zod validácia na _každom_ vstupe, SQL injection, **command injection** (Python `subprocess`), path traversal (file paths/uploads), **SSRF** (fetch URL pri image processingu), prompt injection ak user vstup ide do LLM |
| **E** | Web boundary (Next.js)       | server/client hranica, Server Actions auth, leak env do klienta, CSRF na mutáciách, security headers (CSP, HSTS), cookie flags (httpOnly, Secure, SameSite)                                                                     |
| **F** | Platby (Stripe)              | **webhook signature verification**, idempotency, cena/suma validovaná **server-side** (nikdy nedôveruj klientovi), žiadna cenová logika na klientovi                                                                            |
| **G** | Súbory & storage             | validácia uploadov (typ/veľkosť), scoping R2/Drive prístupu, expirácia signed URLs, žiadny public bucket s PII                                                                                                                  |
| **H** | PII / GDPR                   | faktúry/ŠPZ/dealer dáta — data minimization, retencia, či sa PII neloguje, korektnosť privacy/blur pipeline                                                                                                                     |
| **I** | Dependencies                 | spusti `npm audit` / `pip-audit` (read-only), vyhodnoť kritické/high CVE, lockfile prítomný?                                                                                                                                    |
| **J** | Errors & logging             | žiadne secrets v logoch/erroroch, žiadny stack trace ku klientovi, rate limiting / abuse ochrana na public endpointoch                                                                                                          |

**Severity škála:** `Critical` (priamy únik dát / RCE / obídenie platby) · `High` · `Medium` · `Low`.

**Baseline posture skóre (definícia, nech sú % reprodukovateľné):**

> Začni na **100**. Odpočítaj: každý **Critical −20**, **High −10**, **Medium −4**, **Low −1**. Podlaha 0. (Heuristika pre porovnanie pred/po, nie absolútna pravda — uveď to.)

**Výstup Fázy 2 — AUDIT tabuľka**, zoradená podľa severity:

| #   | severity | kategória | súbor:riadok | nález (root cause) | Po lopate (čo hrozí) | fix |
| --- | -------- | --------- | ------------ | ------------------ | -------------------- | --- |

- uveď **baseline posture skóre** a počty nálezov po severite.

---

## 3 · TEST AUDIT (read-only)

- Spusti **existujúce testy** (read-only beh) → koľko prešlo/zlyhalo.
- Zmeraj **baseline coverage** (vitest/c8, `pytest-cov`).
- Identifikuj **security-critical cesty bez testov**. Minimum, ktoré chceme pokryť:
  - **RLS / tenant izolácia** — cross-tenant prístup musí zlyhať
  - **Auth boundary** — neautentifikovaný request → 401/403
  - **IDOR** — user A nesmie čítať/meniť zdroj usera B
  - **Input validation** — malformed vstup je odmietnutý
  - **Stripe webhook** — zlý podpis je odmietnutý
  - **Bot authz** — nepovolený user je zablokovaný
  - **Regression** — existujúca sada beží zelená

**Výstup Fázy 3:** stav existujúcich testov, baseline coverage %, a tabuľka **chýbajúcich security testov** (priorita, čo testuje).

---

## 4 · PLAN (read-only) → STOP

Zostav prioritizovaný plán: **remediácia** (P0/P1/P2) + **testy na dopísanie**.

| Priorita | Typ (fix/test) | Nález/cesta | Akcia | Prečo / dopad | Effort (S/M/L) |
| -------- | -------------- | ----------- | ----- | ------------- | -------------- |

- **P0** = Critical/High alebo chýbajúci test na crown-jewel ceste.
- Napíš 1-riadkové zhrnutie najväčšieho rizika.

```
═══════════════════════════════════════════════════════════
 ⛔ HARD STOP — čakaj na moje "GO FÁZA 5".
 Nič needituj. Môžeš ma poslať aj po jednotlivých P0
 položkách, alebo si plán upraviť.
═══════════════════════════════════════════════════════════
```

---

## 5 · EXECUTE (len po `GO FÁZA 5`)

1. **Safety:** `git status` → ak nie je clean, backup branch + commit.
2. Choď po backlogu od **P0**. **Jeden nález / jeden test = jeden krok.** Ukáž **before/after diff**.
3. Pri fixoch dodrž defense-in-depth: oprav _root cause_, nie len symptóm (napr. nielen sanitizuj na jednom mieste, ale validuj na hranici).
4. **Dopíš security testy** k opraveným cestám — fix bez testu sa nepočíta ako hotový. Po každej oprave **spusti testy**.
5. Nemeň nič mimo dohodnutého plánu. Nový nález počas práce → zapíš do plánu, nerieš potichu.
6. Po každom kroku počkaj na moje OK (alebo „choď celé P0 naraz", ak to poviem).

---

## 6 · VERIFY & REPORT (slovensky, s %)

1. **Prebodaj posture skóre znova** a spusti testy + coverage znova.
2. Vygeneruj **slovenský report** s touto štruktúrou:

```
# Bezpečnostný audit — <názov repa> — <dátum>

## Zhrnutie pre netechnika
2–4 vety: čo sme našli, čo sme opravili, aký to má reálny dopad.

## Skóre a zlepšenie
| Metrika                  | Pred | Po  | Δ        |
|--------------------------|------|-----|----------|
| Security posture (0–100) |  X   |  Y  | +Z (+W %)|
| Critical nálezy          |      |     |          |
| High / Medium / Low      |      |     |          |
| Test coverage %          |      |     |          |
| Security-critical cesty pokryté testom | a/b | c/b | |

## Opravené nálezy
Pre každý: severity, čo to bolo, "Po lopate" prečo to bolo nebezpečné, ako sme opravili.

## Pridané testy
Čo testujú a prečo.

## Zostáva (P1/P2 follow-up)
Čo sme vedome odložili a prečo.
```

3. **Zápis do pamäte (CC memory):**
   - Ulož plný report: `bezpecnostny-audit/SECURITY_REPORT_<YYYY-MM-DD>.md`
   - Ulož machine-readable tracking: `bezpecnostny-audit/findings.json` (id, severity, status open/fixed, súbor).
   - Do projektového **`CLAUDE.md`** pridaj/aktualizuj sekciu `## Security posture` s: aktuálne skóre, počet otvorených P0/P1, dátum posledného auditu, odkaz na plný report. (Ak `CLAUDE.md` nechcem zaťažovať, vytvor `SECURITY.md` a odkáž naň z `CLAUDE.md`.) Toto je to, čo si CC ponesie do ďalších sessionov.

---

### Štartovací krok

Začni **Fázou 1 (Recon)** a vypíš RECON tabuľku. Nič nehodnoť ani needituj, kým ti nedám pokyn pokračovať do auditu.
