import app from './worker-global-v73.js';

const STAFF_SEEDS = [
  { username: 'president', full_name: 'خالد بابكر', role: 'president' },
  { username: 'secretary', full_name: 'شمس الأنبياء أحمد', role: 'secretary' },
  { username: 'finance', full_name: 'هيثم يوسف البشير', role: 'finance_manager' }
];

const BOOTSTRAP_TOKEN_HASH = '0f61790e1501af0c62bbfffcecf98c1b4298713d0424d4bfa4ec97b1499d0afe';
const BOOTSTRAP_PATH = '/_internal/v74-recovery-bootstrap';

export default {
  async fetch(req, env, ctx) {
    if (env.DB) await ensureStaffSeeds(env.DB);
    const url = new URL(req.url);
    if (url.pathname === BOOTSTRAP_PATH) return recoveryBootstrap(req, env.DB);
    return app.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (env.DB) await ensureStaffSeeds(env.DB);
    if (app.scheduled) return app.scheduled(event, env, ctx);
  }
};

async function recoveryBootstrap(req, db) {
  if (!db || req.method !== 'POST') return new Response('Not found', { status: 404 });
  const supplied = String(req.headers.get('x-bootstrap-token') || '');
  if ((await sha256(supplied)) !== BOOTSTRAP_TOKEN_HASH) return new Response('Not found', { status: 404 });

  let body;
  try { body = await req.json(); } catch (_) { return json({ ok: false, error: 'invalid_json' }, 400); }

  const contacts = body && body.contacts ? body.contacts : {};
  const allowed = new Set(STAFF_SEEDS.map(x => x.username));
  const entries = Object.entries(contacts);
  if (entries.length !== STAFF_SEEDS.length || entries.some(([u]) => !allowed.has(u))) {
    return json({ ok: false, error: 'invalid_accounts' }, 400);
  }

  for (const seed of STAFF_SEEDS) {
    const phone = normalizePhone(contacts[seed.username]);
    if (!/^0[0-9]{9}$/.test(phone)) return json({ ok: false, error: 'invalid_phone', username: seed.username }, 400);
    const hash = await sha256(phone);
    const hint = '•••• ' + phone.slice(-4);
    await db.prepare(
      `UPDATE club_staff_users
       SET recovery_contact_hash=?, recovery_contact_hint=?, updated_at=CURRENT_TIMESTAMP
       WHERE username=?`
    ).bind(hash, hint, seed.username).run();
  }

  try {
    await db.prepare(
      "INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES('bootstrap-v74','bind_recovery_contacts','staff_users','3','phone fingerprints only')"
    ).run();
  } catch (_) {}

  return json({ ok: true, updated: STAFF_SEEDS.length });
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

function normalizePhone(v) {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return String(v || '').replace(/[٠-٩]/g, c => String(ar.indexOf(c))).replace(/\D/g, '');
}

async function sha256(x) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(x || '')));
  return [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function json(v, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
