---
description: Diff-scoped security check + testy + update posture po zmene kódu (NIE full audit)
---

Sprav Definition of Done pre AKTUÁLNU zmenu:

1. `git diff` — prejdi len zmenené súbory proti security checklistu
   (secrets, authZ/IDOR, **org-scoping cez orgId/UserOrgRole**, input validation, injection, Stripe webhook podpis, PII/GDPR). NIE full-repo audit.
2. Spusti `yarn typecheck` + `yarn lint` + `yarn test`; ak na novej/zmenenej kritickej ceste chýba security test, DOPÍŠ ho.
3. Prepočítaj posture skóre (od 100: Critical −20 / High −10 / Medium −4 / Low −1) a aktualizuj sekciu `## Security posture` v `CLAUDE.md` aj `bezpecnostny-audit/findings.json`.
4. Krátky slovenský súhrn s % (pred/po) a „Po lopate" pri každom náleze. Žiadne secrets do výstupu (len súbor + typ).

$ARGUMENTS
