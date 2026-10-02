import { normalizeRole, classifyAdminPath, isAllowed } from './role-policy.js';

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
  return actor.kind === 'staff' ? normalizeRole(actor.staff_role) === 'owner' : actor.role === 'owner';
}
export function protectedPath(path, method) {
  return /^\/(?:club-admin|applications|members|payments|reports|audit|governance|sports|culture-social|documents|change-password|club-profile|logout)(?:\/|\.|$)/.test(path)
    || (!['GET','HEAD'].includes(method) && ['/news','activities','/activities','/board'].includes(path));
}
function staffAuthorized(actor, path, method) {
  const role = normalizeRole(actor.staff_role);
  if (role === 'owner') return true;
  if (path === '/logout') return true;
  if (path.startsWith('/club-admin')) return isAllowed(actor.staff_role, classifyAdminPath(path), method);
  if (/^\/(?:applications|members|governance|sports|culture-social|documents)(?:\/|$)/.test(path)) return role === 'secretary';
  if (/^\/(?:payments|reports)(?:\/|$)/.test(path)) return role === 'finance';
  if (!['GET','HEAD'].includes(method) && ['/news','/activities','/board'].includes(path)) return role === 'secretary';
  return false;
}
export function authorize(actor, path, method) {
  if (actor.kind === 'staff') return staffAuthorized(actor, path, method);
  const write = !['GET','HEAD'].includes(method);
  if (actor.role === 'owner') return true;
  if (path === '/change-password') return actor.kind === 'legacy';
  if (!write) return /^\/(?:applications|members|governance)(?:\/|$)/.test(path) || path === '/club-admin';
  const stage = path.match(/^\/applications\/\d+\/stage\/(received|review|needs-info|ready|approve|reject)$/);
  if (stage) return actor.role === 'reviewer'
    ? ['received','review','needs-info','ready'].includes(stage[1])
    : actor.role === 'approver' && ['approve','reject'].includes(stage[1]);
  if (/^(?:\/club-admin\/applications\/\d+\/issue-card|\/applications\/\d+\/approve)$/.test(path)) return actor.role === 'approver';
  return false;
}
