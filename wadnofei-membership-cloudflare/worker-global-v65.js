import app from './worker-global-v64.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ROLES={president:'الرئيس',vice_president:'نائب الرئيس',secretary:'السكرتير',finance_manager:'المدير المالي'};
const FINANCE_VIEW=new Set(['president','vice_president','secretary','finance_manager']);
const GENERAL_ADMIN=new Set(['president','secretary']);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url), p=u.pathname.replace(/\/$/,'')||'/', m=req.method.toUpperCase();
    // Public/member requests do not use this layer's staff tables or session.
    // Keep the original Request/body and all downstream handlers unchanged.
    if(!p.startsWith('/club-admin')&&p!=='/staff-login'&&p!=='/staff-logout'){
      return app.fetch(req,env,ctx);
    }
    if(env.DB) await ensure(env.DB);

    if(p==='/staff-login'){
      if(m==='GET') return loginPage(u.searchParams.get('next')||'/club-admin');
      if(m==='POST') return doLogin(req,env.DB);
    }
    if(p==='/staff-logout') return doLogout(req,env.DB);

    if(p.startsWith('/club-admin/access')){
      const gate=await accessGate(req,env.DB);
      if(!gate.ok) return gate.response;
      if(p==='/club-admin/access'&&m==='GET') return accessPage(env.DB,gate.user,gate.bootstrap);
      if(p==='/club-admin/access/user'&&m==='POST') return createUser(req,env.DB,gate.user,gate.bootstrap);
      const x=p.match(/^\/club-admin\/access\/user\/(\d+)\/(enable|disable)$/);
      if(x&&m==='POST') return setUserState(req,env.DB,gate.user,Number(x[1]),x[2]==='enable');
    }

    const staff=env.DB?await staffSession(req,env.DB):null;

    if(p.startsWith('/club-admin/finance')||p==='/club-admin/ledger'||p==='/club-admin/reports'||p==='/club-admin/reports.csv'||p==='/club-admin/payments.csv'||p==='/club-admin/finance.csv'||/^\/club-admin\/payments\/\d+\/review$/.test(p)){
      if(!staff) return redirect('/staff-login?next='+encodeURIComponent(u.pathname+u.search));
      if(!FINANCE_VIEW.has(staff.role)) return forbidden('ليس لديك صلاحية مشاهدة المالية.');
      if(m!=='GET'&&m!=='HEAD'&&staff.role!=='finance_manager') return forbidden('التعديل المالي متاح للمدير المالي فقط.');
    }

    if(p==='/club-admin/backup.json'){
      if(!staff) return redirect('/staff-login?next='+encodeURIComponent(p));
      if(!GENERAL_ADMIN.has(staff.role)) return forbidden('النسخ الاحتياطي متاح للرئيس والسكرتير فقط.');
    }

    if((p.startsWith('/club-admin/content')||p.startsWith('/club-admin/public'))&&m==='POST'){
      if(!staff) return redirect('/staff-login?next='+encodeURIComponent('/club-admin'));
      if(!GENERAL_ADMIN.has(staff.role)) return forbidden('تعديل محتوى الموقع متاح للرئيس والسكرتير فقط.');
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&p==='/club-admin'){
      let html=await r.text();
      const who=staff?`${esc(staff.full_name||staff.username)} — ${esc(ROLES[staff.role]||staff.role)}`:'لم يتم الدخول بحساب الصلاحيات';
      const block=`<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928">المستخدمون والصلاحيات</h2><p>${who}</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><a href="/club-admin/access" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#d5a928;color:#061a43">إدارة المستخدمين</a><a href="${staff?'/staff-logout':'/staff-login'}" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">${staff?'خروج حساب الصلاحيات':'دخول حساب الصلاحيات'}</a></div></section>`;
      html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v65-rbac');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_staff_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,full_name TEXT,role TEXT NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_staff_sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON club_staff_sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}

async function staffSession(req,db){
  const token=cookie(req,'club_sid'); if(!token)return null;
  try{return await db.prepare(`SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions s JOIN club_staff_users u ON u.id=s.user_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now') AND u.is_active=1`).bind(token).first()}catch(_){return null}
}
async function legacyAdmin(req,db){
  const token=cookie(req,'sid'); if(!token)return null;
  try{const a=await db.prepare(`SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now')`).bind(token).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND julianday(s.expires_at)>julianday('now')`).bind(token).first()}catch(_){return null}
}
async function accessGate(req,db){
  const staff=await staffSession(req,db);
  if(staff&&GENERAL_ADMIN.has(staff.role)) return {ok:true,user:staff,bootstrap:false};
  const count=Number((await db.prepare(`SELECT COUNT(*) c FROM club_staff_users`).first())?.c||0);
  if(count===0){const a=await legacyAdmin(req,db);if(a)return {ok:true,user:{username:a.username,role:'bootstrap'},bootstrap:true}}
  return {ok:false,response:staff?forbidden('إدارة المستخدمين متاحة للرئيس والسكرتير فقط.'):redirect('/staff-login?next=/club-admin/access')};
}

async function doLogin(req,db){
  const f=await req.formData(),username=String(f.get('username')||'').trim(),password=String(f.get('password')||''),next=safeNext(String(f.get('next')||'/club-admin'));
  const u=await db.prepare(`SELECT * FROM club_staff_users WHERE username=? AND is_active=1`).bind(username).first();
  if(!u||!(await verifyPassword(password,u.password_salt,u.password_hash))) return loginPage(next,'اسم المستخدم أو كلمة المرور غير صحيحة.');
  const token=randomHex(32),expires=new Date(Date.now()+12*60*60*1000).toISOString();
  await db.prepare(`INSERT INTO club_staff_sessions(token,user_id,expires_at) VALUES(?,?,?)`).bind(token,u.id,expires).run();
  await audit(db,u.username,'login','staff_user',u.id,ROLES[u.role]||u.role);
  return new Response(null,{status:303,headers:{Location:next,'Set-Cookie':`club_sid=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`}});
}
async function doLogout(req,db){const t=cookie(req,'club_sid');if(t&&db)try{await db.prepare(`DELETE FROM club_staff_sessions WHERE token=?`).bind(t).run()}catch(_){}return new Response(null,{status:303,headers:{Location:'/staff-login','Set-Cookie':'club_sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}})}

async function createUser(req,db,actor,bootstrap){
  if(!sameOrigin(req))return forbidden('طلب غير صالح.');
  const f=await req.formData(),username=String(f.get('username')||'').trim(),full=String(f.get('full_name')||'').trim(),role=String(f.get('role')||''),password=String(f.get('password')||'');
  if(!/^[A-Za-z0-9._-]{3,40}$/.test(username)||!ROLES[role]||password.length<8)return redirect('/club-admin/access?error=validation');
  const {salt,hash}=await hashPassword(password);
  try{const r=await db.prepare(`INSERT INTO club_staff_users(username,full_name,role,password_hash,password_salt) VALUES(?,?,?,?,?)`).bind(username,full,role,hash,salt).run();await audit(db,actor.username,'create','staff_user',r.meta?.last_row_id,`${username} | ${role}`)}catch(_){return redirect('/club-admin/access?error=duplicate')}
  return redirect('/club-admin/access?ok=1');
}
async function setUserState(req,db,actor,id,enable){
  if(!sameOrigin(req))return forbidden('طلب غير صالح.');
  if(actor.id===id&&!enable)return forbidden('لا يمكنك تعطيل حسابك الحالي.');
  await db.prepare(`UPDATE club_staff_users SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(enable?1:0,id).run();
  if(!enable)try{await db.prepare(`DELETE FROM club_staff_sessions WHERE user_id=?`).bind(id).run()}catch(_){}
  await audit(db,actor.username,enable?'enable':'disable','staff_user',id,'');
  return redirect('/club-admin/access');
}

async function accessPage(db,user,bootstrap){
  const rows=(await db.prepare(`SELECT id,username,full_name,role,is_active,created_at FROM club_staff_users ORDER BY id`).all()).results||[];
  const cards=rows.length?rows.map(x=>`<article><div><b>${esc(x.full_name||x.username)}</b><span>${esc(ROLES[x.role]||x.role)}</span></div><small>${esc(x.username)} · ${x.is_active?'نشط':'موقوف'}</small><form method="post" action="/club-admin/access/user/${x.id}/${x.is_active?'disable':'enable'}"><button class="${x.is_active?'danger':''}">${x.is_active?'إيقاف الحساب':'تفعيل الحساب'}</button></form></article>`).join(''):'<p>لا توجد حسابات بعد. أنشئ أول حساب للرئيس أو السكرتير ثم بقية المستخدمين.</p>';
  const note=bootstrap?'<div class="notice">وضع التأسيس: دخولك الإداري الحالي يسمح بإنشاء أول حسابات الصلاحيات. بعد إنشاء الحسابات استخدم تسجيل دخول الموظفين.</div>':'';
  return page('إدارة المستخدمين والصلاحيات',`${note}<section class="panel"><h2>إضافة مستخدم</h2><form method="post" action="/club-admin/access/user"><input name="full_name" placeholder="الاسم الكامل" required><input name="username" placeholder="اسم المستخدم بالإنجليزية" required><input type="password" name="password" placeholder="كلمة مرور لا تقل عن 8 أحرف" minlength="8" required><select name="role" required><option value="president">الرئيس</option><option value="vice_president">نائب الرئيس</option><option value="secretary">السكرتير</option><option value="finance_manager">المدير المالي</option></select><button>إنشاء الحساب</button></form></section><section class="panel"><h2>الحسابات الحالية</h2>${cards}</section><section class="panel rules"><h2>الصلاحيات المعتمدة</h2><p><b>المدير المالي:</b> الوحيد الذي يضيف أو يعدل أو يعتمد العمليات المالية.</p><p><b>الرئيس ونائبه والسكرتير:</b> مشاهدة المالية والتقارير فقط.</p><p><b>الرئيس والسكرتير:</b> إدارة المحتوى والمستخدمين والإدارة العامة.</p><p>كل عملية حساسة تُسجل في سجل العمليات.</p></section>`);
}
function loginPage(next='/club-admin',error=''){return page('دخول الإدارة',`${error?`<div class="err">${esc(error)}</div>`:''}<section class="login"><h2>حساب الصلاحيات</h2><form method="post" action="/staff-login"><input type="hidden" name="next" value="${escAttr(safeNext(next))}"><input name="username" autocomplete="username" placeholder="اسم المستخدم" required><input type="password" name="password" autocomplete="current-password" placeholder="كلمة المرور" required><button>دخول</button></form><p>كل مسؤول يستخدم حسابه الشخصي. لا توجد كلمة مرور مشتركة.</p></section>`)}

async function hashPassword(password){const saltBytes=crypto.getRandomValues(new Uint8Array(16));const salt=toHex(saltBytes);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:150000,hash:'SHA-256'},key,256);return {salt,hash:toHex(new Uint8Array(bits))}}
async function verifyPassword(password,salt,expected){try{const saltBytes=fromHex(salt);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:150000,hash:'SHA-256'},key,256);return timingSafe(toHex(new Uint8Array(bits)),String(expected||''))}catch(_){return false}}
function timingSafe(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function toHex(a){return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function fromHex(s){if(!/^[0-9a-f]+$/i.test(s)||s.length%2)throw 0;const a=new Uint8Array(s.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(s.slice(i*2,i*2+2),16);return a}
function randomHex(n){return toHex(crypto.getRandomValues(new Uint8Array(n)))}
function cookie(req,name){
  const c=req.headers.get('cookie')||'',m=c.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));
  if(!m)return '';
  // Treat malformed percent-encoding as an absent credential, never a 500.
  try{return decodeURIComponent(m[1])}catch(_){return ''}
}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
function safeNext(x){
  const fallback='/club-admin',base='https://members.shamsphone.net';
  if(typeof x!=='string'||!x.startsWith('/')||x.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(x))return fallback;
  try{
    const target=new URL(x,base);
    return target.origin===base?target.pathname+target.search+target.hash:fallback;
  }catch(_){return fallback}
}
async function audit(db,actor,action,type,id,details=''){try{await db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`).bind(actor,action,type,String(id||''),details).run()}catch(_){}}
function redirect(x){return new Response(null,{status:303,headers:{Location:x}})}
function forbidden(msg){return page('غير مصرح',`<section class="login"><h2>غير مصرح</h2><p>${esc(msg)}</p><a class="btn" href="/club-admin">العودة للإدارة</a></section>`,403)}
function page(title,body,status=200){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(155deg,#061a43,#0b347a);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{padding:15px 5%;display:flex;justify-content:space-between;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(920px,94%);margin:24px auto}.panel,.login,.notice,.err{background:#08265ddd;border:1px solid #d5a92866;border-radius:18px;padding:18px;margin:16px 0}.notice{border-color:#25D366}.err{border-color:#ff7777}form{display:grid;gap:10px}input,select,button{width:100%;padding:12px;border-radius:11px;border:1px solid #ffffff33;font:inherit}button,.btn{background:#d5a928;color:#061a43;font-weight:900;border:0;text-decoration:none;text-align:center;padding:11px;border-radius:11px}.panel article{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid #ffffff20}.panel article div{display:flex;gap:10px;flex-wrap:wrap}.panel article span,.panel article small{opacity:.8}.panel article form{width:150px}.danger{background:#8d1f2e;color:#fff}.rules p{line-height:1.9}.login{max-width:520px;margin:40px auto}@media(max-width:650px){.panel article{grid-template-columns:1fr}.panel article form{width:100%}}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escAttr(v){return esc(v)}
