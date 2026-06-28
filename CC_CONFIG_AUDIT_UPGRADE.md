# AUDIT & UPGRADE: Claude Code konfigurácia

### skills · CLAUDE.md · prompt knižnica (.md súbory)

## 0 · Rola a kontrakt

Si **world-class Claude Code configuration auditor a prompt engineer**. Tvojou úlohou je nájsť, zmerať a vylepšiť moju CC konfiguráciu (skills, `CLAUDE.md` súbory, knižnicu prompt `.md` súborov) tak, aby skills spoľahlivejšie _triggerovali_, `CLAUDE.md` mal vysoký signal-to-noise a prompty boli na správnej "altitude".

**Tvrdé pravidlá (neporušiteľné):**

- **READ-ONLY počas Fáz 1–3.** Žiadny zápis, edit, ani vytvorenie súboru, kým ti explicitne nenapíšem `GO FÁZA 4`.
- **Nehalucinuj súbory.** Reportuj len to, čo reálne existuje na disku. Ak si niečím neistý, povedz to a opýtaj sa.
- **Zachovaj funkčné správanie.** Nič, čo dnes funguje (triggering, paths, commands), sa nesmie pri úprave rozbiť.
- **Pred akýmkoľvek editom (Fáza 4):** over `git status`; ak repo nie je clean, vytvor backup branch `cc-config-audit-backup` a commitni súčasný stav. Súbory mimo gitu (napr. globálne `~/.claude/`) najprv skopíruj do `.bak`.
- **Edituj po JEDNOM artefakte**, ukáž diff (before/after), počkaj kým prejdeme ďalej.
- **Použi TodoWrite** na tracking fáz, nech sa nestratíš.
- **Output:** slovensky, technické termíny ponechaj v angličtine. Tabuľky. Skóre v **%**. Zoznamy zoraď od najhoršieho po najlepšie (worst-first).

---

## 1 · DISCOVERY (read-only)

Nájdi a inventarizuj artefakty v týchto lokáciách. Použi `find`, `ls`, `glob` a `cat` len na čítanie:

**Globálne (user-level):**

- `~/.claude/CLAUDE.md`
- `~/.claude/skills/**/SKILL.md`
- `~/.claude/commands/*.md`
- `~/.claude/settings.json` a `settings.local.json`

**Project-level (strom od aktuálneho `cwd`):**

- `./CLAUDE.md` aj `./**/CLAUDE.md` (vrátane vnorených)
- `./.claude/skills/**/SKILL.md`
- `./.claude/commands/*.md`
- `./.claude/settings*.json`, `.mcp.json`

**Prompt knižnica (.md súbory):**

- Hľadaj `*.md`, ktoré vyzerajú ako prompty pre CC, nie ako bežná dokumentácia. Heuristiky: názvy typu `*_PROMPT.md`, `*MASTER*.md`, `*_audit.md`, `*_spec.md`, `*_plan.md`, alebo obsah ktorý je inštrukciou pre agenta (rola, kroky, output format).
- Ak nevieš nájsť moju prompt knižnicu alebo je roztrúsená, **opýtaj sa ma na cestu** namiesto hádania.

**Výstup Fázy 1 — INVENTORY tabuľka:**

| #   | path | typ (skill/CLAUDE.md/command/prompt) | riadkov | posledná zmena | účel (1 veta) |
| --- | ---- | ------------------------------------ | ------- | -------------- | ------------- |

Na konci uveď počty: koľko skills, koľko `CLAUDE.md`, koľko commands, koľko promptov.

---

## 2 · AUDIT (read-only) — rubriky

Každý artefakt oboduj **0–100 %** podľa váženej rubriky pre jeho typ. Zobraz skóre **po jednotlivých kritériách aj total**. Ku každému artefaktu uveď **top 3 konkrétne problémy** (nie všeobecné frázy — cituj reálny riadok / chýbajúcu vec).

### 2A · Rubrika SKILL.md — _triggering je kráľ_

> Princíp: `description` je primárny triggering mechanizmus. Claude vidí len `name + description` (vždy v kontexte) a podľa toho sa rozhoduje, či skill vôbec použije. Telo (`SKILL.md` body) sa načíta až keď skill triggerne. Claude má tendenciu **under-triggerovať** — preto musí byť description konkrétny a mierne "pushy".

| Kritérium                     | Váha | Čo hodnotíš                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Triggering description**    | 35 % | Hovorí _ČO_ skill robí **aj** _KEDY_ ho použiť? Obsahuje trigger keywords a konkrétne kontexty/frázy používateľa? Je dosť "pushy" proti under-triggeringu (napr. "use whenever the user mentions X, Y, Z, even if they don't explicitly ask")? Je tam **negatívny scope** (kedy NEpoužiť)? Všetko "when to use" patrí do description, nie do tela. |
| **Scope & non-overlap**       | 10 % | Je hranica voči ostatným skills jasná? Neprekrýva sa description tak, že by si Claude nevedel vybrať?                                                                                                                                                                                                                                              |
| **Body actionability**        | 15 % | Imperatívne inštrukcie, konkrétne kroky. Vysvetľuje _prečo_ (theory of mind) namiesto ťažkopádnych "MUST"? Žiadna duplicita s description.                                                                                                                                                                                                         |
| **Progressive disclosure**    | 15 % | Telo < ~500 riadkov? Ťažký detail odsunutý do `references/` s jasnými pointermi kedy ich čítať? TOC pre referencie > ~300 riadkov? Skripty v `scripts/`, assety v `assets/`?                                                                                                                                                                       |
| **Output format defined**     | 10 % | Ak skill produkuje výstup, je formát/template explicitne zadefinovaný?                                                                                                                                                                                                                                                                             |
| **Examples**                  | 5 %  | Sú tam užitočné Input/Output príklady, kde dávajú zmysel?                                                                                                                                                                                                                                                                                          |
| **Token hygiene & štruktúra** | 10 % | Žiadny bloat, čisté headery, žiadne mŕtve drevo, valídny YAML frontmatter (`name`, `description`).                                                                                                                                                                                                                                                 |

### 2B · Rubrika CLAUDE.md

> Princíp: `CLAUDE.md` je **vždy** v kontexte každého sessionu. Každý riadok stojí tokeny pri každom turne — preto bezohľadne odmeňuj signal a trestaj bloat.

| Kritérium                      | Váha | Čo hodnotíš                                                                                                                |
| ------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| **Signal-to-noise / no bloat** | 25 % | Je tam len high-value info, ktoré Claude reálne potrebuje každý session? Žiadne dlhé prózy, žiadne info zistiteľné z kódu. |
| **Stack & architektúra**       | 20 % | Jazyky, frameworky, kľúčové adresáre, entry points, dátové toky.                                                           |
| **Commands**                   | 20 % | `build` / `dev` / `test` / `lint` / `typecheck` / `deploy` — sú zdokumentované a aktuálne?                                 |
| **Konvencie**                  | 20 % | Code style, naming, patterns, explicitné do's/don'ts pre tento projekt.                                                    |
| **Freshness & accuracy**       | 15 % | Žiadne stale paths, mŕtve commands, staré verzie, neexistujúce skripty.                                                    |

### 2C · Rubrika prompt `.md`

| Kritérium                        | Váha | Čo hodnotíš                                                                                        |
| -------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| **Objective & success criteria** | 20 % | Jasný cieľ na začiatku + definition of done.                                                       |
| **Context sufficiency**          | 15 % | Dostatok backgroundu, odkazov, vstupov, aby agent nehádal.                                         |
| **Constraints & guardrails**     | 15 % | Čo NErobiť, scope limity, edge cases.                                                              |
| **Output spec**                  | 15 % | Formát, štruktúra, cieľové súbory/paths.                                                           |
| **Štruktúra & altitude**         | 15 % | Sekcie/XML značky; správna úroveň detailu (nie over- ani under-specified).                         |
| **CC-fit / workflow**            | 10 % | Vynucuje _audit-before-implement_, plan + approval gate, verifikačné kroky, inkrementálne commity? |
| **Reusability**                  | 10 % | Parametrizovateľný / znovupoužiteľný, nie jednorazový throwaway tam, kde má byť opakovaný.         |

**Výstup Fázy 2 — tri AUDIT tabuľky** (jedna na typ), zoradené podľa total % vzostupne:

| #   | path | krit.1 | krit.2 | …   | **TOTAL %** | top 3 problémy |
| --- | ---- | ------ | ------ | --- | ----------- | -------------- |

Pod tabuľkami pridaj **cross-cutting findings**: vzory ktoré sa opakujú naprieč artefaktmi (napr. "5/7 skills má slabý negatívny scope", "CLAUDE.md duplikujú stack info ktoré patrí do jedného globálneho").

---

## 3 · IMPROVEMENT PLAN

Zostav prioritizovaný backlog. Pre každú položku: čoho sa týka, čo zmeniť, prečo (aký dopad), odhad effortu.

| Priorita | Artefakt | Zmena | Prečo / očakávaný dopad | Effort (S/M/L) |
| -------- | -------- | ----- | ----------------------- | -------------- |

- **P0** = vysoký dopad, nízky risk (quick wins, najmä triggering descriptions a CLAUDE.md bloat).
- **P1** = stredný dopad alebo väčší rozsah.
- **P2** = nice-to-have / kozmetika.

Potom napíš **1-riadkové zhrnutie** najväčšej páky ("ak spravíš len jednu vec, sprav X").

```
═══════════════════════════════════════════════════════════
 ⛔ HARD STOP — čakaj na moje "GO FÁZA 4".
 Nič needituj, kým toto nenapíšem. Môžem ťa poslať aj
 po jednotlivých P0 položkách, alebo si plán upraviť.
═══════════════════════════════════════════════════════════
```

---

## 4 · EXECUTE (len po `GO FÁZA 4`)

1. **Safety:** over `git status`. Ak nie je clean → backup branch + commit. Súbory mimo gitu → `cp file file.bak`.
2. Choď po backlogu od **P0**. **Jeden artefakt = jeden krok.**
3. Pri skills: ak prepisuješ `description`, drž sa pushiness princípu a pridaj negatívny scope. **Zachovaj pôvodný `name` a directory názov** (inak sa skill "stratí").
4. Ukáž **before/after diff** každého artefaktu. Stručne odôvodni zmenu.
5. Po každom artefakte **počkaj na moje OK**, nepokračuj automaticky na ďalší (pokiaľ ti nepoviem "choď celé P0 naraz").
6. Nemeň súbory mimo dohodnutého backlogu. Ak počas práce nájdeš nový problém, **zapíš ho do plánu**, nerieš ho potichu.

---

## 5 · VERIFY & HANDOFF

- Pre každý zmenený artefakt **prebodaj rubriku znova** a ukáž delta tabuľku:

| artefakt | pred % | po % | Δ   |
| -------- | ------ | ---- | --- |

- Krátky changelog: čo sa zmenilo a prečo.
- Ak nejaké skills boli "borderline" na triggeringu, navrhni 2–3 realistické test prompty, ktorými si po reštarte CC overím, či teraz triggrujú správne.
- Uveď, čo zostalo v P1/P2 ako follow-up.

---

### Štartovací krok

Začni **Fázou 1 (Discovery)** a vypíš INVENTORY tabuľku. Nič nehodnoť ani needituj, kým inventory neodsúhlasím alebo ti nepoviem "pokračuj do auditu".
