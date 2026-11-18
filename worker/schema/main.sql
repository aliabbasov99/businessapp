-- Main application data (MAIN_D1). The app reads one JSON snapshot per
-- database_target, matching the DatabaseSnapshot shape used by the mobile app.
CREATE TABLE IF NOT EXISTS app_snapshots (
  database_target TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
