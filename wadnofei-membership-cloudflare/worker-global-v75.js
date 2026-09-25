import app from './worker-global-v74.js';

const ROLES={president:'الرئيس',vice_president:'نائب الرئيس',secretary:'السكرتير',finance_manager:'أمين المال',owner:'مدير النظام'};
const ALLOWED=new Set(['president','secretary','owner']);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/club-admin/security-center/recovery-contacts'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/login?next=/club-admin/security-center/recovery-contacts');
      if(!ALLOWED.has(a.role))return deny('إدارة أرقام الاستعادة متاحة للرئيس والسكرتير ومدير النظام فقط.');
      if(m==='GET')return contactsPage(env.DB,a);
      if(m==='POST')return saveContacts(req,env.DB,a);
    }

    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

async function actor(req,db){
  const c=req.headers.get('cookie')||'';
  const cs=c.match(/(?:^|;\s*)club_sid=([^;]+)/);
  if(cs){
    const t=decodeURIComponent(cs[1]);
    try{
      const s=await db.prepare("SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions x JOIN club_staff_users u ON u.id=x.user_id WHERE x.token=? AND x.expires_at>datetime('now') AND u.is_active=1").bind(t).first();
      if(s)return s;
    }catch(_){}
  }
  const sm=c.match(/(?:^|;\s*)sid=([^;]+)/);
  if(!sm)return null;
  const sid=decodeURIComponent(sm[1]);
  try{
    const a=await db.prepare("SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first();
    if(a)return a;
  }catch(_){}
  return null;
}

async function contactsPage(db,a,msg=''){
  let rows=[];
  try{
    rows=(await db.prepare("SELECT id,username,full_name,role,recovery_contact_hint FROM club_staff_users WHERE is_active=1 ORDER BY CASE role WHEN 'president' THEN 1 WHEN 'secretary' THEN 2 WHEN 'finance_manager' THEN 3 ELSE 9 END,id").all()).results||[];
  }catch(_){}
  const cards=rows.map(x=>`
    <label class="card">
      <div><b>${esc(x.full_name||x.username)}</b><span>${esc(ROLES[x.role]||x.role)}</span></div>
      <small>الحالي: ${esc(x.recovery_contact_hint||'غير مربوط')}</small>
      <input inputmode="tel" autocomplete="tel" name="phone_${x.id}" data-user="${escAttr(x.username)}" placeholder="رقم الهاتف">
    </label>`).join('');
  const body=`
    <a href="/club-admin/security-center">مركز الأمان ←</a>
    <section class="hero"><span>RECOVERY CONTACTS</span><h1>ربط أرقام استعادة الحسابات</h1><p>يُحفظ بصمة الرقم فقط، ويظهر آخر 4 أرقام للمراجعة.</p></section>
    ${msg?'<div class="ok">'+esc(msg)+'</div>':''}
    <form method="post" class="box">
      ${cards}
      <button>حفظ أرقام الاستعادة</button>
    </form>
    <p class="hint">بعد الربط، يستخدم المسؤول صفحة «نسيت اسم المستخدم أو كلمة المرور؟» لإنشاء طلب إعادة تعيين موثق.</p>
    <script>
      (()=>{try{
        const h=new URLSearchParams(location.hash.slice(1));
        document.querySelectorAll('input[data-user]').forEach(i=>{
          const v=h.get(i.dataset.user); if(v) i.value=v;
        });
        if(location.hash) history.replaceState(null,'',location.pathname+location.search);
      }catch(e){}})();
    </script>`;
  return page('أرقام الاستعادة',body);
}

async function saveContacts(req,db,a){
  if(!sameOrigin(req))return deny('طلب غير صالح.');
  const f=await req.formData();
  const users=(await db.prepare("SELECT id,username FROM club_staff_users WHERE is_active=1 ORDER BY id").all()).results||[];
  let changed=0;
  for(const u of users){
    const raw=String(f.get('phone_'+u.id)||'').trim();
    if(!raw)continue;
    const phone=digits(raw);
    if(phone.length<6)continue;
    const hash=await sha256(phone),hint='•••• '+phone.slice(-4);
    await db.prepare("UPDATE club_staff_users SET recovery_contact_hash=?,recovery_contact_hint=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,hint,u.id).run();
    try{
      await db.prepare("INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)").bind(a.username,'update_recovery_contact','staff_user',String(u.id),hint).run();
    }catch(_){}
    changed++;
  }
  return contactsPage(db,a,'تم ربط '+changed+' حساب/حسابات بنجاح.');
}

function digits(x){const ar='٠١٢٣٤٥٦٧٨٩';return String(x||'').replace(/[٠-٩]/g,c=>String(ar.indexOf(c))).replace(/\D/g,'')}
async function sha256(x){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x));return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function deny(msg){return page('غير مصرح','<section class="hero"><h1>غير مصرح</h1><p>'+esc(msg)+'</p></section>',403)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escAttr(v){return esc(v)}
function page(t,b,status=200){
  const css='*{box-sizing:border-box}body{margin:0;background:linear-gradient(155deg,#061a43,#0b347a);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}main{width:min(900px,94%);margin:28px auto}a{color:#fff}.hero,.box,.ok{background:#08265ddd;border:1px solid #d5a92866;border-radius:20px;padding:18px;margin:15px 0}.hero span,.hero h1{color:#f5b329}.hero h1{margin:4px 0}.box{display:grid;gap:12px}.card{display:block;padding:14px;border:1px solid #ffffff20;border-radius:16px;background:#ffffff08}.card b,.card span,.card small{display:block}.card b{color:#f5b329}.card span,.card small,.hint{opacity:.78}.card input{margin-top:10px;width:100%;padding:13px;border-radius:11px;border:0;font:inherit}.box button{padding:13px;border:0;border-radius:12px;background:#f5b329;color:#061a43;font-weight:900;font:inherit}.ok{border-color:#25D366}';
  return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t)+'</title><style>'+css+'</style></head><body><main>'+b+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});
}
