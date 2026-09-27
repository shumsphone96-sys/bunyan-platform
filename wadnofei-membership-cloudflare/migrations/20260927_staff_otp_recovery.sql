-- Wad Nofei staff recovery/OTP schema — V79
-- Idempotent additive migration. No member/application data is modified.

CREATE TABLE IF NOT EXISTS club_staff_recovery_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  contact_hash TEXT NOT NULL UNIQUE,
  contact_hint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, kind)
);

CREATE TABLE IF NOT EXISTS club_staff_otp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  channel TEXT NOT NULL,
  contact_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  provider_message_id TEXT,
  reset_hash TEXT,
  reset_expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_recovery_method_user
  ON club_staff_recovery_methods(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_otp_contact_time
  ON club_staff_otp(contact_hash, requested_at);
CREATE INDEX IF NOT EXISTS idx_staff_otp_reset
  ON club_staff_otp(reset_hash, reset_expires_at);
