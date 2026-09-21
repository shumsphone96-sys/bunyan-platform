// Isolated v65 regression tests, not a Cloudflare/D1 or membership E2E test.
// Run: node --experimental-vm-modules --test tests/rbac-stability.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { webcrypto, pbkdf2Sync } from 'node:crypto';

const ORIGIN = 'https://members.shamsphone.net';
const NOW = '2026-09-21 12:00:00';
const VALID = '2026-09-21T13:00:00.000Z';
const source = await readFile(process.env.WDN_WORKER_PATH || new URL('../worker-global-v65.js', import.meta.url), 'utf8');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

function fixture(t, { role = 'president', expires = VALID, active = 1, staff = true, legacy = null, legacyExpires = VALID } = {}) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec(`
    CREATE TABLE club_staff_users(id INTEGER PRIMARY KEY,username TEXT,full_name TEXT,role TEXT,password_hash TEXT,password_salt TEXT,is_active INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
    CREATE TABLE club_staff_sessions(token TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE admins(id INTEGER PRIMARY KEY,username TEXT);
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT);
    CREATE TABLE sessions(token TEXT,admin_id INTEGER,user_id INTEGER,expires_at TEXT);
  `);
  if (staff) {
    sql.prepare('INSERT INTO club_staff_users VALUES(1,?,?,?,?,?,?,CURRENT_TIMESTAMP,NULL)').run('fixture-admin', 'Test Admin', role, 'unused', 'unused', active);
    sql.prepare('INSERT INTO club_staff_sessions(token,user_id,expires_at) VALUES(?,?,?)').run('test-staff-token', 1, expires);
  }
  if (legacy) {
    assert.ok(['admins', 'users'].includes(legacy));
    sql.prepare(`INSERT INTO ${legacy}(id,username) VALUES(1,?)`).run('fixture-legacy');
    sql.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('test-legacy-token', legacy === 'admins' ? 1 : null, legacy === 'users' ? 1 : null, legacyExpires);
  }
  const calls = [];
  const db = {
    prepare(query) {
      calls.push(query);
      // Freeze only the query clock. Keep SQLite's actual date parsing/comparison.
      const prepared = sql.prepare(query.replaceAll("datetime('now')", `datetime('${NOW}')`).replaceAll("julianday('now')", `julianday('${NOW}')`));
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return prepared.get(...args) || null; },
        async all() { return { results: prepared.all(...args) }; },
        async run() { const r = prepared.run(...args); return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
      };
    },
  };
  return { db, sql, calls };
}

async function load(downstream = {}) {
  const seen = [];
  const app = {
    async fetch(req, env, ctx) {
      seen.push({ req, env, ctx });
      return new Response('downstream', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async scheduled(...args) { seen.push({ scheduled: args }); return 'scheduled'; },
    ...downstream,
  };
  const dependency = new SyntheticModule(['default'], function () { this.setExport('default', app); });
  const mod = new SourceTextModule(source, { identifier: 'v65-under-test' });
  await mod.link(specifier => {
    assert.equal(specifier, './worker-global-v64.js');
    return dependency;
  });
  await mod.evaluate();
  return { worker: mod.namespace.default, seen };
}

function request(path, { cookie = '', method = 'GET', body } = {}) {
  const headers = cookie ? { cookie } : {};
  if (method === 'POST') headers.origin = ORIGIN;
  return new Request(ORIGIN + path, { method, headers, body });
}

for (const [name, expiry, allowed] of [
  ['expired earlier today ISO', '2026-09-21T08:00:00.000Z', false],
  ['valid later today ISO', VALID, true],
  ['expired yesterday', '2026-09-20T23:59:59.000Z', false],
  ['valid tomorrow', '2026-09-22T01:00:00.000Z', true],
  ['exact expiry instant', '2026-09-21T12:00:00.000Z', false],
  ['valid SQLite timestamp', '2026-09-21 13:00:00', true],
  ['expired SQLite timestamp', '2026-09-21 11:00:00', false],
  ['timezone-offset expired', '2026-09-21T13:00:00+02:00', false],
  ['timezone-offset valid', '2026-09-21T15:00:00+02:00', true],
  ['invalid timestamp fails closed', 'not-a-timestamp', false],
  ['null timestamp fails closed', null, false],
]) {
  test(`staff session: ${name}`, async t => {
    const { db } = fixture(t, { expires: expiry });
    const { worker, seen } = await load();
    const res = await worker.fetch(request('/club-admin/finance', { cookie: 'club_sid=test-staff-token' }), { DB: db }, {});
    assert.equal(res.status, allowed ? 200 : 303);
    assert.equal(seen.length, allowed ? 1 : 0);
  });
}

for (const table of ['admins', 'users']) {
  for (const [expiry, allowed] of [['2026-09-21T08:00:00.000Z', false], [VALID, true]]) {
    test(`legacy ${table} bootstrap: ${allowed ? 'valid' : 'expired same day'}`, async t => {
      const { db } = fixture(t, { staff: false, legacy: table, legacyExpires: expiry });
      const { worker } = await load();
      const res = await worker.fetch(request('/club-admin/access', { cookie: 'sid=test-legacy-token' }), { DB: db }, {});
      assert.equal(res.status, allowed ? 200 : 303);
    });
  }
}

for (const value of ['%', '%E0%A4%A', '%FF', '%C0%AF']) {
  test(`malformed staff cookie fails closed: ${value}`, async t => {
    const { db } = fixture(t);
    const { worker, seen } = await load();
    const res = await worker.fetch(request('/club-admin/finance', { cookie: `club_sid=${value}` }), { DB: db }, {});
    assert.equal(res.status, 303);
    assert.equal(seen.length, 0);
  });
}
test('malformed legacy cookie fails closed', async t => {
  const { db } = fixture(t, { staff: false });
  const { worker } = await load();
  const res = await worker.fetch(request('/club-admin/access', { cookie: 'sid=%' }), { DB: db }, {});
  assert.equal(res.status, 303);
});

for (const path of ['/', '/membership', '/membership/', '/about', '/assets/logo.png']) {
  test(`public route does not initialize staff tables: ${path}`, async t => {
    const { db, calls } = fixture(t);
    const { worker, seen } = await load();
    const req = request(path, { cookie: 'club_sid=%' }), env = { DB: db }, ctx = {};
    const res = await worker.fetch(req, env, ctx);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 0, 'no v65 schema or session queries on public paths');
    assert.equal(seen[0].req, req);
    assert.equal(seen[0].env, env);
    assert.equal(seen[0].ctx, ctx);
  });
}
test('membership POST body remains untouched for downstream handler', async t => {
  const { db, calls } = fixture(t);
  const { worker } = await load({ fetch: async req => new Response(await req.text(), { status: 202 }) });
  const res = await worker.fetch(request('/membership', { method: 'POST', body: 'fixture=test-only' }), { DB: db }, {});
  assert.equal(res.status, 202);
  assert.equal(await res.text(), 'fixture=test-only');
  assert.equal(calls.length, 0);
});

for (const next of ['//example.invalid', '/\\example.invalid', '/\n/example.invalid', '/\texample.invalid', 'https://example.invalid', 'javascript:alert(1)']) {
  test(`unsafe next target is rejected: ${JSON.stringify(next)}`, async t => {
    const { db } = fixture(t);
    const { worker } = await load();
    const res = await worker.fetch(request('/staff-login?next=' + encodeURIComponent(next)), { DB: db }, {});
    assert.match(await res.text(), /name="next" value="\/club-admin"/);
  });
}
test('valid internal next target survives', async t => {
  const { db } = fixture(t);
  const { worker } = await load();
  const res = await worker.fetch(request('/staff-login?next=' + encodeURIComponent('/club-admin/reports?month=9#top')), { DB: db }, {});
  assert.match(await res.text(), /name="next" value="\/club-admin\/reports\?month=9#top"/);
});

for (const [role, method, expected] of [
  ['president', 'GET', 200], ['president', 'POST', 403],
  ['secretary', 'GET', 200], ['secretary', 'POST', 403],
  ['vice_president', 'GET', 200], ['vice_president', 'POST', 403],
  ['finance_manager', 'GET', 200], ['finance_manager', 'POST', 200],
]) {
  test(`finance authorization unchanged: ${role} ${method}`, async t => {
    const { db } = fixture(t, { role });
    const { worker } = await load();
    const res = await worker.fetch(request('/club-admin/finance', { method, cookie: 'club_sid=test-staff-token' }), { DB: db }, {});
    assert.equal(res.status, expected);
  });
}
test('disabled staff remains denied', async t => {
  const { db } = fixture(t, { active: 0 });
  const { worker } = await load();
  const res = await worker.fetch(request('/club-admin/finance', { cookie: 'club_sid=test-staff-token' }), { DB: db }, {});
  assert.equal(res.status, 303);
});
for (const [role, expected] of [['president', 200], ['secretary', 200], ['vice_president', 403], ['finance_manager', 403]]) {
  test(`backup authorization unchanged: ${role}`, async t => {
    const { db } = fixture(t, { role });
    const { worker } = await load();
    const res = await worker.fetch(request('/club-admin/backup.json', { cookie: 'club_sid=test-staff-token' }), { DB: db }, {});
    assert.equal(res.status, expected);
  });
}

test('existing PBKDF2-150000 password still logs in locally without rehashing', async t => {
  const { db, sql } = fixture(t);
  const salt = '00112233445566778899aabbccddeeff';
  const hash = pbkdf2Sync('fixture-password-only', Buffer.from(salt, 'hex'), 150000, 32, 'sha256').toString('hex');
  sql.prepare('UPDATE club_staff_users SET password_hash=?,password_salt=? WHERE id=1').run(hash, salt);
  const { worker } = await load();
  const body = new URLSearchParams({ username: 'fixture-admin', password: 'fixture-password-only', next: '/club-admin' });
  const res = await worker.fetch(request('/staff-login', { method: 'POST', body }), { DB: db }, {});
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/club-admin');
  assert.match(res.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(sql.prepare('SELECT password_hash FROM club_staff_users WHERE id=1').get().password_hash, hash);
});

test('scheduled notification handler is delegated unchanged', async () => {
  const { worker, seen } = await load();
  const e = {}, env = {}, ctx = {};
  assert.equal(await worker.scheduled(e, env, ctx), 'scheduled');
  assert.deepEqual(seen[0].scheduled, [e, env, ctx]);
});
