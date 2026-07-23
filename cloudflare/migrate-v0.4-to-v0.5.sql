ALTER TABLE wolf_surveys ADD COLUMN analysis_consent INTEGER CHECK (analysis_consent IN (0, 1));
ALTER TABLE wolf_surveys ADD COLUMN analysis_consent_at TEXT;

INSERT OR IGNORE INTO wolf_schema_migrations (version, applied_at) VALUES ('0.5', datetime('now'));
