CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_state (id, data) VALUES (1, '{}');

CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state(updated_at);
