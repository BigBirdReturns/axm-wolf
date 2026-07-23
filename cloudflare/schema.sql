PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wolf_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

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
  analysis_consent INTEGER CHECK (analysis_consent IN (0, 1)),
  analysis_consent_at TEXT,
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

CREATE TABLE IF NOT EXISTS wolf_knowledge_drops (
  drop_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  workspace_id TEXT NOT NULL,
  survey_code TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_prompt_id TEXT NOT NULL,
  source_revision_id TEXT NOT NULL,
  source_revision_digest TEXT NOT NULL,
  offset_encoding TEXT NOT NULL CHECK (offset_encoding = 'utf16-code-unit'),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  exact_quote TEXT NOT NULL,
  quote_digest TEXT NOT NULL,
  kind TEXT NOT NULL,
  current_text TEXT NOT NULL,
  operational_pattern TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'confirmed', 'corrected', 'rejected')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  extraction_method TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES wolf_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (survey_code) REFERENCES wolf_surveys(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_knowledge_workspace_idx ON wolf_knowledge_drops(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS wolf_knowledge_survey_idx ON wolf_knowledge_drops(survey_code, updated_at DESC);
CREATE INDEX IF NOT EXISTS wolf_knowledge_review_idx ON wolf_knowledge_drops(workspace_id, review_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS wolf_knowledge_drop_events (
  event_id TEXT PRIMARY KEY,
  drop_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  expected_prior_version INTEGER NOT NULL CHECK (expected_prior_version >= 1),
  request_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('confirm', 'correct', 'reject', 'keep_private')),
  actor_email TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  prior_event_digest TEXT,
  event_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (drop_id, sequence),
  FOREIGN KEY (drop_id) REFERENCES wolf_knowledge_drops(drop_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_knowledge_events_drop_idx ON wolf_knowledge_drop_events(drop_id, sequence);

INSERT OR IGNORE INTO wolf_schema_migrations (version, applied_at) VALUES ('0.5', datetime('now'));
