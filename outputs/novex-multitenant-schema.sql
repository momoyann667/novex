-- NOVEX multi-tenant foundation schema.
-- Target: PostgreSQL-style SQL. Adapt names/types to the real ORM once the app exists.

create table users (
  id uuid primary key,
  email text unique,
  phone text unique,
  password_hash text,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  first_name text,
  last_name text,
  avatar_url text,
  locale text not null default 'fr-CI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  organization_type text not null,
  logo_url text,
  currency text not null default 'XOF',
  country text not null default 'CI',
  city text,
  description text,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  owner_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  code text not null,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table permissions (
  id uuid primary key,
  code text not null unique,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table workspace_members (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role_id uuid not null references roles(id),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'removed')),
  joined_at timestamptz,
  invited_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table organization_profiles (
  id uuid primary key,
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  legal_name text,
  registration_number text,
  address text,
  contact_email text,
  contact_phone text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plans (
  id uuid primary key,
  code text not null unique check (code in ('FREEMIUM', 'NOVEX_START', 'NOVEX_PRO')),
  name text not null,
  description text,
  limits jsonb not null default '{}'::jsonb,
  entitlements jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key,
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null check (status in ('trial', 'active', 'past_due', 'expired', 'suspended', 'cancelled')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_invitations (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invited_by_user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  email text,
  phone text,
  token_hash text not null unique,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table novex_admin_members (
  id uuid primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  role text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE', 'ANALYST')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key,
  workspace_id uuid references workspaces(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  resource text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Example tenant-scoped business tables for future modules.
-- These are intentionally minimal placeholders to enforce the isolation pattern.

create table association_members (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  linked_user_id uuid references users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workspace_members_user on workspace_members(user_id);
create index idx_workspace_members_workspace on workspace_members(workspace_id);
create index idx_workspace_members_active on workspace_members(workspace_id, user_id, status);
create index idx_invitations_token_hash on workspace_invitations(token_hash);
create index idx_audit_logs_workspace_created on audit_logs(workspace_id, created_at desc);
create index idx_association_members_workspace on association_members(workspace_id);

-- Required database invariant to protect the last owner should be implemented
-- as a transaction-level check or trigger in the real database layer:
-- never allow deleting/removing/suspending the last active OWNER of a workspace.
