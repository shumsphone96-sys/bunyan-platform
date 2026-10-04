import app from './worker-global-v73.js';

const staffReady = new WeakMap();

const STAFF_SEEDS = [
  { username: 'president', full_name: 'خالد بابكر', role: 'president' },
  { username: 'secretary', full_name: 'شمس الأنبياء أحمد', role: 'secretary' },
  { username: 'finance', full_name: 'هيثم يوسف البشير', role: 'finance_manager' }
];

export default {
  async fetch(req, env, ctx) {
    if (env.DB&&env.RUNTIME_SCHEMA_BOOTSTRAP!=='off') await ensureStaffReady(env.DB);
    return app.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (env.DB) await ensureStaffReady(env.DB);
    if (app.scheduled) return app.scheduled(event, env, ctx);
  }
};

async function ensureStaffReady(db) {
  if (!staffReady.has(db)) {
    staffReady.set(db, ensureStaffSeeds(db).catch(error => {
      staffReady.delete(db);
      throw error;
    }));
  }
  return staffReady.get(db);
}

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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      recovery_contact_hash TEXT,
      recovery_contact_hint TEXT,
      password_changed_at TEXT
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

  const cols = (await db.prepare('PRAGMA table_info(club_staff_users)').all()).results.map(x => x.name);
  for (const required of ['recovery_contact_hash','recovery_contact_hint','password_changed_at']) {
    if (!cols.includes(required)) throw new Error('STAFF_SCHEMA_OUTDATED');
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
