import app from './worker-global-v76.js';
import {normalizeRole} from './role-policy.js';

const ROLE_LABELS={
  president:'المدير/المشرف العام',
  secretary:'السكرتير',
  finance_manager:'أمين المال'
};

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(env.DB && p==='/club-admin/access/passwords'){
      const actor=await sessionUser(req,env.DB);
      if(!actor)return red('/staff-login?next=/club-admin/access/passwords');
      if(normalizeRole(actor.role)!=='owner')return denied();

      if(m==='GET')return passwordsPage(env.DB,u.searchParams.get('ok')||'',u.searchParams.get('error')||'');
      if(m==='POST')return setInitialPassword(req,env.DB,actor);
    }

    const r=await app.fetch(req,env,ctx);
    if(env.DB && m==='GET' && p==='/club-admin/my-workspace' && (r.headers.get('content-type')||'').includes('text/html')){
      const actor=await sessionUser(req,env.DB);
      if(actor && normalizeRole(actor.role)==='owner'){
        let html=await r.text();
        if(!html.includes('/club-admin/access/passwords')){
          const extra='<a class="card" href="/club-admin/access/passwords"><h2>تهيئة حسابات المسؤولين</h2><p>تعيين كلمة المرور الأولية للسكرتير وأمين المال وحساب المدير.</p><b>فتح ←</b></a>';
          html=html.replace('</div><div class="foot">',extra+'</div><div class="foot">');
        }
        const h=new Headers(r.headers);h.delete('content-length');
        return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
      }
    }
    return r;
  },
  async scheduled(e,env,ctx){
    if(app.scheduled)return app.scheduled(e,env,ctx);
  }
};

async function passwordsPage(db,ok,error){
  let rows=[];
  try{
    rows=(await db.prepare(
      "SELECT id,username,full_name,role,password_changed_at FROM club_staff_users WHERE is_active=1 ORDER BY CASE role WHEN 'president' THEN 1 WHEN 'secretary' THEN 2 WHEN 'finance_manager' THEN 3 ELSE 9 END,id"
    ).all()).results||[];
  }catch(_){}

  const cards=rows.map(x=>`
    <section class="card">
      <div class="who">
        <div><h2>${esc(x.full_name||x.username)}</h2><p>${esc(ROLE_LABELS[x.role]||x.role)}</p></div>
        <span class="${x.password_changed_at?'ready':'pending'}">${x.password_changed_at?'جاهز':'غير مهيأ'}</span>
      </div>
      <form method="post">
        <input type="hidden" name="user_id" value="${Number(x.id)}">
        <label>كلمة المرور الأولية<input type="password" name="password" minlength="10" autocomplete="new-password" required></label>
        <label>تأكيد كلمة المرور<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
        <button>حفظ كلمة المرور لهذا الحساب</button>
      </form>
    </section>`).join('');

  return page('تهيئة حسابات المسؤولين',`
    <a class="back" href="/club-admin/my-workspace">مساحة المدير ←</a>
    <section class="hero">
      <span>STAFF ACCOUNT SETUP</span>
      <h1>تهيئة حسابات المسؤولين</h1>
      <p>المدير يضع كلمة مرور أولية لكل حساب مرة واحدة. بعدها كل مسؤول يدخل بحسابه المستقل ويرى مهامه فقط.</p>
    </section>
    ${ok?'<div class="ok">تم حفظ كلمة المرور للحساب بنجاح.</div>':''}
    ${error?'<div class="err">'+esc(errorMessage(error))+'</div>':''}
    <div class="grid">${cards}</div>
    <p class="hint">لا تشارك كلمات المرور في المحادثة. اكتبها هنا مباشرة داخل الموقع.</p>
  `);
}

async function setInitialPassword(req,db,actor){
  if(!sameOrigin(req))return red('/club-admin/access/passwords?error=origin');
  const f=await req.formData();
  const id=Number(f.get('user_id')||0);
  const password=String(f.get('password')||'');
  const confirm=String(f.get('confirm')||'');
  if(!id)return red('/club-admin/access/passwords?error=user');
  if(password.length<10)return red('/club-admin/access/passwords?error=short');
  if(password!==confirm)return red('/club-admin/access/passwords?error=match');

  let target=null;
  try{target=await db.prepare("SELECT id,username,role FROM club_staff_users WHERE id=? AND is_active=1").bind(id).first()}catch(_){}
  if(!target)return red('/club-admin/access/passwords?error=user');

  const hp=await hashPassword(password);
  await db.prepare(
    "UPDATE club_staff_users SET password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(hp.hash,hp.salt,id).run();
  try{await db.prepare("DELETE FROM club_staff_sessions WHERE user_id=?").bind(id).run()}catch(_){}
  try{
    await db.prepare(
      "INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)"
    ).bind(String(actor.username||'owner'),'set_initial_password','staff_user',String(id),String(target.username||'')).run();
  }catch(_){}
  return red('/club-admin/access/passwords?ok=1');
}

async function sessionUser(req,db){
  const c=req.headers.get('cookie')||'';
  const cs=c.match(/(?:^|;\s*)club_sid=([^;]+)/);
  if(cs){
    const t=decodeURIComponent(cs[1]);
    try{
      const s=await db.prepare(
        "SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions x JOIN club_staff_users u ON u.id=x.user_id WHERE x.token=? AND x.expires_at>datetime('now') AND u.is_active=1"
      ).bind(t).first();
      if(s)return s;
    }catch(_){}
  }
  const sm=c.match(/(?:^|;\s*)sid=([^;]+)/);
  if(!sm)return null;
  const t=decodeURIComponent(sm[1]);
  try{
    const a=await db.prepare(
      "SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')"
    ).bind(t).first();
    if(a)return a;
  }catch(_){}
  return null;
}

async function hashPassword(password){
  const saltBytes=crypto.getRandomValues(new Uint8Array(16));
  const salt=toHex(saltBytes);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:150000,hash:'SHA-256'},key,256);
  return {salt,hash:toHex(new Uint8Array(bits))};
}
function toHex(a){return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
function errorMessage(x){
  return x==='short'?'كلمة المرور يجب ألا تقل عن 10 أحرف.':
    x==='match'?'كلمتا المرور غير متطابقتين.':
    x==='user'?'الحساب غير موجود أو غير نشط.':
    'تعذر تنفيذ الطلب. أعد المحاولة.';
}
function red(x){return new Response(null,{status:303,headers:{Location:x,'cache-control':'no-store'}})}
function denied(){return page('غير مصرح','<section class="hero"><h1>غير مصرح</h1><p>تهيئة حسابات المسؤولين متاحة للمدير فقط.</p></section>',403)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function page(title,body,status=200){
  const css=`*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(155deg,#061a43,#0b347a);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(900px,94%);margin:28px auto}.back{color:#fff}.hero,.card,.ok,.err{border:1px solid #d5a92866;border-radius:20px;background:#08265ddd;padding:18px;margin:14px 0}.hero span,.hero h1,.card h2{color:#f5b329}.hero h1{margin:.2em 0}.grid{display:grid;gap:14px}.who{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.who h2,.who p{margin:.15em 0}.who span{padding:6px 10px;border-radius:999px;font-weight:900}.ready{background:#154e35}.pending{background:#75440a}.card form{display:grid;gap:10px;margin-top:14px}.card label{display:grid;gap:6px}.card input{width:100%;padding:13px;border:0;border-radius:12px;font:inherit}.card button{padding:13px;border:0;border-radius:12px;background:#f5b329;color:#061a43;font-weight:900;font:inherit}.ok{border-color:#3ddc84}.err{border-color:#ff7b7b}.hint{opacity:.8}@media(max-width:650px){.who{display:block}.who span{display:inline-block;margin-top:8px}}`;
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · نادي ود نفيع</title><style>${css}</style></head><body><main>${body}</main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-wadnofei-ui':'v77-account-bootstrap'}});
}
