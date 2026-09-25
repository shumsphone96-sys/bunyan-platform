import app from './worker-global-v71.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ROLES={president:'الرئيس',vice_president:'نائب الرئيس',secretary:'السكرتير',finance_manager:'أمين المال',owner:'مدير النظام'};
const SECURITY=new Set(['president','secretary','owner']);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(p==='/staff-security'&&env.DB){
      const s=await staff(req,env.DB);
      if(!s)return red('/staff-login?next=/staff-security');
      if(m==='GET')return securityProfile(s,'');
      if(m==='POST')return updateSecurity(req,env.DB,s);
    }

    if(p==='/staff-recover'&&m==='GET')return recoverPage('');
    if(p==='/staff-recover'&&m==='POST'&&env.DB)return recoveryRequest(req,env.DB);

    if(p==='/club-admin/security-center'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/staff-login?next=/club-admin/security-center');
      if(!SECURITY.has(a.role))return deny('مركز الأمان متاح للرئيس والسكرتير ومدير النظام فقط.');
      return securityCenter(env.DB,a);
    }

    const x=p.match(/^\/club-admin\/security-center\/recovery\/(\d+)\/reset$/);
    if(x&&m==='POST'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/staff-login?next=/club-admin/security-center');
      if(!SECURITY.has(a.role))return deny('غير مصرح.');
      return resetAccount(req,env.DB,a,Number(x[1]));
    }

    const r=await app.fetch(req,env,ctx),ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(['/staff-login','/login'].includes(p)&&!html.includes('/staff-recover')){
        html=html.replace('</form>','</form><p style="text-align:center;margin-top:12px"><a href="/staff-recover">نسيت اسم المستخدم أو كلمة المرور؟</a></p>');
      }
      if(['/club-admin','/club-admin/overview','/club-admin/operations'].includes(p)){
        const a=env.DB?await actor(req,env.DB):null;
        if(a&&!html.includes('/club-admin/security-center')){
          const box='<section style="margin:18px 0;padding:17px;border:1px solid #d5a92866;border-radius:20px;background:linear-gradient(135deg,#0a2d63,#081e49);color:#fff"><h2 style="color:#f5b329;margin-top:0">الأمان والاستعادة</h2><p>حساب مستقل لكل مسؤول، تغيير كلمة المرور، وسيلة استعادة، وطلبات موثقة.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><a href="/staff-security" style="padding:12px;border-radius:12px;background:#f5b329;color:#061a43;text-decoration:none;font-weight:900;text-align:center">أمان حسابي</a><a href="/club-admin/security-center" style="padding:12px;border-radius:12px;background:#fff;color:#061a43;text-decoration:none;font-weight:900;text-align:center">مركز الأمان</a></div></section>';
          html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
        }
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v72-secure-recovery');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  for(const q of [
    "CREATE TABLE IF NOT EXISTS club_staff_recovery_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,completed_at TEXT,completed_by TEXT)",
    "CREATE INDEX IF NOT EXISTS idx_staff_recovery_v72 ON club_staff_recovery_requests(status,expires_at)"
  ]){try{await db.prepare(q).run()}catch(_){}}
  for(const q of [
    "ALTER TABLE club_staff_users ADD COLUMN recovery_contact_hash TEXT",
    "ALTER TABLE club_staff_users ADD COLUMN recovery_contact_hint TEXT",
    "ALTER TABLE club_staff_users ADD COLUMN password_changed_at TEXT"
  ]){try{await db.prepare(q).run()}catch(_){}}
}

async function staff(req,db){
  const t=cookie(req,'club_sid');if(!t)return null;
  try{return await db.prepare("SELECT u.id,u.username,u.full_name,u.role,u.recovery_contact_hint FROM club_staff_sessions s JOIN club_staff_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now') AND u.is_active=1").bind(t).first()}catch(_){return null}
}
async function actor(req,db){
  const s=await staff(req,db);if(s)return s;
  const sid=cookie(req,'sid');if(!sid)return null;
  try{const a=await db.prepare("SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first();if(a)return a}catch(_){}
  return null;
}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function one(db,q,b=[]){try{return await db.prepare(q).bind(...b).first()}catch(_){return null}}

async function updateSecurity(req,db,s){
  if(!sameOrigin(req))return deny('طلب غير صالح.');
  const f=await req.formData(),action=String(f.get('action')||'');
  if(action==='contact'){
    const contact=normalizeContact(String(f.get('contact')||''));
    if(contact.length<6)return securityProfile(s,'أدخل هاتفاً أو بريداً صالحاً.');
    const hash=await sha256(contact),hint=contactHint(contact);
    await db.prepare("UPDATE club_staff_users SET recovery_contact_hash=?,recovery_contact_hint=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,hint,s.id).run();
    await audit(db,s.username,'update_recovery_contact','staff_user',s.id,hint);
    s.recovery_contact_hint=hint;
    return securityProfile(s,'تم حفظ وسيلة الاستعادة بأمان.');
  }
  if(action==='password'){
    const current=String(f.get('current_password')||''),next=String(f.get('new_password')||''),confirm=String(f.get('confirm_password')||'');
    if(next.length<10||next!==confirm)return securityProfile(s,'كلمة المرور الجديدة لا تقل عن 10 أحرف ويجب أن يتطابق التأكيد.');
    const row=await one(db,"SELECT password_hash,password_salt FROM club_staff_users WHERE id=?",[s.id]);
    if(!row||!(await verifyPassword(current,row.password_salt,row.password_hash)))return securityProfile(s,'كلمة المرور الحالية غير صحيحة.');
    const hp=await hashPassword(next);
    await db.prepare("UPDATE club_staff_users SET password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hp.hash,hp.salt,s.id).run();
    const token=cookie(req,'club_sid');try{await db.prepare("DELETE FROM club_staff_sessions WHERE user_id=? AND token<>?").bind(s.id,token).run()}catch(_){}
    await audit(db,s.username,'password_change','staff_user',s.id,'self-service');
    return securityProfile(s,'تم تغيير كلمة المرور وإغلاق الجلسات الأخرى.');
  }
  return securityProfile(s,'');
}

function securityProfile(s,msg){
  const body='<a href="/club-admin">مركز الإدارة ←</a><section class="hero"><span>ACCOUNT SECURITY</span><h1>أمان الحساب</h1><p>'+esc(s.full_name||s.username)+' · '+esc(ROLES[s.role]||s.role)+'</p></section>'+(msg?'<div class="ok">'+esc(msg)+'</div>':'')+'<div class="grid"><section class="box"><h2>وسيلة الاستعادة</h2><p>الحالية: '+esc(s.recovery_contact_hint||'لم تضبط بعد')+'</p><form method="post"><input type="hidden" name="action" value="contact"><input name="contact" placeholder="الهاتف أو البريد الرسمي" required><button>حفظ وسيلة الاستعادة</button></form></section><section class="box"><h2>تغيير كلمة المرور</h2><form method="post"><input type="hidden" name="action" value="password"><input type="password" name="current_password" placeholder="كلمة المرور الحالية" required><input type="password" name="new_password" minlength="10" placeholder="الجديدة - 10 أحرف فأكثر" required><input type="password" name="confirm_password" minlength="10" placeholder="تأكيد الجديدة" required><button>تغيير كلمة المرور</button></form></section></div>';
  return page('أمان الحساب',body);
}

function recoverPage(msg){
  return page('استعادة الحساب','<a href="/staff-login">الدخول ←</a><section class="hero"><span>SECURE RECOVERY</span><h1>استعادة اسم المستخدم أو كلمة المرور</h1><p>اسم المستخدم اختياري إذا كنت قد نسيته.</p></section>'+(msg?'<div class="ok">'+esc(msg)+'</div>':'')+'<section class="box"><form method="post"><input name="username" placeholder="اسم المستخدم - اختياري"><input name="contact" placeholder="الهاتف أو البريد المسجل" required><button>إرسال طلب الاستعادة</button></form><p class="hint">لن نكشف من هذه الصفحة ما إذا كان الحساب موجوداً. الطلب يصل للمسؤول المخول.</p></section>');
}
async function recoveryRequest(req,db){
  const f=await req.formData(),username=String(f.get('username')||'').trim(),contact=normalizeContact(String(f.get('contact')||''));
  if(contact.length>=6){
    const hash=await sha256(contact);
    const u=username?await one(db,"SELECT id FROM club_staff_users WHERE lower(username)=lower(?) AND recovery_contact_hash=? AND is_active=1",[username,hash]):await one(db,"SELECT id FROM club_staff_users WHERE recovery_contact_hash=? AND is_active=1 LIMIT 1",[hash]);
    if(u){
      await db.prepare("INSERT INTO club_staff_recovery_requests(user_id,status,expires_at) VALUES(?,'pending',datetime('now','+60 minutes'))").bind(u.id).run();
      await audit(db,'public','recovery_request','staff_user',u.id,'verified contact fingerprint');
    }
  }
  return recoverPage('إذا كانت البيانات مطابقة لحساب مسجل، تم إنشاء طلب استعادة صالح لمدة ساعة.');
}

async function securityCenter(db,a){
  const users=await many(db,"SELECT id,username,full_name,role,is_active,recovery_contact_hint,password_changed_at FROM club_staff_users ORDER BY id");
  const reqs=await many(db,"SELECT r.id,r.user_id,r.requested_at,r.expires_at,u.username,u.full_name,u.role FROM club_staff_recovery_requests r JOIN club_staff_users u ON u.id=r.user_id WHERE r.status='pending' AND r.expires_at>datetime('now') ORDER BY r.id DESC LIMIT 30");
  const logs=await many(db,"SELECT actor,action,entity_type,entity_id,details,created_at FROM club_audit_log ORDER BY id DESC LIMIT 60");
  let body='<a href="/club-admin">مركز الإدارة ←</a><section class="hero"><span>SECURITY CONTROL</span><h1>مركز الأمان والاستعادة</h1><p>حساب لكل مسؤول، استعادة موثقة، وسجل عمليات لا يعتمد على ذاكرة الأشخاص.</p></section>';
  body+='<div class="stats"><div><b>'+users.filter(x=>x.is_active).length+'</b><span>حسابات نشطة</span></div><div><b>'+reqs.length+'</b><span>طلبات استعادة</span></div><div><b>'+logs.length+'</b><span>أحداث حديثة</span></div></div>';
  body+='<section class="box"><h2>طلبات الاستعادة</h2>'+(reqs.length?reqs.map(r=>'<article><div><b>'+esc(r.full_name||r.username)+'</b><small>'+esc(ROLES[r.role]||r.role)+'</small></div><form method="post" action="/club-admin/security-center/recovery/'+r.id+'/reset"><input type="password" name="new_password" minlength="10" placeholder="كلمة مرور مؤقتة جديدة" required><button>إعادة تعيين</button></form></article>').join(''):'<p>لا توجد طلبات معلقة.</p>')+'</section>';
  body+='<section class="box"><h2>الحسابات</h2>'+users.map(x=>'<div class="row"><b>'+esc(x.full_name||x.username)+'</b><span>'+esc(ROLES[x.role]||x.role)+'</span><small>'+(x.recovery_contact_hint?'استعادة: '+esc(x.recovery_contact_hint):'لم تضبط وسيلة الاستعادة')+'</small></div>').join('')+'</section>';
  body+='<section class="box"><h2>سجل العمليات</h2>'+logs.map(x=>'<div class="row"><b>'+esc(x.action)+'</b><span>'+esc(x.actor)+' · '+esc(x.entity_type||'')+'</span><small>'+esc(date(x.created_at))+' · '+esc(x.details||'')+'</small></div>').join('')+'</section>';
  return page('مركز الأمان',body);
}

async function resetAccount(req,db,a,id){
  if(!sameOrigin(req))return deny('طلب غير صالح.');
  const f=await req.formData(),password=String(f.get('new_password')||'');
  if(password.length<10)return deny('كلمة المرور المؤقتة يجب ألا تقل عن 10 أحرف.');
  const rec=await one(db,"SELECT * FROM club_staff_recovery_requests WHERE id=? AND status='pending' AND expires_at>datetime('now')",[id]);
  if(!rec)return deny('طلب الاستعادة غير صالح أو منتهي.');
  const hp=await hashPassword(password);
  await db.prepare("UPDATE club_staff_users SET password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hp.hash,hp.salt,rec.user_id).run();
  await db.prepare("DELETE FROM club_staff_sessions WHERE user_id=?").bind(rec.user_id).run();
  await db.prepare("UPDATE club_staff_recovery_requests SET status='completed',completed_at=CURRENT_TIMESTAMP,completed_by=? WHERE id=?").bind(a.username,id).run();
  await audit(db,a.username,'recovery_reset','staff_user',rec.user_id,'all sessions revoked');
  return red('/club-admin/security-center');
}

function normalizeContact(x){x=String(x||'').trim().toLowerCase();return x.includes('@')?x:digits(x)}
function contactHint(x){return x.includes('@')?x.replace(/^(.{1,2}).*(@.*)$/,'$1***$2'):'•••• '+digits(x).slice(-4)}
function digits(x){const ar='٠١٢٣٤٥٦٧٨٩';return String(x||'').replace(/[٠-٩]/g,c=>String(ar.indexOf(c))).replace(/\D/g,'')}
async function sha256(x){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x));return toHex(new Uint8Array(b))}
async function hashPassword(p){const sb=crypto.getRandomValues(new Uint8Array(16)),salt=toHex(sb),k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:sb,iterations:150000,hash:'SHA-256'},k,256);return {salt,hash:toHex(new Uint8Array(bits))}}
async function verifyPassword(p,salt,expected){try{const sb=fromHex(salt),k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:sb,iterations:150000,hash:'SHA-256'},k,256);return safe(toHex(new Uint8Array(bits)),String(expected||''))}catch(_){return false}}
function safe(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function toHex(a){return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function fromHex(s){if(!/^[0-9a-f]+$/i.test(s)||s.length%2)throw 0;const a=new Uint8Array(s.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(s.slice(i*2,i*2+2),16);return a}
function cookie(req,name){const c=req.headers.get('cookie')||'',m=c.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
async function audit(db,actor,action,type,id,details){try{await db.prepare("INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)").bind(actor,action,type,String(id||''),details||'').run()}catch(_){}}
function date(v){return v?String(v).replace('T',' ').slice(0,16):'—'}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function deny(msg){return page('غير مصرح','<section class="hero"><h1>غير مصرح</h1><p>'+esc(msg)+'</p></section>',403)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function page(t,b,status=200){
  const css='*{box-sizing:border-box}body{margin:0;background:linear-gradient(155deg,#061a43,#0b347a);color:#fff;font-family:system-ui;min-height:100vh}main{width:min(950px,94%);margin:28px auto}a{color:#fff}.hero,.box,.ok{background:#08265ddd;border:1px solid #d5a92866;border-radius:20px;padding:18px;margin:15px 0}.hero span,.hero h1,.box h2{color:#f5b329}.hero h1{margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box form{display:grid;gap:10px}.box input,.box button{padding:12px;border-radius:11px;border:0;font:inherit}.box button{background:#f5b329;color:#061a43;font-weight:900}.ok{border-color:#25D366}.hint,.row small,article small{opacity:.7}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stats>div{background:#ffffff0b;padding:14px;border-radius:16px}.stats b{display:block;font-size:26px;color:#f5b329}.row{padding:10px 0;border-bottom:1px solid #ffffff15}.row b,.row span,.row small{display:block}article{padding:12px 0;border-bottom:1px solid #ffffff15}article>div b,article>div small{display:block}article form{display:flex;gap:8px;margin-top:8px}article form input{flex:1}@media(max-width:680px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}article form{display:grid}}';
  return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t)+' · '+CLUB+'</title><style>'+css+'</style></head><body><main>'+b+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
