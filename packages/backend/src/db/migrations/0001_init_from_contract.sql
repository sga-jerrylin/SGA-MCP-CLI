-- Initial schema derived from packages/shared/api-contract.yaml

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','user')),
  avatar TEXT,
  tenant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','parsing','generating','testing','fixing','done','failed')),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('markdown','openapi','auto')),
  tool_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generate_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  parser_model TEXT NOT NULL,
  coder_model TEXT NOT NULL,
  fix_rounds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES generate_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('connector','test','config','package')),
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shard_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','stopped','deploying')),
  tool_count INTEGER NOT NULL DEFAULT 0,
  token_usage INTEGER NOT NULL DEFAULT 0,
  token_budget INTEGER NOT NULL DEFAULT 8000,
  endpoint TEXT NOT NULL,
  port INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tool_count INTEGER NOT NULL DEFAULT 0,
  server_count INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  signature TEXT,
  signed BOOLEAN NOT NULL DEFAULT FALSE,
  downloads INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active','revoked','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_generate_runs_project ON generate_runs(project_id);
CREATE INDEX idx_artifacts_run ON artifacts(run_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
