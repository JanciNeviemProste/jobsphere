-- Row Level Security Policies for JobSphere
-- This file contains all RLS policies for multi-tenancy and data isolation

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

-- ============ ORGANIZATION POLICIES ============
-- Users can only see organizations they belong to
CREATE POLICY org_select ON organizations
    FOR SELECT
    USING (
        is_org_member(id) OR
        current_user_role() = 'SUPER_ADMIN'
    );

CREATE POLICY org_insert ON organizations
    FOR INSERT
    WITH CHECK (
        current_user_role() = 'SUPER_ADMIN'
    );

CREATE POLICY org_update ON organizations
    FOR UPDATE
    USING (
        has_role('ORG_ADMIN', id) OR
        current_user_role() = 'SUPER_ADMIN'
    );

-- ============ USER POLICIES ============
-- Users can see other users in their organizations
CREATE POLICY user_select ON users
    FOR SELECT
    USING (
        id = current_user_id() OR
        EXISTS (
            SELECT 1 FROM user_org_roles uor1
            WHERE uor1.user_id = users.id
            AND EXISTS (
                SELECT 1 FROM user_org_roles uor2
                WHERE uor2.user_id = current_user_id()
                AND uor2.org_id = uor1.org_id
            )
        ) OR
        current_user_role() = 'SUPER_ADMIN'
    );

CREATE POLICY user_update ON users
    FOR UPDATE
    USING (
        id = current_user_id() OR
        current_user_role() = 'SUPER_ADMIN'
    );

-- ============ JOB POLICIES ============
-- Public can see published jobs
CREATE POLICY job_select_public ON jobs
    FOR SELECT
    USING (
        status = 'PUBLISHED' AND deleted_at IS NULL
    );

-- Org members can see all their org's jobs
CREATE POLICY job_select_org ON jobs
    FOR SELECT
    USING (
        is_org_member(org_id)
    );

-- Agency users can only see assigned jobs
CREATE POLICY job_select_agency ON jobs
    FOR SELECT
    USING (
        current_user_role() = 'AGENCY' AND
        id = ANY(
            SELECT unnest(assigned_jobs)
            FROM user_org_roles
            WHERE user_id = current_user_id() AND org_id = jobs.org_id
        )
    );

CREATE POLICY job_insert ON jobs
    FOR INSERT
    WITH CHECK (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER') AND
        has_entitlement('job_slots', org_id)
    );

CREATE POLICY job_update ON jobs
    FOR UPDATE
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER')
    );

-- ============ CANDIDATE POLICIES ============
-- Candidates are org-scoped
CREATE POLICY candidate_select ON candidates
    FOR SELECT
    USING (
        is_org_member(org_id) OR
        (
            current_user_role() = 'AGENCY' AND
            id = ANY(
                SELECT unnest(assigned_candidates)
                FROM user_org_roles
                WHERE user_id = current_user_id() AND org_id = candidates.org_id
            )
        )
    );

CREATE POLICY candidate_insert ON candidates
    FOR INSERT
    WITH CHECK (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER')
    );

CREATE POLICY candidate_update ON candidates
    FOR UPDATE
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER')
    );

-- ============ APPLICATION POLICIES ============
CREATE POLICY application_select ON applications
    FOR SELECT
    USING (
        is_org_member(org_id) OR
        (
            current_user_role() = 'AGENCY' AND
            EXISTS (
                SELECT 1 FROM jobs j
                WHERE j.id = applications.job_id
                AND j.id = ANY(
                    SELECT unnest(assigned_jobs)
                    FROM user_org_roles
                    WHERE user_id = current_user_id() AND org_id = applications.org_id
                )
            )
        )
    );

CREATE POLICY application_insert ON applications
    FOR INSERT
    WITH CHECK (
        -- Public can apply to published jobs
        EXISTS (
            SELECT 1 FROM jobs
            WHERE id = job_id AND status = 'PUBLISHED'
        ) OR
        -- Org members can create applications
        (
            is_org_member(org_id) AND
            current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER')
        )
    );

CREATE POLICY application_update ON applications
    FOR UPDATE
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER')
    );

-- ============ EMAIL POLICIES ============
CREATE POLICY email_account_all ON email_accounts
    FOR ALL
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER')
    );

CREATE POLICY email_sequence_select ON email_sequences
    FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY email_sequence_modify ON email_sequences
    FOR ALL
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER') AND
        has_entitlement('email_sequences', org_id)
    );

-- ============ ASSESSMENT POLICIES ============
CREATE POLICY assessment_select ON assessments
    FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY assessment_modify ON assessments
    FOR ALL
    USING (
        is_org_member(org_id) AND
        current_user_role() IN ('ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER') AND
        has_entitlement('assessments_per_month', org_id)
    );

-- Candidates can see their own invites
CREATE POLICY invite_select ON assessment_invites
    FOR SELECT
    USING (
        candidate_id IN (
            SELECT id FROM candidates WHERE org_id = current_org_id()
        ) OR
        token IS NOT NULL  -- Public access with token
    );

-- Candidates can see their own attempts
CREATE POLICY attempt_select ON attempts
    FOR SELECT
    USING (
        candidate_id IN (
            SELECT id FROM candidates WHERE org_id = current_org_id()
        ) OR
        EXISTS (
            SELECT 1 FROM assessment_invites ai
            WHERE ai.id = invite_id AND ai.token IS NOT NULL
        )
    );

-- ============ BILLING POLICIES ============
CREATE POLICY subscription_select ON subscriptions
    FOR SELECT
    USING (
        has_role('ORG_ADMIN', org_id) OR
        current_user_role() = 'SUPER_ADMIN'
    );

CREATE POLICY entitlement_select ON entitlements
    FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY entitlement_modify ON entitlements
    FOR UPDATE
    USING (
        current_user_role() = 'SUPER_ADMIN'
    );

-- ============ AUDIT POLICIES ============
-- Audit logs are append-only
CREATE POLICY audit_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY audit_select ON audit_logs
    FOR SELECT
    USING (
        (org_id IS NOT NULL AND has_role('ORG_ADMIN', org_id)) OR
        current_user_role() = 'SUPER_ADMIN'
    );

-- No one can update or delete audit logs
-- (No UPDATE or DELETE policies means operations are denied)