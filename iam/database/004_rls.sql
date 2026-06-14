-- ============================================================
-- Climactix Global — Row-Level Security Policies v1.0
-- Zero-trust tenant isolation at the database layer
-- ============================================================

-- ============================================================
-- SECURITY CONFIG FUNCTIONS
-- ============================================================

-- Set current user context (called by application at start of each request)
CREATE OR REPLACE FUNCTION set_current_user_context(
    p_user_id       UUID,
    p_org_id        UUID,
    p_user_type     TEXT,
    p_is_super_admin BOOLEAN DEFAULT FALSE
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('app.current_user_id',    p_user_id::TEXT,         TRUE);
    PERFORM set_config('app.current_org_id',     COALESCE(p_org_id::TEXT, ''), TRUE);
    PERFORM set_config('app.current_user_type',  p_user_type,              TRUE);
    PERFORM set_config('app.is_super_admin',     p_is_super_admin::TEXT,   TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION current_user_id()   RETURNS UUID    LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.current_user_id',   TRUE), '')::UUID $$;
CREATE OR REPLACE FUNCTION current_org_id()    RETURNS UUID    LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.current_org_id',    TRUE), '')::UUID $$;
CREATE OR REPLACE FUNCTION current_user_type() RETURNS TEXT    LANGUAGE sql STABLE AS $$ SELECT current_setting('app.current_user_type', TRUE) $$;
CREATE OR REPLACE FUNCTION is_super_admin()    RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT current_setting('app.is_super_admin', TRUE)::BOOLEAN $$;

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_identities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices                ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORGANIZATION POLICIES
-- ============================================================

-- Super admin sees all. Others see their own org.
CREATE POLICY org_isolation ON organizations
    USING (is_super_admin() OR id = current_org_id());

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Super admin sees all. Org admins see members. Users see themselves.
CREATE POLICY users_read ON users FOR SELECT
    USING (
        is_super_admin()
        OR id = current_user_id()
        OR (
            organization_id = current_org_id()
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = current_user_id()
                  AND ur.is_active = TRUE
                  AND r.slug IN ('org_owner', 'org_admin', 'internal_admin')
            )
        )
    );

CREATE POLICY users_write ON users FOR ALL
    USING (is_super_admin() OR id = current_user_id());

-- ============================================================
-- ORG MEMBERS POLICIES
-- ============================================================

CREATE POLICY org_members_isolation ON organization_members
    USING (
        is_super_admin()
        OR organization_id = current_org_id()
    );

-- ============================================================
-- SESSION POLICIES
-- ============================================================

-- Users can only see their own sessions. Super admins see all.
CREATE POLICY sessions_isolation ON sessions
    USING (is_super_admin() OR user_id = current_user_id());

CREATE POLICY rt_isolation ON refresh_tokens
    USING (is_super_admin() OR user_id = current_user_id());

CREATE POLICY vt_isolation ON verification_tokens
    USING (is_super_admin() OR user_id = current_user_id());

-- ============================================================
-- API KEY POLICIES
-- ============================================================

CREATE POLICY apikey_isolation ON api_keys
    USING (
        is_super_admin()
        OR user_id = current_user_id()
        OR (organization_id = current_org_id()
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = current_user_id()
                  AND ur.is_active = TRUE
                  AND r.slug IN ('org_owner', 'org_admin')
            ))
    );

-- ============================================================
-- ROLE POLICIES
-- ============================================================

CREATE POLICY roles_isolation ON user_roles FOR SELECT
    USING (
        is_super_admin()
        OR user_id = current_user_id()
        OR organization_id = current_org_id()
    );

-- ============================================================
-- SSO IDENTITY POLICIES
-- ============================================================

CREATE POLICY sso_isolation ON sso_identities
    USING (is_super_admin() OR user_id = current_user_id());

-- ============================================================
-- AUDIT LOG POLICIES (read-only for orgs, full for admins)
-- ============================================================

CREATE POLICY audit_read ON audit_logs FOR SELECT
    USING (
        is_super_admin()
        OR current_user_type() IN ('super_admin', 'internal_admin')
        OR organization_id = current_org_id()
    );

-- Audit is INSERT-only for everyone else
CREATE POLICY audit_insert ON audit_logs FOR INSERT
    WITH CHECK (TRUE);

-- No UPDATE or DELETE on audit logs (enforced by omitting policies)

-- ============================================================
-- SECURITY EVENTS POLICIES
-- ============================================================

CREATE POLICY secevt_isolation ON security_events FOR SELECT
    USING (
        is_super_admin()
        OR current_user_type() IN ('super_admin', 'internal_admin')
        OR (organization_id = current_org_id()
            AND EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = current_user_id()
                  AND ur.is_active = TRUE
                  AND r.slug IN ('org_owner', 'org_admin')
            ))
    );

-- ============================================================
-- DATA REQUEST POLICIES
-- ============================================================

CREATE POLICY dr_isolation ON data_requests
    USING (
        is_super_admin()
        OR user_id = current_user_id()
    );

-- ============================================================
-- DEVICE POLICIES
-- ============================================================

CREATE POLICY devices_isolation ON devices
    USING (is_super_admin() OR user_id = current_user_id());
