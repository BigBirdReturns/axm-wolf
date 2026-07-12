CREATE TABLE IF NOT EXISTS wolf_surveys (
  code TEXT PRIMARY KEY,
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
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS wolf_surveys_status_idx ON wolf_surveys(status);
CREATE INDEX IF NOT EXISTS wolf_surveys_updated_idx ON wolf_surveys(updated_at);

CREATE TABLE IF NOT EXISTS wolf_analysis_returns (
  id TEXT PRIMARY KEY,
  survey_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (survey_code) REFERENCES wolf_surveys(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wolf_analysis_survey_idx
  ON wolf_analysis_returns(survey_code, created_at DESC);
