# 🔄 Database Migration Guide: orgId Standardization

**Date:** 2025-10-08
**Migration Name:** `standardize_org_id_naming`
**Status:** ⚠️ REQUIRED BEFORE DEPLOYMENT

---

## ⚠️ CRITICAL WARNING

**DO NOT DEPLOY WITHOUT RUNNING THIS MIGRATION!**

The Prisma schema has been updated to use `orgId` instead of `organizationId` in 4 models. The database MUST be migrated before deploying the new code, otherwise the application will crash with column not found errors.

---

## 📋 What Changed

### Schema Changes (4 Models)

| Model | Old Column | New Column |
|-------|------------|------------|
| `OrgMember` | `organizationId` | `orgId` |
| `Job` | `organizationId` | `orgId` |
| `Subscription` | `organizationId` | `orgId` |
| `Invoice` | `organizationId` | `orgId` |

### Indexes Updated

All indexes referencing `organizationId` have been renamed to use `orgId`:
- `OrgMember_organizationId_idx` → `OrgMember_orgId_idx`
- `Job_organizationId_idx` → `Job_orgId_idx`
- `Subscription_organizationId_idx` → `Subscription_orgId_idx`
- `Invoice_organizationId_idx` → `Invoice_orgId_idx`

### Foreign Keys

All foreign key constraints remain intact, just column names change.

---

## 🚀 Migration Steps

### Step 1: Backup Database (REQUIRED!)

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_before_orgid_migration_$(date +%Y%m%d).sql

# Or using Vercel Postgres CLI
vercel postgres backup create
```

### Step 2: Run Migration (Development)

```bash
cd apps/web

# Generate migration
npx prisma migrate dev --name standardize_org_id_naming

# This will:
# 1. Create migration file
# 2. Apply to development database
# 3. Regenerate Prisma client
```

### Step 3: Review Migration SQL

Check `apps/web/prisma/migrations/[timestamp]_standardize_org_id_naming/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "OrgMember" RENAME COLUMN "organizationId" TO "orgId";
ALTER TABLE "Job" RENAME COLUMN "organizationId" TO "orgId";
ALTER TABLE "Subscription" RENAME COLUMN "organizationId" TO "orgId";
ALTER TABLE "Invoice" RENAME COLUMN "organizationId" TO "orgId";

-- RenameIndex
ALTER INDEX "OrgMember_organizationId_idx" RENAME TO "OrgMember_orgId_idx";
ALTER INDEX "Job_organizationId_idx" RENAME TO "Job_orgId_idx";
ALTER INDEX "Subscription_organizationId_idx" RENAME TO "Subscription_orgId_idx";
ALTER INDEX "Invoice_organizationId_idx" RENAME TO "Invoice_orgId_idx";

-- Update unique constraints if any
-- (Prisma will handle this automatically)
```

### Step 4: Test Migration

```bash
# Run tests to verify everything works
yarn test

# Check TypeScript
yarn typecheck

# Test specific queries
yarn prisma studio
# Verify data is accessible with new column names
```

### Step 5: Deploy to Production

#### Option A: Vercel Automatic (Recommended)

1. Push code to GitHub (already done)
2. Vercel will detect schema change
3. **Manual step required:** Run migration via Vercel dashboard:
   - Go to Vercel project → Storage → Postgres
   - Run migration command in SQL editor

#### Option B: Manual Migration

```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Apply migration
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

#### Option C: Vercel CLI

```bash
# Deploy and run migrations
vercel --prod

# Then connect to production DB and run:
vercel postgres -- psql
# Execute migration SQL manually
```

---

## 🔍 Verification Checklist

After migration, verify:

- [ ] All 4 tables have `orgId` column
- [ ] No `organizationId` column remains
- [ ] Indexes are renamed correctly
- [ ] Foreign keys still work
- [ ] Application starts without errors
- [ ] User can log in
- [ ] Employer can view jobs
- [ ] Applications can be created
- [ ] Stripe integration works

### Quick Verification Queries

```sql
-- Check column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'OrgMember' AND column_name = 'orgId';

-- Should return 'orgId', not 'organizationId'

-- Check data integrity
SELECT COUNT(*) FROM "OrgMember" WHERE "orgId" IS NOT NULL;
SELECT COUNT(*) FROM "Job" WHERE "orgId" IS NOT NULL;
SELECT COUNT(*) FROM "Subscription" WHERE "orgId" IS NOT NULL;
SELECT COUNT(*) FROM "Invoice" WHERE "orgId" IS NOT NULL;
```

---

## 🆘 Rollback Plan

If migration fails or causes issues:

### Immediate Rollback

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup_before_orgid_migration_*.sql

# Or revert code
git revert HEAD~1  # Revert schema change commit
git push --force

# Redeploy old version
vercel --prod
```

### Partial Rollback (Column Rename)

```sql
-- Manually rename columns back
ALTER TABLE "OrgMember" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Job" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Subscription" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "Invoice" RENAME COLUMN "orgId" TO "organizationId";

-- Rename indexes back
ALTER INDEX "OrgMember_orgId_idx" RENAME TO "OrgMember_organizationId_idx";
ALTER INDEX "Job_orgId_idx" RENAME TO "Job_organizationId_idx";
ALTER INDEX "Subscription_orgId_idx" RENAME TO "Subscription_organizationId_idx";
ALTER INDEX "Invoice_orgId_idx" RENAME TO "Invoice_organizationId_idx";
```

---

## 📊 Migration Impact

**Downtime:** ~2-5 seconds (column rename is fast)
**Risk Level:** Low (simple column rename)
**Data Loss Risk:** None (column rename preserves data)
**Breaking Change:** Yes (requires code deployment)

**Affected Features:**
- ✅ Organization management
- ✅ Job posting/viewing
- ✅ Application submission
- ✅ Billing/subscriptions
- ✅ Team member management

---

## 🎯 Post-Migration Tasks

After successful migration:

1. **Monitor Sentry** for any database-related errors
2. **Check logs** for "column not found" errors
3. **Test critical flows:**
   - User signup/login
   - Job creation
   - Application submission
   - Stripe checkout
4. **Verify analytics** - ensure data is flowing correctly
5. **Update documentation** if needed

---

## 📞 Support

If issues occur:
1. Check Vercel logs: `vercel logs --prod`
2. Check Sentry dashboard
3. Review migration status: `npx prisma migrate status`
4. Check this guide's rollback section

---

## ✅ Migration Complete Checklist

- [ ] Database backed up
- [ ] Migration generated (`prisma migrate dev`)
- [ ] Migration SQL reviewed
- [ ] Local testing passed
- [ ] Migration applied to production
- [ ] Verification queries executed
- [ ] Application deployed and running
- [ ] Critical flows tested
- [ ] No errors in Sentry
- [ ] Team notified of completion

---

**Status:** ⏳ Pending execution
**Required By:** Before next production deployment
**Estimated Duration:** 15-30 minutes
**Last Updated:** 2025-10-08

---

*Generated by Claude Code*
