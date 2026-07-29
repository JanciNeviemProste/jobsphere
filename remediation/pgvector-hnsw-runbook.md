# pgvector — HNSW indexy chýbajú v produkcii (verifikácia + postup)

**Status:** analýza hotová (Claude), **NIČ nebolo spustené proti DB**. Každý príkaz nižšie vyžaduje **tvoj výslovný súhlas** pred spustením — časť z nich prepisuje tabuľku a drží `ACCESS EXCLUSIVE` lock na živej Neon DB.
**Týka sa:** `apps/web/src/lib/semantic-search.ts` (vyhľadávanie kandidátov podľa CV), `packages/db/prisma/migrations/20260120_add_hnsw_vector_indexes/`.
**Súvisí:** [`wave1-migration-runbook.md`](./wave1-migration-runbook.md) (rovnaký `db push` workflow), [`production-env-checklist.md`](./production-env-checklist.md).

---

## Nález — prečo tie indexy takmer isto neexistujú

Migrácia `20260120_add_hnsw_vector_indexes/migration.sql` vytvára `job_embedding_hnsw_idx`
a `resume_section_embedding_hnsw_idx`. **Ale tá migrácia sa v produkcii nikdy nespustila.**

1. **Deploy nespúšťa `migrate deploy`.** `.github/workflows/deploy.yml` (riadky 3-12) explicitne
   hovorí: _„DATABASE MIGRATIONS ARE NOT RUN HERE … Schema changes ship via `prisma db push`
   (migrations dir is a dev-only workflow)."_ Adresár `migrations/` je teda v produkcii mŕtvy kód.
2. **`db push` tie indexy vytvoriť nevie.** `db push` materializuje iba to, čo je zapísateľné
   v `schema.prisma`. Vektorové stĺpce sú `Unsupported(...)`:
   - `Job.embedding` → `Unsupported("vector(1536)")?` (schema.prisma ~riadok 303)
   - `ResumeSection.embeddingVector` → `Unsupported("vector")?` (schema.prisma ~riadok 508)

   a Prisma 5.22 index typ `Hnsw` nepozná vôbec. Overené lokálne (`prisma validate`):

   ```
   error: Error parsing attribute "@index": Unknown index type: Hnsw.
   ```

   (Pre porovnanie: GIN/trigram indexy **sa** zapísať dajú — `type: Gin` + `ops: raw("gin_trgm_ops")`
   Prisma podporuje, preto sú v tejto vlne deklarované priamo v schéme a `db push` ich vytvorí.
   HNSW takú cestu nemá.)
3. **Dôsledok v runtime.** `semantic-search.ts` (`searchCandidates`, `findSimilarCandidates`)
   robí `ORDER BY rs."embeddingVector" <=> $1 LIMIT n`. Bez HNSW indexu to Postgres rieši
   sekvenčným scanom `ResumeSection` + plným sortom cez *všetky* riadky s embeddingom.
   Pri pár stovkách CV to nevidno, rastie to lineárne.
4. **Druhá prekážka — bezrozmerný stĺpec.** pgvector odmieta postaviť HNSW nad `vector` bez
   deklarovanej dimenzie:

   ```
   ERROR:  column does not have dimensions
   ```

   `ResumeSection.embeddingVector` je presne taký prípad. `Job.embedding` má `vector(1536)`,
   takže ten index by sa dal postaviť rovno — problém je len `ResumeSection`.

**Rozmer embeddingov:** 1536 (`apps/web/src/lib/embeddings.ts:33-34` — `text-embedding-3-small`,
`OPENAI_EMBEDDING_DIMENSIONS` default `1536`). Ak niekto v minulosti prepol
`OPENAI_EMBEDDING_MODEL`/`OPENAI_EMBEDDING_DIMENSIONS`, v tabuľke môžu byť zmiešané rozmery —
pre-check v kroku 2 to odhalí a **musí** prejsť pred `ALTER`.

---

## Krok 1 — Verifikácia (read-only, bezpečné)

Toto sú jediné príkazy z tohto dokumentu, ktoré nič nemenia.

```sql
-- 1a. Existujú HNSW indexy vôbec?  Očakávanie podľa analýzy: 0 riadkov.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE indexname IN ('job_embedding_hnsw_idx', 'resume_section_embedding_hnsw_idx');

-- 1b. Širšie — akýkoľvek vektorový index nad týmito tabuľkami.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Job', 'ResumeSection')
  AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%');

-- 1c. Verzia pgvector — HNSW vyžaduje >= 0.5.0.
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 1d. Skutočný typ oboch stĺpcov (formát_type ukáže vector vs vector(1536)).
SELECT c.relname AS table, a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
WHERE (c.relname, a.attname) IN (('Job','embedding'), ('ResumeSection','embeddingVector'));

-- 1e. Koľko riadkov to vlastne skenuje + aké rozmery tam reálne sú.
SELECT count(*) AS total,
       count(*) FILTER (WHERE "embeddingVector" IS NOT NULL) AS with_embedding
FROM "ResumeSection";

SELECT vector_dims("embeddingVector") AS dims, count(*)
FROM "ResumeSection"
WHERE "embeddingVector" IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC;
```

**Interpretácia 1e:** ak posledný dotaz vráti **viac ako jeden riadok**, v tabuľke sú zmiešané
rozmery a `ALTER ... TYPE vector(1536)` zlyhá. Vtedy sa ZASTAV — najprv treba prepočítať alebo
vymazať embeddingy s nesprávnym rozmerom (`embedding.worker.ts` ich vie vygenerovať znova).

Voliteľne (ukáže dnešný plán — očakávaj `Seq Scan` + `Sort`):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, 1 - (rs."embeddingVector" <=> (SELECT "embeddingVector" FROM "ResumeSection"
        WHERE "embeddingVector" IS NOT NULL LIMIT 1)) AS similarity
FROM "ResumeSection" rs JOIN "Resume" r ON rs."resumeId" = r.id
WHERE rs."embeddingVector" IS NOT NULL
ORDER BY rs."embeddingVector" <=> (SELECT "embeddingVector" FROM "ResumeSection"
        WHERE "embeddingVector" IS NOT NULL LIMIT 1)
LIMIT 10;
```

---

## Krok 2 — Pin typu na `vector(1536)` ⚠️ PREPIS TABUĽKY

> **NESPÚŠŤAJ BEZ SÚHLASU.** `ALTER TABLE ... ALTER COLUMN ... TYPE` na pgvector stĺpci je
> **plný rewrite tabuľky** pod `ACCESS EXCLUSIVE` lockom: po celý čas blokuje **aj čítania**
> `ResumeSection` — teda parsovanie CV aj semantic search. Trvanie rastie s veľkosťou tabuľky
> (rádovo sekundy pri tisíckach riadkov, minúty pri státisícoch). Rob to v okne s najnižšou
> prevádzkou a po zálohe.

```sql
-- 0. Záloha (povinné)
--    pg_dump "$DATABASE_URL" -t '"ResumeSection"' > backup_resumesection_pre_hnsw.sql

-- 1. Pre-check MUSÍ vrátiť práve jeden riadok s dims = 1536 (dotaz 1e vyššie).

-- 2. Nenechaj sa zablokovať navždy: ak lock nezískaš do 5 s, celé to spadne a nič sa nestane.
SET lock_timeout = '5s';
SET statement_timeout = '30min';

BEGIN;
ALTER TABLE "ResumeSection"
  ALTER COLUMN "embeddingVector" TYPE vector(1536)
  USING "embeddingVector"::vector(1536);
COMMIT;
```

**Hneď po úspešnom `ALTER` uprav `packages/db/prisma/schema.prisma`:**

```prisma
// model ResumeSection
embeddingVector Unsupported("vector(1536)")?   // bolo: Unsupported("vector")?
```

Bez toho bude najbližší `yarn db:push` vidieť drift a pokúsi sa stĺpec zmeniť späť na bezrozmerný
`vector` — čiže **zhodí index z kroku 3 a zopakuje rewrite**. Zmena schémy a `ALTER` musia ísť
v jednom kroku (najprv DB, potom schéma, potom deploy).

`Job.embedding` už `vector(1536)` je (potvrď dotazom 1d) — pre `Job` sa krok 2 nerobí.

---

## Krok 3 — Vytvorenie HNSW indexov ⚠️

```sql
-- CONCURRENTLY = bez ACCESS EXCLUSIVE locku, tabuľka zostáva zapisovateľná.
-- MUSÍ bežať mimo transakcie (psql bez BEGIN; NIE cez prisma migrate).
-- Build je aj tak CPU-náročný; na Neone sleduj compute.
SET maintenance_work_mem = '2GB';          -- zrýchli build; zníž ak compute nestačí
SET max_parallel_maintenance_workers = 4;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "resume_section_embedding_hnsw_idx"
  ON "ResumeSection" USING hnsw ("embeddingVector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "job_embedding_hnsw_idx"
  ON "Job" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

RESET maintenance_work_mem;
RESET max_parallel_maintenance_workers;
```

Parametre sú zhodné s `20260120_add_hnsw_vector_indexes/migration.sql` (`m = 16`,
`ef_construction = 64`, `vector_cosine_ops` — zodpovedá operátoru `<=>` v `semantic-search.ts`).

**Overenie po builde** — `CREATE INDEX CONCURRENTLY` môže zlyhať a nechať po sebe neplatný index:

```sql
SELECT i.indexrelid::regclass AS index, i.indisvalid, i.indisready
FROM pg_index i
WHERE i.indexrelid::regclass::text IN ('resume_section_embedding_hnsw_idx', 'job_embedding_hnsw_idx');

-- Ak indisvalid = false → DROP INDEX CONCURRENTLY "<meno>"; a postav znova.

ANALYZE "ResumeSection";
ANALYZE "Job";
```

Potom zopakuj `EXPLAIN (ANALYZE)` z kroku 1 — má sa objaviť `Index Scan using
resume_section_embedding_hnsw_idx` namiesto `Seq Scan` + `Sort`.

**Runtime tuning už v kóde je:** `semantic-search.ts` nastavuje `SET LOCAL hnsw.ef_search = 100`
vnútri `prisma.$transaction`, takže hodnota dosadne na tú istú connection ako samotný dotaz
(predtým to bol samostatný `SET` — pri poolingu často pristál na inej connection a navyše
session-level unikal do nesúvisiacich dotazov). Vyššie `ef_search` = lepší recall, pomalší dotaz.

---

## Rollback

```sql
-- Index (bezpečné, bez locku, kedykoľvek)
DROP INDEX CONCURRENTLY IF EXISTS "resume_section_embedding_hnsw_idx";
DROP INDEX CONCURRENTLY IF EXISTS "job_embedding_hnsw_idx";

-- Typ stĺpca späť na bezrozmerný (opäť plný rewrite + ACCESS EXCLUSIVE lock).
-- Indexy z kroku 3 zahoď PRED týmto.
BEGIN;
ALTER TABLE "ResumeSection"
  ALTER COLUMN "embeddingVector" TYPE vector
  USING "embeddingVector"::vector;
COMMIT;
```

A vráť `schema.prisma` na `Unsupported("vector")?`, nech `db push` nevidí drift.
Krajný prípad: `psql "$DATABASE_URL" < backup_resumesection_pre_hnsw.sql` zo zálohy v kroku 2.

---

## Odporúčanie

Krok 3 pre `Job.embedding` je **nízkorizikový** (stĺpec už má dimenziu, `CONCURRENTLY` nezamyká
zápisy) a dá sa spraviť samostatne. Krok 2 pre `ResumeSection` je **jediná riziková časť** celého
dokumentu — vyžaduje okno, zálohu a čistý pre-check. Ak sa doň teraz nechce ísť, semantic search
zostane na seq scane, ale nič sa nerozbije.

Dlhodobo: buď sa `migrations/` začne reálne aplikovať (`migrate deploy` v deploy pipeline), alebo
sa `20260120_add_hnsw_vector_indexes` označí v READMEčku ako **manuálna** migrácia — inak ostane
v repozitári ako index, o ktorom si všetci myslia, že existuje.

---

## Príloha A — btree/trigram indexy z `20260729_add_query_indexes` na živej DB

Tieto **sú** deklarované v `schema.prisma`, takže `yarn db:push` ich vytvorí sám — ale
neconcurrent buildom, ktorý drží `ACCESS EXCLUSIVE` lock na `Job` a `Organization` (GIN nad
`Job.description` je z nich najdlhší). Ak to nechceš riskovať počas prevádzky, postav ich najprv
ručne `CONCURRENTLY` — mená sú zhodné s tým, čo Prisma generuje, takže následný `db push` ich
uvidí ako hotové a preskočí:

```sql
-- Mimo transakcie (psql, bez BEGIN).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Job_status_createdAt_idx"
  ON "Job"("status", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MatchScore_candidateId_idx"
  ON "MatchScore"("candidateId");

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Job_title_idx"
  ON "Job" USING GIN ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Organization_name_idx"
  ON "Organization" USING GIN ("name" gin_trgm_ops);

-- Najväčší z trojice (dlhý voľný text) — postav ho posledný a sleduj storage.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Job_description_idx"
  ON "Job" USING GIN ("description" gin_trgm_ops);

-- Overenie platnosti (rovnako ako pri HNSW — CONCURRENTLY vie nechať neplatný index).
SELECT indexrelid::regclass AS index, indisvalid
FROM pg_index
WHERE indexrelid::regclass::text IN
  ('Job_status_createdAt_idx','MatchScore_candidateId_idx',
   'Job_title_idx','Job_description_idx','Organization_name_idx');

ANALYZE "Job"; ANALYZE "Organization"; ANALYZE "MatchScore";
```

Rollback: `DROP INDEX CONCURRENTLY IF EXISTS "<meno>";` — indexy sú čisto additívne, nič nemažú.
