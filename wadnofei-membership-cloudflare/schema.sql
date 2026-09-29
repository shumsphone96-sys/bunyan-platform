-- New database initialization only. No DROP, replacement data, or default password.
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,password_hash TEXT,must_change INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,admin_id INTEGER,expires_at TEXT);
CREATE TABLE IF NOT EXISTS applications(id INTEGER PRIMARY KEY AUTOINCREMENT,application_no TEXT UNIQUE,full_name TEXT,phone TEXT,birth_date TEXT,address TEXT,occupation TEXT,membership_type TEXT,notes TEXT,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,decided_at TEXT);
CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT,member_no TEXT UNIQUE,full_name TEXT,phone TEXT,birth_date TEXT,address TEXT,occupation TEXT,membership_type TEXT,status TEXT DEFAULT 'active',joined_at TEXT DEFAULT CURRENT_TIMESTAMP,application_id INTEGER);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER,amount REAL,payment_type TEXT,payment_method TEXT,receipt_no TEXT,notes TEXT,paid_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activities(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT,event_date TEXT,status TEXT DEFAULT 'مخطط',details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,doc_type TEXT,reference_no TEXT,doc_date TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_members_no ON members(member_no);
CREATE INDEX IF NOT EXISTS idx_pay_member ON payments(member_id);
-- Public club content used by V78 public pages.
-- These tables were historically created lazily by legacy worker layers.
-- Keep them in the canonical schema so a fresh environment does not depend on
-- visiting an unrelated legacy route before public content can be read.
CREATE TABLE IF NOT EXISTS club_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT DEFAULT 'عام',
  is_published INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  number TEXT,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_board (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  achievement_date TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT DEFAULT 'قيد التنفيذ',
  target TEXT,
  progress INTEGER DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT,
  location TEXT,
  details TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'داعم',
  url TEXT,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_news_published ON club_news(is_published, id);
CREATE INDEX IF NOT EXISTS idx_club_projects_published ON club_projects(is_published, id);
CREATE INDEX IF NOT EXISTS idx_club_events_published ON club_events(is_published, event_date, id);
CREATE INDEX IF NOT EXISTS idx_club_team_sort ON club_team(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_club_board_sort ON club_board(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_club_sponsors_sort ON club_sponsors(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_club_gallery_sort ON club_gallery(sort_order, id);


-- Staff recovery methods and one-time codes (V79).
-- Contacts are stored as SHA-256 fingerprints plus masked hints; OTP values are
-- stored only as PBKDF2 hashes and expire after use.
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
