# CC SCAFFOLD STARTER — Synapse Studio

### Drop-in kostra pre top-5 % setup · Next.js 15 / Supabase / Stripe + Python

Hoď do repa, aby CC od prvého sessionu vedel, kde čo je a ako pracovať. Nadväzuje na `CC_MASTER_WORKFLOW.md` (DoD + hooky), `CC_CONFIG_AUDIT_UPGRADE.md` a `SECURITY_AUDIT_TESTS_REPORT.md`.

---

## 1 · Adresárová štruktúra `.claude/`

```
.claude/
├── settings.json          # zdieľané: permissions + hooks (commitni)
├── settings.local.json    # lokálne overrides (do .gitignore)
├── agents/                # subagenti (vlastný kontext + tools)
│   └── security-reviewer.md
├── commands/              # slash commands (názov súboru = /command)
│   ├── spec.md            # /spec  → interview → SPEC.md
│   └── po-zmene.md        # /po-zmene → DoD (z mastera)
├── skills/                # model-invoked workflowy
│   └── <skill>/SKILL.md
└── hooks/                 # skripty pre PostToolUse / Stop (voliteľné)
CLAUDE.md                  # vždy v kontexte — DRŽ KRÁTKY (pozri §2)
CLAUDE.local.md            # osobné poznámky (gitignore)
agent_docs/                # detail načítaný on-demand (pozri §6)
```

> Nie každý priečinok musí existovať — CC ich vytvára on-demand. `CLAUDE.md` je case-sensitive (nie `claude.md`), `settings.json` lowercase.

---

## 2 · Starter `CLAUDE.md` (3 otázky + progressive disclosure)

> Pravidlo: pre každý riadok sa spýtaj „spôsobilo by jeho zmazanie chybu?". Ak nie, von. Detail → `agent_docs/`.

```markdown
# <Projekt> — <jedna veta, čo to je>

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + RLS) · Stripe · Vercel.

## Commands (presné invokácie, nie konvenčné)

- Dev: `pnpm dev`
- Test: `pnpm test` # Vitest
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- DB push: `supabase db push`

## Architektúra (ukáž súbor, neopisuj prózou)

- UI: `src/components/` (shadcn v `src/components/ui/`)
- Routes/API: `src/app/`; server actions v `src/app/**/actions.ts`
- Supabase: `src/lib/supabase/` (server vs browser klient oddelene)
- Schéma + RLS: `supabase/migrations/`

## Konvencie (čo linter nevynúti)

- Validuj KAŽDÝ vstup cez Zod na hranici (route/action).
- RLS na každej tabuľke; `service_role` kľúč len server-side.
- Stripe: overuj webhook podpis + idempotency; cena/suma validovaná server-side.
- Žiadne secrets do klienta (`NEXT_PUBLIC_*` len verejné hodnoty).

## Boundaries (off-limits)

- Negeneruj/needituj `supabase/migrations/*` bez vyžiadania.
- Neupravuj `*.generated.ts`, `node_modules/`, `.next/`.

## Pointery (detail je inde, nie tu)

- Pracovný štandard po zmene: @CC_MASTER_WORKFLOW.md
- Auth/RLS: @agent_docs/auth.md · Platby: @agent_docs/stripe.md

## Security posture

skóre: — | otvorené P0/P1: — | posledný audit: — | report: `bezpecnostny-audit/SECURITY_REPORT_<dátum>.md`
```

Pre **monorepo / Python bot** doplň `CLAUDE.md` aj do podpriečinka (CC ho navrství na root): napr. `services/cpcbot/CLAUDE.md` s `Test: pytest -q`, `Lint: ruff check`.

---

## 3 · `.claude/settings.json` (permissions allowlist)

> Allowlist = menej klikania, stále pod kontrolou. Hooky (DoD) vlož z `CC_MASTER_WORKFLOW.md §3B`.

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm test)",
      "Bash(pnpm lint)",
      "Bash(pnpm typecheck)",
      "Bash(pnpm dev)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(gh pr:*)",
      "Bash(supabase db push)"
    ],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Bash(rm -rf:*)"]
  }
}
```

---

## 4 · `.claude/agents/security-reviewer.md`

```markdown
---
name: security-reviewer
description: Recenzia diffu na bezpečnostné chyby. Použi pred dokončením väčšej zmeny alebo na vyžiadanie "use a subagent to review security".
tools: Read, Grep, Glob, Bash
model: opus
---

Si senior application security engineer. Recenzuj LEN aktuálny diff:

- injection (SQL/command/path), SSRF
- authZ & IDOR, RLS scoping (cross-tenant prístup musí zlyhať)
- secrets/creds v kóde, leak do klienta
- Stripe webhook podpis, server-side validácia ceny
- PII/GDPR
  Výstup: severity CRITICAL/HIGH/MEDIUM/LOW + súbor:riadok + konkrétny fix.
  Flaguj len reálne correctness/security gaps, nie štýlové preferencie.
```

---

## 5 · `.claude/commands/spec.md` (interview → SPEC.md)

```markdown
---
description: Vyspovedaj ma k novej feature a napíš samostatný SPEC.md
disable-model-invocation: true
---

Vyspovedaj ma detailne cez AskUserQuestion k feature: $ARGUMENTS.
Pýtaj sa na technickú implementáciu, UI/UX, edge cases, tradeoffs — nie samozrejmosti.
Pokračuj, kým nepokryjeme všetko, potom zapíš úplný, SAMOSTATNÝ `SPEC.md`:

- menuj dotknuté súbory a interfaces
- uveď, čo je out of scope
- ukonči end-to-end overovacím krokom, ktorý dokáže, že feature funguje
  Potom mi povedz, nech spustím čistý session nad SPEC.md.
```

---

## 6 · `agent_docs/` — progressive disclosure

```
agent_docs/
├── auth.md         # Supabase Auth, session, RLS detail
├── stripe.md       # webhooky, idempotency, cenová logika
├── data-model.md   # tabuľky, vzťahy, tenant scoping
└── deploy.md       # Vercel, env premenné, build quirks
```

`CLAUDE.md` len odkazuje (`@agent_docs/auth.md`) — CC načíta súbor až keď ho treba. Tým držíš always-loaded súbor malý a stále máš detail po ruke.

---

## 7 · Posledné poznámky

- **`/init`** vygeneruje prvú verziu `CLAUDE.md` z codebase — potom **prepíš ručne**, nikdy nenechaj raw output.
- **`CLAUDE.local.md`** → osobné poznámky, daj do `.gitignore` (nezdieľa sa s tímom).
- **Multi-tool repo:** ak používaš aj iné AI nástroje, `ln -s CLAUDE.md AGENTS.md` → jeden zdroj pravdy (AGENTS.md je cross-tool štandard).
- **Skill vs. agent:** jednorazový task = skill/command; perzistentný špecialista s izoláciou a obmedzenými toolmi = subagent.
- **Inštalačné poradie:** `/init` → prepíš CLAUDE.md → settings.json (allowlist) → hooky z mastera → agent + commands → `agent_docs/`. Over cez `/hooks` a `/reload-skills`.
