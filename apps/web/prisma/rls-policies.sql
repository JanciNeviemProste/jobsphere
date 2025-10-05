-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant isolation pre JobSphere
-- ============================================================================

-- Enable RLS na všetkých org-specific tabuľkách
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailSuppressionList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataRetentionPolicy" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Získa orgId pre aktuálneho usera
CREATE OR REPLACE FUNCTION current_user_org_ids()
RETURNS SETOF TEXT AS $$
  SELECT "organizationId"
  FROM "OrgMember"
  WHERE "userId" = current_setting('app.current_user_id', true)::text;
$$ LANGUAGE SQL STABLE;

-- Overí či user má daný role v org
CREATE OR REPLACE FUNCTION user_has_org_role(org_id TEXT, required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "OrgMember"
    WHERE "userId" = current_setting('app.current_user_id', true)::text
      AND "organizationId" = org_id
      AND "role" = required_role
  );
$$ LANGUAGE SQL STABLE;

-- Overí či user je member organizácie
CREATE OR REPLACE FUNCTION user_is_org_member(org_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "OrgMember"
    WHERE "userId" = current_setting('app.current_user_id', true)::text
      AND "organizationId" = org_id
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- ORGANIZATION POLICIES
-- ============================================================================

-- Vidieť len organizácie kde je user member
CREATE POLICY org_select_policy ON "Organization"
  FOR SELECT
  USING (id IN (SELECT current_user_org_ids()));

-- Update len ak je ADMIN
CREATE POLICY org_update_policy ON "Organization"
  FOR UPDATE
  USING (user_has_org_role(id, 'ADMIN'));

-- ============================================================================
-- ORG MEMBER POLICIES
-- ============================================================================

CREATE POLICY org_member_select ON "OrgMember"
  FOR SELECT
  USING ("organizationId" IN (SELECT current_user_org_ids()));

CREATE POLICY org_member_insert ON "OrgMember"
  FOR INSERT
  WITH CHECK (user_has_org_role("organizationId", 'ADMIN'));

CREATE POLICY org_member_delete ON "OrgMember"
  FOR DELETE
  USING (user_has_org_role("organizationId", 'ADMIN'));

-- ============================================================================
-- JOB POLICIES
-- ============================================================================

-- Vidieť len joby z vlastných org
CREATE POLICY job_select ON "Job"
  FOR SELECT
  USING ("organizationId" IN (SELECT current_user_org_ids()));

-- Vytvoriť job môže ADMIN alebo RECRUITER
CREATE POLICY job_insert ON "Job"
  FOR INSERT
  WITH CHECK (
    user_has_org_role("organizationId", 'ADMIN') OR
    user_has_org_role("organizationId", 'RECRUITER')
  );

-- Update job
CREATE POLICY job_update ON "Job"
  FOR UPDATE
  USING (
    user_has_org_role("organizationId", 'ADMIN') OR
    user_has_org_role("organizationId", 'RECRUITER')
  );

-- Delete job
CREATE POLICY job_delete ON "Job"
  FOR DELETE
  USING (user_has_org_role("organizationId", 'ADMIN'));

-- ============================================================================
-- EMAIL ACCOUNT POLICIES
-- ============================================================================

CREATE POLICY email_account_select ON "EmailAccount"
  FOR SELECT
  USING (user_is_org_member("orgId"));

CREATE POLICY email_account_insert ON "EmailAccount"
  FOR INSERT
  WITH CHECK (user_has_org_role("orgId", 'ADMIN'));

CREATE POLICY email_account_delete ON "EmailAccount"
  FOR DELETE
  USING (user_has_org_role("orgId", 'ADMIN'));

-- ============================================================================
-- EMAIL THREAD & MESSAGE POLICIES
-- ============================================================================

CREATE POLICY email_thread_select ON "EmailThread"
  FOR SELECT
  USING (
    "accountId" IN (
      SELECT id FROM "EmailAccount"
      WHERE user_is_org_member("orgId")
    )
  );

CREATE POLICY email_message_select ON "EmailMessage"
  FOR SELECT
  USING (
    "accountId" IN (
      SELECT id FROM "EmailAccount"
      WHERE user_is_org_member("orgId")
    )
  );

-- ============================================================================
-- EMAIL SEQUENCE POLICIES
-- ============================================================================

CREATE POLICY email_sequence_select ON "EmailSequence"
  FOR SELECT
  USING (user_is_org_member("orgId"));

CREATE POLICY email_sequence_insert ON "EmailSequence"
  FOR INSERT
  WITH CHECK (
    user_has_org_role("orgId", 'ADMIN') OR
    user_has_org_role("orgId", 'RECRUITER')
  );

CREATE POLICY email_sequence_update ON "EmailSequence"
  FOR UPDATE
  USING (
    user_has_org_role("orgId", 'ADMIN') OR
    user_has_org_role("orgId", 'RECRUITER')
  );

-- ============================================================================
-- ASSESSMENT POLICIES
-- ============================================================================

CREATE POLICY assessment_select ON "Assessment"
  FOR SELECT
  USING (user_is_org_member("orgId"));

CREATE POLICY assessment_insert ON "Assessment"
  FOR INSERT
  WITH CHECK (
    user_has_org_role("orgId", 'ADMIN') OR
    user_has_org_role("orgId", 'RECRUITER')
  );

CREATE POLICY assessment_update ON "Assessment"
  FOR UPDATE
  USING (
    user_has_org_role("orgId", 'ADMIN') OR
    user_has_org_role("orgId", 'RECRUITER')
  );

-- ============================================================================
-- ENTITLEMENT & USAGE POLICIES
-- ============================================================================

CREATE POLICY entitlement_select ON "Entitlement"
  FOR SELECT
  USING (user_is_org_member("orgId"));

CREATE POLICY usage_event_select ON "UsageEvent"
  FOR SELECT
  USING (user_is_org_member("orgId"));

-- Len system môže zapisovať usage events (cez service account)
CREATE POLICY usage_event_insert ON "UsageEvent"
  FOR INSERT
  WITH CHECK (current_setting('app.service_account', true) = 'true');

-- ============================================================================
-- BILLING POLICIES
-- ============================================================================

CREATE POLICY org_customer_select ON "OrgCustomer"
  FOR SELECT
  USING (user_has_org_role("orgId", 'ADMIN'));

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================

CREATE POLICY audit_log_select ON "AuditLog"
  FOR SELECT
  USING (
    "orgId" IS NULL OR
    user_has_org_role("orgId", 'ADMIN')
  );

-- Len system môže zapisovať audit logy
CREATE POLICY audit_log_insert ON "AuditLog"
  FOR INSERT
  WITH CHECK (current_setting('app.service_account', true) = 'true');

-- ============================================================================
-- DATA RETENTION POLICIES
-- ============================================================================

CREATE POLICY retention_policy_select ON "DataRetentionPolicy"
  FOR SELECT
  USING (user_has_org_role("orgId", 'ADMIN'));

CREATE POLICY retention_policy_manage ON "DataRetentionPolicy"
  FOR ALL
  USING (user_has_org_role("orgId", 'ADMIN'))
  WITH CHECK (user_has_org_role("orgId", 'ADMIN'));

-- ============================================================================
-- SUPPRESSION LIST POLICIES
-- ============================================================================

CREATE POLICY suppression_list_select ON "EmailSuppressionList"
  FOR SELECT
  USING (user_is_org_member("orgId"));

-- Len system môže pridávať do suppression listu
CREATE POLICY suppression_list_insert ON "EmailSuppressionList"
  FOR INSERT
  WITH CHECK (current_setting('app.service_account', true) = 'true');

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Pre web app usera
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jobsphere_web;

-- Pre worker usera (service account)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jobsphere_worker;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- Pre nastavenie current_user_id v aplikácii:
-- SET LOCAL app.current_user_id = 'user_id_here';
--
-- Pre service account operácie:
-- SET LOCAL app.service_account = 'true';
--
-- Príklad v Prisma middleware:
-- prisma.$use(async (params, next) => {
--   if (params.model && userId) {
--     await prisma.$executeRaw`SET LOCAL app.current_user_id = ${userId}`;
--   }
--   return next(params);
-- });
