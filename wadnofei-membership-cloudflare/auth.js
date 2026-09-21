// One principal per request, shared by old and new admin handlers.
// No synthetic cookies, database sessions, or password copies are created.
const actors = new WeakMap();
const STAFF = new Set(['president','vice_president','secretary','finance_manager']);
export function readCookie(req, name) {
  const match = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}
export async function getActor(req, db) {
  if (!db) return null;
  if (!actors.has(req)) actors.set(req, resolveActor(req, db));
  return actors.get(req);
}
async function resolveActor(req, db) {
  // A bad staff credential must not silently downgrade to a legacy owner.
  const staffToken = readCookie(req, 'club_sid');
  if (staffToken !== null) {
    if (!staffToken) return null;
    try {
      const row = await db.prepare(`SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions s JOIN club_staff_users u ON u.id=s.user_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now') AND u.is_active=1`).bind(staffToken).first();
      if (!row || !STAFF.has(row.role)) return null;
      return {...row, kind:'staff', staff_role:row.role, role:'owner', must_change:0};
    } catch { return null; }
  }
  const token = readCookie(req, 'sid');
  if (!token) return null;
  try {
    const row = await db.prepare(`SELECT a.* FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now')`).bind(token).first();
    if (row) {
      const role = row.role || 'owner';
      if (!['owner','reviewer','approver'].includes(role)) return null;
      return {id:row.id, username:row.username, role, kind:'legacy', must_change:Number(row.must_change || 0)};
    }
  } catch { /* Older installations used users, not admins. */ }
  try {
    const row = await db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now')`).bind(token).first();
    if (!row || !['admin','owner','reviewer','approver'].includes(row.role)) return null;
    return {id:row.id, username:row.username, role:row.role==='admin'?'owner':row.role, kind:'legacy-users', must_change:Number(row.must_change || 0)};
  } catch { return null; }
}
export async function adminGate(req, env) {
  return await getActor(req, env.DB) ? null : new Response(null, {status:303,headers:{location:'/staff-login'}});
}
export function generalAdmin(actor) {
  return actor.kind === 'staff' ? ['president','secretary'].includes(actor.staff_role) : actor.role === 'owner';
}
export function protectedPath(path, method) {
  return /^\/(?:club-admin|applications|members|payments|reports|audit|governance|sports|culture-social|documents|change-password|club-profile|logout)(?:\/|\.|$)/.test(path)
    || (!['GET','HEAD'].includes(method) && ['/news','activities','/activities','/board'].includes(path));
}
export function authorize(actor, path, method) {
  const write = !['GET','HEAD'].includes(method);
  const role = actor.staff_role;
  const finance = /^\/(?:payments|reports)(?:\/|$)/.test(path)
    || /^\/club-admin\/(?:finance|payments|ledger|reports)(?:\/|\.|$)/.test(path)
    || /^\/club-admin\/members\/\d+\/renew$/.test(path);
  if (finance) return actor.kind === 'staff' && (!write || role === 'finance_manager');
  if (/\.(?:json|csv)$/.test(path) || path.startsWith('/club-admin/access')) return generalAdmin(actor);
  if (path === '/change-password') return actor.kind === 'legacy';
  if (!write) return actor.kind === 'staff' || actor.role === 'owner'
    || /^\/(?:applications|members|governance)(?:\/|$)/.test(path) || path === '/club-admin';
  if (generalAdmin(actor)) return true;
  const stage = path.match(/^\/applications\/\d+\/stage\/(received|review|needs-info|ready|approve|reject)$/);
  if (stage && actor.kind !== 'staff') return actor.role === 'reviewer'
    ? ['received','review','needs-info','ready'].includes(stage[1])
    : actor.role === 'approver' && ['approve','reject'].includes(stage[1]);
  if (/^(?:\/club-admin\/applications\/\d+\/issue-card|\/applications\/\d+\/approve)$/.test(path)) return actor.kind !== 'staff' && actor.role === 'approver';
  return false;
}
