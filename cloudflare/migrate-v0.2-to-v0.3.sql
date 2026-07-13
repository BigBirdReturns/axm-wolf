PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wolf_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wolf_memberships (
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, email)
);

ALTER TABLE wolf_surveys ADD COLUMN workspace_id TEXT;
UPDATE wolf_surveys SET workspace_id = 'root' WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS wolf_memberships_email_idx ON wolf_memberships(email, status);
CREATE INDEX IF NOT EXISTS wolf_surveys_workspace_idx ON wolf_surveys(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS wolf_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT OR IGNORE INTO wolf_counters (name, value)
SELECT 'survey', COALESCE(MAX(CAST(SUBSTR(code, 4) AS INTEGER)), 0) FROM wolf_surveys;
