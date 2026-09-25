import app from './worker-global-v73.js';

const STAFF_SEEDS = [
  { username: 'president', full_name: 'خالد بابكر', role: 'president' },
  { username: 'secretary', full_name: 'شمس الأنبياء أحمد', role: 'secretary' },
  { username: 'finance', full_name: 'هيثم يوسف البشير', role: 'finance_manager' }
];

export default {
  async fetch(req, env, ctx) {
    if (env.DB) await ensureStaffSeeds(env.DB);
    return app.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (env.DB) await ensureStaffSeeds(env.DB);
    if (app.scheduled) return app.scheduled(event, env, ctx);
  }
};

async function ensureStaffSeeds(db) {
  const setup = [
    `CREATE TABLE IF NOT EXISTS club_staff_users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS club_staff_sessions(
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON club_staff_sessions(user_id)`
  ];

  for (const sql of setup) {
    try { await db.prepare(sql).run(); } catch (_) {}
  }

  for (const sql of [
    'ALTER TABLE club_staff_users ADD COLUMN recovery_contact_hash TEXT',
    'ALTER TABLE club_staff_users ADD COLUMN recovery_contact_hint TEXT',
    'ALTER TABLE club_staff_users ADD COLUMN password_changed_at TEXT'
  ]) {
    try { await db.prepare(sql).run(); } catch (_) {}
  }

  for (const u of STAFF_SEEDS) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO club_staff_users
          (username, full_name, role, password_hash, password_salt, is_active)
         VALUES (?, ?, ?, '00', '00', 1)`
      ).bind(u.username, u.full_name, u.role).run();
    } catch (_) {}
  }
}
