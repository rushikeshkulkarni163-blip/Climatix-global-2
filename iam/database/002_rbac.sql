-- ============================================================
-- Climactix Global — RBAC Schema v1.0
-- Role-based access control with permission granularity
-- ============================================================

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,                       -- snake_case
    description     TEXT,
    organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system role
    is_system_role  BOOLEAN     NOT NULL DEFAULT FALSE,
    is_default      BOOLEAN     NOT NULL DEFAULT FALSE,                -- auto-assigned on registration
    user_type       user_type,                                          -- if set, only users of this type can hold it
    priority        SMALLINT    NOT NULL DEFAULT 100,                  -- higher = more powerful
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_org    ON roles(organization_id);
CREATE INDEX idx_roles_slug   ON roles(slug);
CREATE INDEX idx_roles_system ON roles(is_system_role);

-- ============================================================
-- PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource        VARCHAR(100) NOT NULL,                              -- company, assessment, report, portfolio...
    action          VARCHAR(100) NOT NULL,                              -- read, write, delete, export, admin...
    slug            VARCHAR(200) NOT NULL UNIQUE,                       -- resource:action
    description     TEXT,
    is_sensitive    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (resource, action)
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_slug     ON permissions(slug);

-- ============================================================
-- ROLE <-> PERMISSION ASSIGNMENTS
-- ============================================================

CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    conditions      JSONB,                                              -- optional attribute-based conditions
    granted_by      UUID REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_rp_role       ON role_permissions(role_id);
CREATE INDEX idx_rp_permission ON role_permissions(permission_id);

-- ============================================================
-- USER <-> ROLE ASSIGNMENTS
-- ============================================================

CREATE TABLE user_roles (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
    granted_by      UUID        REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID        REFERENCES users(id),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, role_id, organization_id)
);

CREATE INDEX idx_ur_user   ON user_roles(user_id);
CREATE INDEX idx_ur_role   ON user_roles(role_id);
CREATE INDEX idx_ur_org    ON user_roles(organization_id);
CREATE INDEX idx_ur_active ON user_roles(user_id, is_active);

-- ============================================================
-- DIRECT USER PERMISSIONS (overrides)
-- ============================================================

CREATE TABLE user_permissions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id   UUID        NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
    is_grant        BOOLEAN     NOT NULL DEFAULT TRUE,                  -- TRUE=grant, FALSE=deny
    granted_by      UUID        REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    UNIQUE (user_id, permission_id, organization_id)
);

CREATE INDEX idx_up_user ON user_permissions(user_id);
CREATE INDEX idx_up_perm ON user_permissions(permission_id);

-- ============================================================
-- SUBSCRIPTION TIERS & FEATURE FLAGS
-- ============================================================

CREATE TABLE subscription_features (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier            subscription_tier NOT NULL,
    feature_key     VARCHAR(100) NOT NULL,
    feature_label   VARCHAR(255) NOT NULL,
    enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
    limit_value     INTEGER,                                            -- NULL = unlimited
    limit_unit      VARCHAR(50),                                        -- users, assessments, reports...
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tier, feature_key)
);

CREATE INDEX idx_sf_tier ON subscription_features(tier);

-- ============================================================
-- SYSTEM ROLE SEED DATA
-- ============================================================

INSERT INTO roles (name, slug, description, is_system_role, priority, user_type) VALUES
    ('Super Admin',        'super_admin',        'Full platform access, system configuration',        TRUE, 1000, 'super_admin'),
    ('Internal Admin',     'internal_admin',     'Climactix internal team — review, approve, manage', TRUE, 900,  NULL),
    ('Investor',           'investor',           'Access investor terminal, portfolio tools',          TRUE, 500,  'investor'),
    ('ESG Analyst',        'esg_analyst',        'Full ESG analytics and report access',               TRUE, 400,  'esg_analyst'),
    ('Enterprise Client',  'enterprise_client',  'Submit assessments, view own scores and reports',    TRUE, 300,  'enterprise_client'),
    ('Auditor',            'auditor',            'Read-only audit access across org scope',            TRUE, 350,  'auditor'),
    ('Government',         'government',         'Government climate intelligence programs',           TRUE, 450,  'government'),
    ('Community',          'community',          'Social feed, public leaderboard, community tools',   TRUE, 100,  'community'),
    ('Public',             'public',             'Unauthenticated access, public pages only',          TRUE, 50,   'public'),
    ('Org Owner',          'org_owner',          'Organization owner — full org-level control',        FALSE, 800, NULL),
    ('Org Admin',          'org_admin',          'Organization administrator',                         FALSE, 700, NULL),
    ('Org Member',         'org_member',         'Standard organization member',                       FALSE, 200, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PERMISSION SEED DATA
-- ============================================================

INSERT INTO permissions (resource, action, slug, description, is_sensitive) VALUES
-- Platform admin
('platform',    'admin',            'platform:admin',           'Full platform administration',           TRUE),
('platform',    'read_all',         'platform:read_all',        'Read all platform data',                 TRUE),
('platform',    'configure',        'platform:configure',       'Change platform settings',               TRUE),

-- Users
('users',       'read',             'users:read',               'Read user profiles',                     FALSE),
('users',       'write',            'users:write',              'Create and update users',                FALSE),
('users',       'delete',           'users:delete',             'Deactivate users',                       TRUE),
('users',       'impersonate',      'users:impersonate',        'Impersonate any user',                   TRUE),
('users',       'manage_roles',     'users:manage_roles',       'Assign and revoke roles',                TRUE),

-- Organizations
('organizations','read',            'organizations:read',       'Read organization data',                 FALSE),
('organizations','write',           'organizations:write',      'Create and update organizations',        FALSE),
('organizations','delete',          'organizations:delete',     'Delete organizations',                   TRUE),
('organizations','manage_members',  'organizations:manage_members', 'Add/remove org members',             FALSE),

-- Assessments
('assessments', 'read',             'assessments:read',         'View assessments',                       FALSE),
('assessments', 'write',            'assessments:write',        'Submit and edit assessments',            FALSE),
('assessments', 'review',           'assessments:review',       'Review and approve assessments',         FALSE),
('assessments', 'delete',           'assessments:delete',       'Delete assessments',                     TRUE),
('assessments', 'export',           'assessments:export',       'Export assessment data',                 FALSE),

-- Climate Intelligence
('intelligence','read',             'intelligence:read',        'Access climate intelligence outputs',    FALSE),
('intelligence','run_simulation',   'intelligence:run_simulation','Run climate risk simulations',         FALSE),
('intelligence','read_scenarios',   'intelligence:read_scenarios','Read NGFS scenario outputs',          FALSE),

-- Reports
('reports',     'read',             'reports:read',             'View generated reports',                 FALSE),
('reports',     'generate',         'reports:generate',         'Generate new reports',                   FALSE),
('reports',     'export',           'reports:export',           'Export reports to PDF/DOCX',             FALSE),
('reports',     'delete',           'reports:delete',           'Delete reports',                         TRUE),

-- Investor Terminal
('investor_terminal','read',        'investor_terminal:read',   'Access investor terminal',               FALSE),
('investor_terminal','portfolio',   'investor_terminal:portfolio','Manage investment portfolios',         FALSE),
('investor_terminal','scenarios',   'investor_terminal:scenarios','Run investor scenario simulations',   FALSE),

-- API Keys
('api_keys',    'read',             'api_keys:read',            'View own API keys',                      FALSE),
('api_keys',    'write',            'api_keys:write',           'Create API keys',                        FALSE),
('api_keys',    'delete',           'api_keys:delete',          'Revoke API keys',                        FALSE),
('api_keys',    'read_all',         'api_keys:read_all',        'Read all API keys (admin)',               TRUE),

-- Audit logs
('audit',       'read',             'audit:read',               'Read audit logs for own org',            FALSE),
('audit',       'read_all',         'audit:read_all',           'Read all audit logs',                    TRUE),

-- Community
('community',   'read',             'community:read',           'Read community posts and discussions',   FALSE),
('community',   'write',            'community:write',          'Post in community',                      FALSE),
('community',   'moderate',         'community:moderate',       'Moderate community content',             FALSE),

-- Subscriptions
('subscriptions','read',            'subscriptions:read',       'View subscription details',              FALSE),
('subscriptions','manage',          'subscriptions:manage',     'Manage subscription plans',              TRUE)
ON CONFLICT (resource, action) DO NOTHING;

-- ============================================================
-- ROLE -> PERMISSION MATRIX
-- ============================================================

-- Helper: assign all permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- internal_admin: everything except impersonate
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'internal_admin'
  AND p.slug NOT IN ('users:impersonate')
ON CONFLICT DO NOTHING;

-- investor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'investor'
  AND p.slug IN (
    'assessments:read', 'intelligence:read', 'intelligence:read_scenarios',
    'intelligence:run_simulation', 'reports:read', 'reports:export',
    'investor_terminal:read', 'investor_terminal:portfolio', 'investor_terminal:scenarios',
    'api_keys:read', 'api_keys:write', 'api_keys:delete',
    'community:read', 'community:write', 'audit:read'
  )
ON CONFLICT DO NOTHING;

-- enterprise_client
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'enterprise_client'
  AND p.slug IN (
    'assessments:read', 'assessments:write', 'assessments:export',
    'intelligence:read', 'reports:read', 'reports:generate', 'reports:export',
    'api_keys:read', 'api_keys:write', 'api_keys:delete',
    'community:read', 'community:write', 'audit:read'
  )
ON CONFLICT DO NOTHING;

-- esg_analyst
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'esg_analyst'
  AND p.slug IN (
    'assessments:read', 'assessments:write', 'assessments:review', 'assessments:export',
    'intelligence:read', 'intelligence:read_scenarios', 'intelligence:run_simulation',
    'reports:read', 'reports:generate', 'reports:export',
    'api_keys:read', 'api_keys:write', 'api_keys:delete',
    'community:read', 'community:write', 'audit:read'
  )
ON CONFLICT DO NOTHING;

-- auditor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'auditor'
  AND p.slug IN (
    'assessments:read', 'assessments:export',
    'intelligence:read', 'reports:read', 'reports:export',
    'audit:read', 'community:read'
  )
ON CONFLICT DO NOTHING;

-- government
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'government'
  AND p.slug IN (
    'assessments:read', 'assessments:export',
    'intelligence:read', 'intelligence:read_scenarios',
    'reports:read', 'reports:generate', 'reports:export',
    'audit:read', 'api_keys:read', 'api_keys:write', 'api_keys:delete'
  )
ON CONFLICT DO NOTHING;

-- community
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'community'
  AND p.slug IN ('community:read', 'community:write')
ON CONFLICT DO NOTHING;

-- org_owner = org_admin + manage_members + subscriptions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'org_owner'
  AND p.slug IN (
    'organizations:read', 'organizations:write', 'organizations:manage_members',
    'users:read', 'users:write', 'users:manage_roles',
    'audit:read', 'subscriptions:read', 'api_keys:read_all'
  )
ON CONFLICT DO NOTHING;

-- org_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'org_admin'
  AND p.slug IN (
    'organizations:read', 'organizations:manage_members',
    'users:read', 'users:write', 'users:manage_roles',
    'audit:read', 'api_keys:read_all'
  )
ON CONFLICT DO NOTHING;

-- org_member (base)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'org_member'
  AND p.slug IN ('organizations:read', 'users:read')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUBSCRIPTION FEATURES SEED
-- ============================================================

INSERT INTO subscription_features (tier, feature_key, feature_label, enabled, limit_value, limit_unit) VALUES
-- free
('free', 'community_access', 'Community Access', TRUE, NULL, NULL),
('free', 'public_reports', 'Public Reports', TRUE, 3, 'reports_per_month'),
('free', 'assessments', 'Assessments', FALSE, 0, NULL),
-- community
('community', 'community_access', 'Community Access', TRUE, NULL, NULL),
('community', 'assessments', 'Assessments', TRUE, 1, 'assessments_per_month'),
('community', 'public_reports', 'Public Reports', TRUE, 10, 'reports_per_month'),
('community', 'api_access', 'API Access', FALSE, 0, NULL),
-- enterprise
('enterprise', 'community_access', 'Community Access', TRUE, NULL, NULL),
('enterprise', 'assessments', 'Assessments', TRUE, NULL, NULL),
('enterprise', 'reports', 'Reports', TRUE, NULL, NULL),
('enterprise', 'api_access', 'API Access', TRUE, 10000, 'requests_per_day'),
('enterprise', 'team_seats', 'Team Seats', TRUE, 25, 'seats'),
('enterprise', 'investor_terminal', 'Investor Terminal', FALSE, 0, NULL),
('enterprise', 'scenario_simulation', 'Scenario Simulation', TRUE, 50, 'simulations_per_month'),
('enterprise', 'sso', 'Enterprise SSO', TRUE, NULL, NULL),
-- institutional
('institutional', 'community_access', 'Community Access', TRUE, NULL, NULL),
('institutional', 'assessments', 'Assessments', TRUE, NULL, NULL),
('institutional', 'reports', 'Reports', TRUE, NULL, NULL),
('institutional', 'api_access', 'API Access', TRUE, NULL, NULL),
('institutional', 'team_seats', 'Team Seats', TRUE, NULL, NULL),
('institutional', 'investor_terminal', 'Investor Terminal', TRUE, NULL, NULL),
('institutional', 'scenario_simulation', 'Scenario Simulation', TRUE, NULL, NULL),
('institutional', 'sso', 'Enterprise SSO', TRUE, NULL, NULL),
('institutional', 'white_label', 'White Label', TRUE, NULL, NULL),
-- government
('government', 'community_access', 'Community Access', TRUE, NULL, NULL),
('government', 'assessments', 'Assessments', TRUE, NULL, NULL),
('government', 'reports', 'Reports', TRUE, NULL, NULL),
('government', 'api_access', 'API Access', TRUE, NULL, NULL),
('government', 'team_seats', 'Team Seats', TRUE, NULL, NULL),
('government', 'scenario_simulation', 'Scenario Simulation', TRUE, NULL, NULL),
-- internal
('internal', 'community_access', 'Community Access', TRUE, NULL, NULL),
('internal', 'assessments', 'Assessments', TRUE, NULL, NULL),
('internal', 'reports', 'Reports', TRUE, NULL, NULL),
('internal', 'api_access', 'API Access', TRUE, NULL, NULL),
('internal', 'team_seats', 'Team Seats', TRUE, NULL, NULL),
('internal', 'investor_terminal', 'Investor Terminal', TRUE, NULL, NULL),
('internal', 'scenario_simulation', 'Scenario Simulation', TRUE, NULL, NULL),
('internal', 'sso', 'Enterprise SSO', TRUE, NULL, NULL),
('internal', 'white_label', 'White Label', TRUE, NULL, NULL),
('internal', 'admin_tools', 'Admin Tools', TRUE, NULL, NULL)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Backfill invite FK
ALTER TABLE invites ADD CONSTRAINT fk_invite_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
