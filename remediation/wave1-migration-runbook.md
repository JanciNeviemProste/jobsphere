# Wave 1 — Migrácia #1: Candidate ↔ User link + ConsentRecord FK

**Status:** schémy upravené (Claude), **migráciu spúšťaš ty** (potrebuje bežiacu Postgres+pgvector DB).
**Odomyká:** Stream A (identity resolver → „moje prihlášky", withdraw, assessment submit), GDPR export, perzistenciu CV (CandidateDocument), GDPR delete integritu.

---

## Čo migrácia robí (presný DDL — overené `prisma migrate diff`, bez DB)

```sql
ALTER TABLE "Candidate" ADD COLUMN "userId" TEXT;
CREATE INDEX "Candidate_userId_idx" ON "Candidate"("userId");
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Bezpečnosť:** čisto additívne — nový nullable stĺpec (bez data loss), index, 2 FK. Žiadny `DROP`, žiadna zmena typu.
**Jediné riziko:** FK na `ConsentRecord.candidateId` zlyhá, ak existujú osirotené `candidateId` → Sekcia A v backfill SQL to ošetrí.

**Pozn. k workflow:** `apps/web/prisma/.gitignore` ignoruje `migrations/`, čiže projekt reálne používa **`prisma db push`** (sync schémy → DB bez migračných súborov), nie migračné súbory. Postup nižšie preto vedie cez `db:push`. Obe schémy (`apps/web/prisma` + `packages/db/prisma`) som upravil identicky a **mieria na tú istú DB** — sync robíš **raz** (cez apps/web); `packages/db` len zregeneruje klienta.

---

## Postup (staging/lokálne najprv, potom produkcia)

```bash
# 0. Záloha DB (povinné pred nevratnou zmenou)
pg_dump "$DATABASE_URL" > backup_pre_wave1.sql

# 1. PRE-CHECK orphan ConsentRecord (Sekcia A v backfill SQL) — ak vráti riadky, null-ni ich
psql "$DATABASE_URL" -c 'SELECT cr.id, cr."candidateId" FROM "ConsentRecord" cr
  LEFT JOIN "Candidate" c ON c.id = cr."candidateId"
  WHERE cr."candidateId" IS NOT NULL AND c.id IS NULL;'

# 2. Sync schémy do DB (additívne: pridá userId stĺpec, index, 2 FK; nemá si pýtať --accept-data-loss)
cd apps/web
yarn db:push
#    ⚠️ Ak db:push hlási data-loss/drop, ZASTAV sa — znamená to predošlý drift (LOGIC-007);
#    tieto 4 zmeny sú čisto additívne a žiadny drop nevyžadujú.

# 3. Backfill Candidate.userId
psql "$DATABASE_URL" -f ../../remediation/wave1_candidate_userId.sql

# 4. Regeneruj oboch Prisma klientov (web + db)
yarn db:generate
cd ../.. && npx turbo run build --filter=@jobsphere/db

# 5. Verifikácia (Sekcia C v backfill SQL)
psql "$DATABASE_URL" -c 'SELECT count(*) FILTER (WHERE "userId" IS NOT NULL) AS linked,
  count(*) FILTER (WHERE "userId" IS NULL) AS unlinked FROM "Candidate";'
```

**Produkcia:** rovnaký postup proti produkčnej DB (krok 0 záloha → 1 pre-check → 2 `db:push` → 3 backfill → 5 verifikácia). Spusti **raz**.

**Alternatíva s migračnými súbormi** (ak chceš auditovateľnú históriu namiesto `db push`): odignoruj `migrations/` v `apps/web/prisma/.gitignore`, potom `yarn prisma migrate dev --name add_candidate_user_link_and_consent_fk`, skontroluj že vygenerovaný `migration.sql` obsahuje PRESNE 4 príkazy vyššie (ak viac → predošlý drift, vyrieš najprv), commitni migráciu, na deployi `prisma migrate deploy`.

---

## Rollback (additívne, bezpečné)

```sql
ALTER TABLE "ConsentRecord" DROP CONSTRAINT "ConsentRecord_candidateId_fkey";
ALTER TABLE "Candidate" DROP CONSTRAINT "Candidate_userId_fkey";
DROP INDEX "Candidate_userId_idx";
ALTER TABLE "Candidate" DROP COLUMN "userId";
```

(Alebo `psql "$DATABASE_URL" < backup_pre_wave1.sql` z kroku 0.)

---

## Po tejto migrácii (nadväzuje)

- **Stream A** (Opus/max): identity resolver využije `Candidate.userId` → opraviť `applications/mine`, withdraw, assessment submit, `createApplication`.
- **SEC-001 CV perzistencia** (Opus/high): pri upload/parse vytvárať `CandidateDocument` + linkovať `Resume.sourceDocumentId`; potom private serving (po upgrade `@vercel/blob`).
- **Migrácia #2** (Wave 1 zvyšok): drift reconcile (LOGIC-007: `Application.expectedSalary/availableFrom` + chýbajúce indexy do `apps/web`), onDelete cascade na zvyšných Candidate/Job delete-cestách (GDPR výmaz, LOGIC-014), `CandidateContact` partial unique (LOGIC-006).
