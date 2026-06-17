# DB integrity follow-ups — LOGIC-006 & LOGIC-014

**Status:** deliberate, DB-tested migrations — NOT shipped as blind schema edits.
**Why documented, not auto-applied:** both touch live data semantics. Shipping them
blind (no real DB to test against) would either **fail your critical-path `db push`**
(unique constraint on existing duplicates) or **silently destroy data** (wrong cascade
direction). Apply them deliberately, in this order, against a DB where you can first
_measure_ the data. Run these AFTER the Wave-1 `db push`
([`wave1-migration-runbook.md`](./wave1-migration-runbook.md)), as a separate step.

---

## LOGIC-006 — duplicate candidates / duplicate contact emails

`CandidateContact.email` is nullable and the model has **no `orgId`** (it reaches org via
`candidate.orgId`). So there are two different things to harden, with different risk:

### (a) SAFE — one email per candidate (contact-level uniqueness)

Prevents a single candidate from listing the same email twice. Additive; NULLs are
exempt in Postgres. **Only risk:** an existing candidate already has two contacts with
the _same non-null_ email → the index creation fails until deduped.

**1. Measure first:**

```sql
SELECT "candidateId", lower(email) AS email, count(*)
FROM "CandidateContact"
WHERE email IS NOT NULL
GROUP BY "candidateId", lower(email)
HAVING count(*) > 1;
```

**2. If the query returns rows, dedup (keep the primary / newest):**

```sql
DELETE FROM "CandidateContact" c
USING "CandidateContact" d
WHERE c."candidateId" = d."candidateId"
  AND lower(c.email) = lower(d.email)
  AND c.email IS NOT NULL
  AND (c."isPrimary" < d."isPrimary"          -- drop non-primary first
       OR (c."isPrimary" = d."isPrimary" AND c."createdAt" < d."createdAt")
       OR (c."isPrimary" = d."isPrimary" AND c."createdAt" = d."createdAt" AND c.id < d.id));
```

**3. Apply the constraint** (then mirror it into BOTH `schema.prisma` files as
`@@unique([candidateId, email])` so the schema stays byte-identical and the next
`db push` is a no-op):

```sql
CREATE UNIQUE INDEX "CandidateContact_candidateId_email_key"
  ON "CandidateContact" ("candidateId", email);
```

### (b) BIGGER — one candidate per email per org (the real "duplicate candidate" fix)

This is the actual LOGIC-006 intent but it's a **design change**, not a one-liner:
`CandidateContact` would need an `orgId` column (backfilled from `candidate.orgId`) plus a
**partial unique index** on `(orgId, lower(email)) WHERE isPrimary AND email IS NOT NULL`,
AND a merge strategy for the candidates that are already duplicated. Measure the blast
radius first:

```sql
SELECT cand."orgId", lower(cc.email) AS email, count(DISTINCT cc."candidateId") AS candidates
FROM "CandidateContact" cc
JOIN "Candidate" cand ON cand.id = cc."candidateId"
WHERE cc.email IS NOT NULL AND cc."isPrimary"
GROUP BY cand."orgId", lower(cc.email)
HAVING count(DISTINCT cc."candidateId") > 1;
```

Do **(b)** as its own project (with a candidate-merge tool) — do not bundle it into the
launch `db push`.

---

## LOGIC-014 — onDelete rules on Candidate/Job children

Current state: `Candidate`→children (contacts, documents, resumes, applications,
matchScores, invites, attempts, sequenceRuns) and `Job`→children have **no `onDelete`**
(default `Restrict`). `ConsentRecord` already has `onDelete: Cascade`.

**This is NOT a bug, and blind `onDelete: Cascade` everywhere is the wrong fix:**

- GDPR Art.17 erasure already deletes children explicitly, in FK-safe order, inside a
  transaction (`apps/web/src/services/gdpr.service.ts`) — it does **not** rely on DB
  cascades, so it works today.
- The app uses **soft-delete** (`deletedAt`) for `Candidate`, `CandidateDocument`,
  `Resume`, `Application`. A hard `onDelete: Cascade` on e.g. `Job`→`Application` would
  mean _deleting a job permanently destroys all its applications + history_ — a
  data-loss footgun that contradicts the soft-delete design.

**Recommended (deliberate, per-relation) hardening — defense-in-depth, after staging test:**

- `CandidateContact`, `CandidateDocument`, `Resume`, `MatchScore`, `AssessmentInvite`,
  `Attempt`, `EmailSequenceRun` → `onDelete: Cascade` (these are owned wholly by the
  candidate; cascading on a _deliberate_ candidate hard-delete is correct).
- `Application` → keep explicit deletion (it carries cross-entity history); do NOT
  cascade from `Job`.
- Apply by editing BOTH `schema.prisma` files identically, then `prisma migrate diff` →
  review the generated `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT ... ON DELETE`
  → run on **staging first**, verify GDPR erase + normal job/candidate deletes, then prod.

**Bottom line:** the working erasure path means LOGIC-014 is hardening, not a blocker.
Treat it as a reviewed migration, not an automatic edit.
