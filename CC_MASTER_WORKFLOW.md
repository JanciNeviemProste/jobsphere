# CC MASTER WORKFLOW

### Kompletný pracovný štandard: audit stavu CC → a čo sa deje po každej úprave kódu

Tento dokument zlepuje obe predošlé pasáže do jedného systému a pridáva to nové: **Definition of Done po každej zmene kódu** — ktoré sa reálne _vynúti_ cez CC hooks, nie len odporúča v markdowne.

---

## 0 · Prehľad — 3 vrstvy

| Vrstva                             | Čo to je                                                              | Kedy to bežím                   | Mechanizmus                                            |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| **1 — Audit stavu CC**             | preverenie skills / `CLAUDE.md` / prompt knižnice                     | jednorazovo + periodicky        | prompt `CC_CONFIG_AUDIT_UPGRADE.md`                    |
| **2 — Security baseline**          | hĺbkový bezpečnostný audit repa + testy + report                      | raz za repo + občas             | prompt `SECURITY_AUDIT_TESTS_REPORT.md`                |
| **3 — Po každej zmene kódu (DoD)** | diff-scoped security check + testy + update posture + zápis do pamäte | **automaticky po každej zmene** | `CLAUDE.md` rule + `settings.json` hooks + `/po-zmene` |

**Princíp:** Vrstvy 1 a 2 sú _ťažké_ a púšťam ich vedome. Vrstva 3 je _ľahká a scoped na `git diff`_ — preto môže bežať zakaždým bez toho, aby ma brzdila.

```
 deň 1 na repe        ──►  Vrstva 1 (audit configu)  +  Vrstva 2 (security baseline)
                              └─ vznikne posture skóre + sada testov + report v pamäti
 každá zmena kódu     ──►  Vrstva 3 (DoD)  ── automaticky cez hooks / /po-zmene
 raz za čas           ──►  Vrstva 2 znova  (re-baseline)
```

---

## 1 · VRSTVA 1 — Audit aktuálneho stavu CC

Spusti, keď chceš premerať a vyladiť svoju CC konfiguráciu (triggering skills, signal-to-noise `CLAUDE.md`, kvalita promptov). Je read-only až po tvoje `GO FÁZA 4`.

```
# v Claude Code, spustené z ~ (globál) alebo vnútri projektu:
Read CC_CONFIG_AUDIT_UPGRADE.md and execute it as a prompt.
```

Výstup: inventory + audit tabuľky s **%** + prioritizovaný plán → po schválení úpravy.

---

## 2 · VRSTVA 2 — Security baseline (raz za repo)

Spusti **vnútri konkrétneho repa**, keď zakladáš jeho bezpečnostnú základňu. Read-only až po `GO FÁZA 5`. Vytvorí posture skóre, dopíše chýbajúce security testy a uloží report do pamäte.

```
cd ~/projekty/<repo>
# v Claude Code:
Read SECURITY_AUDIT_TESTS_REPORT.md and execute it as a prompt.
```

Toto je predpoklad pre Vrstvu 3 — DoD potom už len kontroluje **delta** oproti tejto základni.

---

## 3 · VRSTVA 3 — Po každej úprave kódu (Definition of Done)

Toto je jadro tvojej požiadavky. Skladá sa z troch nezávislých vrstiev ochrany (soft → hard):

| Úroveň                 | Súbor                          | Čo robí                                                                                            | Spoľahlivosť               |
| ---------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------- |
| **L1 — pravidlo**      | `CLAUDE.md`                    | povie Claude, čo má po zmene spraviť                                                               | model to _väčšinou_ dodrží |
| **L2 — per-edit hook** | `.claude/settings.json`        | po každom edite: format + lint + rýchly secret-scan zmeneného súboru                               | deterministické            |
| **L3 — gate hook**     | `.claude/settings.json`        | pred dokončením: typecheck + lint + testy; `exit 2` → Claude **nesmie skončiť**, kým nie je zelené | tvrdé vynútenie            |
| **manuál**             | `.claude/commands/po-zmene.md` | `/po-zmene` = vyžiadaj DoD + slovenský súhrn s % kedykoľvek                                        | na požiadanie              |

### 3A · `CLAUDE.md` rule (vlož do `CLAUDE.md` projektu)

> `CLAUDE.md` je vždy v kontexte, preto je to stručné. Doplň príkazy svojho projektu.

```markdown
## Pracovný štandard — Definition of Done po každej úprave kódu

Po dokončení AKEJKOĽVEK zmeny kódu, pred ohlásením „hotovo" a pred commitom, VŽDY a v tomto poradí:

1. **Diff-scoped security check** — prejdi LEN zmenené súbory/riadky (`git diff`) proti checklistu:
   secrets/leak · authZ & IDOR · RLS scoping · input validation · injection (SQL/command/path) ·
   Stripe/webhook podpis · PII/GDPR. Toto NIE je full-repo audit.
2. **Quality gate** — spusti typecheck + lint + testy. Ak pre dotknutú cestu existuje security test,
   musí prejsť; ak na novej/zmenenej kritickej ceste chýba, DOPÍŠ ho.
3. **Posture update** — ak pribudol/zanikol nález, prepočítaj posture skóre
   (od 100: Critical −20 / High −10 / Medium −4 / Low −1) a aktualizuj sekciu `## Security posture`
   aj `bezpecnostny-audit/findings.json`.
4. **Pravidlá** — žiadne secrets do logov/výstupu (len súbor + typ); nič needituj mimo scope zmeny
   bez upozornenia; oprav root cause, nie symptóm.

Príkazy projektu: typecheck=`<doplň>` · lint=`<doplň>` · test=`<doplň>` · audit=`npm audit` / `pip-audit`

## Security posture

skóre: — | otvorené P0/P1: — | posledný audit: — | report: `bezpecnostny-audit/SECURITY_REPORT_<dátum>.md`
```

### 3B · Hooks — deterministické vynútenie (do `.claude/settings.json`)

> Vyžaduje `jq` (`apt-get install jq`). `Stop` hook s `exit 2` přinúti Claude pokračovať, kým gate neprejde. Guard cez `git diff --quiet` spôsobí, že gate **NEbeží**, keď nemáš rozrobenú zmenu (čisto konverzačný turn ho preskočí).

**Variant Next.js / TypeScript:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "p=$(jq -r '.tool_input.file_path'); echo \"$p\" | grep -qE '\\.(ts|tsx|js|jsx|css|json)$' || exit 0; cd \"$CLAUDE_PROJECT_DIR\" && npx prettier --write \"$p\" >/dev/null 2>&1; grep -nEi '(sk_live_|service_role|BEGIN [A-Z ]*PRIVATE KEY|password[[:space:]]*=)' \"$p\" && { echo 'Možný secret v zmenenom súbore — over.' >&2; exit 2; }; exit 0",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "INPUT=$(cat); [ \"$(printf '%s' \"$INPUT\" | jq -r '.stop_hook_active')\" = 'true' ] && exit 0; cd \"$CLAUDE_PROJECT_DIR\"; git diff --quiet && git diff --cached --quiet && exit 0; npm run typecheck --silent && npm run lint --silent && npm test --silent || { echo 'Definition of Done zlyhalo: typecheck/lint/testy musia byť zelené pred dokončením. Oprav a skús znova.' >&2; exit 2; }",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

**Variant Python (bot / FastAPI):**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "p=$(jq -r '.tool_input.file_path'); echo \"$p\" | grep -qE '\\.py$' || exit 0; cd \"$CLAUDE_PROJECT_DIR\" && ruff format \"$p\" >/dev/null 2>&1; ruff check --fix \"$p\" >/dev/null 2>&1; exit 0",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "INPUT=$(cat); [ \"$(printf '%s' \"$INPUT\" | jq -r '.stop_hook_active')\" = 'true' ] && exit 0; cd \"$CLAUDE_PROJECT_DIR\"; git diff --quiet && git diff --cached --quiet && exit 0; ruff check . && pytest -q || { echo 'DoD zlyhalo: ruff + pytest musia prejsť pred dokončením. Oprav a skús znova.' >&2; exit 2; }",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

> Ak `Stop` gate nechceš tak striktný (beží na konci každého turnu, kde máš rozrobenú zmenu), nechaj len `PostToolUse` + `CLAUDE.md` rule. Pre _judgment-based_ security review existuje aj `type: "prompt"` hook (review cez Haiku model) — to ti viem doladiť zvlášť.

### 3C · `/po-zmene` slash command (do `.claude/commands/po-zmene.md`)

```markdown
---
description: Diff-scoped security check + testy + update posture po zmene kódu (NIE full audit)
---

Sprav Definition of Done pre AKTUÁLNU zmenu:

1. `git diff` — prejdi len zmenené súbory proti security checklistu
   (secrets, authZ/IDOR, RLS, input validation, injection, Stripe webhook, PII/GDPR).
2. Spusti typecheck + lint + testy; dopíš chýbajúci security test na zmenenej kritickej ceste.
3. Prepočítaj posture skóre a aktualizuj `## Security posture` + `bezpecnostny-audit/findings.json`.
4. Krátky slovenský súhrn s % (pred/po) a „Po lopate" pri každom náleze. Žiadne secrets do výstupu.
   $ARGUMENTS
```

### 3D · Zápis do pamäte

„Pamäť" v Claude Code = `CLAUDE.md` (číta sa každý session). Po každom DoD aj po baseline audite sa preto:

- aktualizuje sekcia **`## Security posture`** v `CLAUDE.md` (skóre, otvorené P0/P1, dátum, odkaz na report),
- udržiava **`bezpecnostny-audit/findings.json`** (id, severity, status open/fixed, súbor) na tracking,
- plný report ostáva v **`bezpecnostny-audit/SECURITY_REPORT_<dátum>.md`**.

Takto si CC bezpečnostný stav repa nesie do ďalších sessionov a každá ďalšia zmena už rieši len delta.

---

## 4 · Inštalácia (raz za repo)

1. **CLAUDE.md** — vlož blok **3A** do `CLAUDE.md` projektu (alebo `~/.claude/CLAUDE.md` pre globál) a doplň príkazy.
2. **Hooks** — vlož príslušný variant z **3B** do `.claude/settings.json`. Over `jq`. Skontroluj cez `/hooks`.
3. **Slash command** — ulož **3C** do `.claude/commands/po-zmene.md`.
4. **Deep prompty** — nechaj `CC_CONFIG_AUDIT_UPGRADE.md` a `SECURITY_AUDIT_TESTS_REPORT.md` v repe / prompt knižnici.

## 5 · Poradie, ako pracujem (runbook)

| Kedy                          | Akcia                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Setup CC / raz za čas         | `Read CC_CONFIG_AUDIT_UPGRADE.md and execute it as a prompt.`                               |
| Nový repo (deň 1)             | `Read SECURITY_AUDIT_TESTS_REPORT.md and execute it as a prompt.` → vznikne posture + testy |
| Každá úprava kódu             | DoD beží automaticky (hooks) — alebo `/po-zmene` na vyžiadanie + slovenský súhrn s %        |
| Raz za mesiac / pred releasom | Vrstva 2 znova (re-baseline)                                                                |
