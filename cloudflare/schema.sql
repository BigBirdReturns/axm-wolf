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
  PRIMARY KEY (workspace_id, email),
  FOREIGN KEY (workspace_id) REFERENCES wolf_workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_memberships_email_idx ON wolf_memberships(email, status);

CREATE TABLE IF NOT EXISTS wolf_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT OR IGNORE INTO wolf_counters (name, value) VALUES ('survey', 0);

CREATE TABLE IF NOT EXISTS wolf_surveys (
  code TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  recipient_label TEXT NOT NULL,
  survey_label TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  record_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  submitted_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES wolf_workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_surveys_workspace_idx ON wolf_surveys(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS wolf_surveys_status_idx ON wolf_surveys(status);

CREATE TABLE IF NOT EXISTS wolf_analysis_returns (
  id TEXT PRIMARY KEY,
  survey_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (survey_code) REFERENCES wolf_surveys(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_analysis_survey_idx ON wolf_analysis_returns(survey_code, created_at DESC);
