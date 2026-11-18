-- Existing production database (USERS_D1)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  phone TEXT,
  auth_provider TEXT DEFAULT 'custom',
  status TEXT DEFAULT 'p',
  database_target TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  name TEXT,
  google_id TEXT,
  picture TEXT,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  app_redirect TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_codes (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Long-lived tokens for accounts waiting for admin approval. The app stores
-- the token locally and polls /api/pending instead of re-authenticating on
-- every launch.
CREATE TABLE IF NOT EXISTS pending_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);
CREATE INDEX IF NOT EXISTS login_codes_expires_idx ON login_codes (expires_at);
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states (expires_at);
CREATE INDEX IF NOT EXISTS pending_tokens_expires_idx ON pending_tokens (expires_at);
CREATE INDEX IF NOT EXISTS pending_tokens_user_idx ON pending_tokens (user_id);
