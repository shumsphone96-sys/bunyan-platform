import app from './worker-global-v72.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ACCESS=new Set(['president','secretary','owner']);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(p==='/club-admin/command-center'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/staff-login?next=/club-admin/command-center');
      return commandCenter(env.DB,a);
    }

    if(p==='/club-admin/release-readiness'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/staff-login?next=/club-admin/release-readiness');
      if(!ACCESS.has(a.role))return deny('فحص الجاهزية متاح للرئيس والسكرتير ومدير النظام فقط.');
      return readiness(env,a);
    }

    const r=await app.fetch(req,env,ctx),ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/club-admin','/club-admin/overview','/club-admin/operations'].includes(p)){
      let html=await r.text();
      const a=env.DB?await actor(req,env.DB):null;
      if(a&&!html.includes('/club-admin/command-center')){
        const box='<section class="wdn73"><div class="wdn73-head"><div><span>WAD NAFIE · EXECUTIVE OS</span><h2>غرفة قيادة النادي</h2><p>نظرة واحدة على العضوية، الأمان، المالية، النظام الأساسي، وجودة التشغيل.</p></div><b>● LIVE</b></div><div class="wdn73-grid"><a href="/club-admin/command-center">فتح غرفة القيادة</a><a href="/club-admin/release-readiness">فحص الجاهزية</a></div></section>';
        html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
      }
      if(html.includes('</head>')&&!html.includes('wdn73-style')){
        html=html.replace('</head>','<style id="wdn73-style">'+injectCss()+'</style></head>');
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v73-command-center');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  for(const q of[
    "CREATE TABLE IF NOT EXISTS club_release_checks(id INTEGER PRIMARY KEY AUTOINCREMENT,checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,actor TEXT,status TEXT,details TEXT)",
    "CREATE INDEX IF NOT EXISTS idx_release_checks_date ON club_release_checks(checked_at)"
  ]){try{await db.prepare(q).run()}catch(_){}}
}

async function commandCenter(db,a){
  const metrics={
    applications:await n(db,"SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready')"),
    ready:await n(db,"SELECT COUNT(*) c FROM applications WHERE status='ready'"),
    members:await n(db,"SELECT COUNT(*) c FROM members WHERE status IN ('active','approved')"),
    pendingPayments:await n(db,"SELECT COUNT(*) c FROM club_payment_submissions WHERE COALESCE(status,'pending')='pending'"),
    staff:await n(db,"SELECT COUNT(*) c FROM club_staff_users WHERE is_active=1"),
    recovery:await n(db,"SELECT COUNT(*) c FROM club_staff_recovery_requests WHERE status='pending' AND expires_at>datetime('now')")
  };
  const g=await one(db,"SELECT constitution_status,updated_at FROM club_governance_state WHERE id=1");
  const tasks=[];
  if(metrics.applications)tasks.push(['العضوية',metrics.applications+' طلب يحتاج متابعة','/club-admin/membership-center']);
  if(metrics.ready)tasks.push(['الاعتماد',metrics.ready+' طلب جاهز للقرار','/club-admin/membership-center']);
  if(metrics.pendingPayments)tasks.push(['المالية',metrics.pendingPayments+' دفعة تحتاج مراجعة','/club-admin/finance?status=pending']);
  if(metrics.recovery)tasks.push(['الأمان',metrics.recovery+' طلب استعادة حساب','/club-admin/security-center']);
  if(!tasks.length)tasks.push(['التشغيل','لا توجد مهام حرجة ظاهرة الآن','/club-admin/workqueue']);

  const body='<section class="hero"><div><span>EXECUTIVE COMMAND CENTER</span><h1>غرفة قيادة نادي ود نفيع</h1><p>'+esc(a.full_name||a.username)+' · '+esc(a.role)+'</p></div><div class="pulse">● النظام تحت المراجعة</div></section>'+
  '<div class="metrics">'+metric(metrics.applications,'طلبات قيد المعالجة')+metric(metrics.ready,'جاهزة للاعتماد')+metric(metrics.members,'أعضاء نشطون')+metric(metrics.pendingPayments,'مدفوعات معلقة')+metric(metrics.staff,'حسابات إدارية')+metric(metrics.recovery,'استعادة معلقة')+'</div>'+
  '<section class="status"><div><small>الوضع المؤسسي</small><b>'+esc(g?.constitution_status||'قيد المتابعة')+'</b></div><a href="/club-admin/constitution">فتح النظام الأساسي</a></section>'+
  '<div class="layout"><section class="panel"><h2>أولوية اليوم</h2>'+tasks.map(t=>'<a class="task" href="'+t[2]+'"><div><b>'+esc(t[0])+'</b><span>'+esc(t[1])+'</span></div><i>←</i></a>').join('')+'</section>'+
  '<section class="panel"><h2>الوحدات الرئيسية</h2><div class="modules"><a href="/club-admin/membership-center">العضوية</a><a href="/club-admin/finance">المالية</a><a href="/club-admin/security-center">الأمان</a><a href="/club-admin/workqueue">قائمة العمل</a><a href="/club-admin/data-quality">جودة البيانات</a><a href="/club-admin/release-readiness">جاهزية النشر</a></div></section></div>';
  return page('غرفة القيادة',body);
}

async function readiness(env,a){
  const db=env.DB,checks=[];
  checks.push(await tableCheck(db,'applications','جدول طلبات العضوية'));
  checks.push(await tableCheck(db,'members','جدول الأعضاء'));
  checks.push(await tableCheck(db,'payments','جدول المدفوعات الأساسي'));
  checks.push(await tableCheck(db,'club_staff_users','حسابات الصلاحيات'));
  checks.push(await tableCheck(db,'club_audit_log','سجل التدقيق'));
  checks.push(await tableCheck(db,'club_governance_state','حالة النظام الأساسي'));
  checks.push(['ربط D1',!!env.DB,'أساسي']);
  const staffCount=await n(db,"SELECT COUNT(*) c FROM club_staff_users WHERE is_active=1");
  checks.push(['وجود حساب إداري واحد على الأقل',staffCount>0,'أساسي']);
  const recoveryCount=await n(db,"SELECT COUNT(*) c FROM club_staff_users WHERE is_active=1 AND recovery_contact_hash IS NOT NULL");
  checks.push(['وسيلة استعادة مضبوطة لحساب واحد على الأقل',recoveryCount>0,'أمان']);
  const critical=checks.filter(x=>x[2]==='أساسي'&&!x[1]).length;
  const status=critical===0?'GREEN':'AMBER';
  try{await db.prepare("INSERT INTO club_release_checks(actor,status,details) VALUES(?,?,?)").bind(a.username,status,JSON.stringify(checks)).run()}catch(_){}
  const body='<section class="hero"><div><span>RELEASE READINESS</span><h1>فحص جاهزية الموقع</h1><p>فحص غير تدميري: لا يغير بيانات الأعضاء ولا ينشر شيئاً.</p></div><div class="grade '+status.toLowerCase()+'">'+status+'</div></section>'+
  '<section class="panel"><h2>النتيجة</h2>'+checks.map(x=>'<div class="check '+(x[1]?'ok':'bad')+'"><b>'+(x[1]?'✓ ':'✕ ')+esc(x[0])+'</b><span>'+esc(x[2])+'</span></div>').join('')+'</section>'+
  '<section class="note"><b>قرار النشر</b><p>'+(critical===0?'الأساس التشغيلي اجتاز الفحوص الظاهرة، لكن النشر النهائي يظل مشروطاً باختبار تسجيل الدخول، النسخ الاحتياطي/الاستعادة، وتجربة ما بعد النشر.':'توجد بوابات أساسية غير مكتملة؛ لا يُنصح بالنشر الحي قبل معالجتها.')+'</p></section>';
  return page('جاهزية النشر',body);
}

async function tableCheck(db,name,label){
  const c=await n(db,"SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='"+name.replace(/'/g,"''")+"'");
  return [label,c>0,'أساسي'];
}
async function actor(req,db){
  const staff=await staffSession(req,db);if(staff)return staff;
  const sid=cookie(req,'sid');if(!sid)return null;
  try{const a=await db.prepare("SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first();if(a)return a}catch(_){}
  try{return await db.prepare("SELECT u.id,u.username,u.username full_name,CASE WHEN lower(u.role) IN ('admin','owner','superadmin') THEN 'owner' ELSE lower(u.role) END role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first()}catch(_){return null}
}
async function staffSession(req,db){
  const t=cookie(req,'club_sid');if(!t)return null;
  try{return await db.prepare("SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions s JOIN club_staff_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now') AND u.is_active=1").bind(t).first()}catch(_){return null}
}
async function one(db,q,b=[]){try{return await db.prepare(q).bind(...b).first()}catch(_){return null}}
async function n(db,q){try{return Number((await db.prepare(q).first())?.c||0)}catch(_){return 0}}
function metric(v,l){return '<div><b>'+v+'</b><span>'+l+'</span></div>'}
function cookie(req,name){const c=req.headers.get('cookie')||'',m=c.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function deny(msg){return page('غير مصرح','<section class="hero"><h1>غير مصرح</h1><p>'+esc(msg)+'</p></section>',403)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function page(title,body,status=200){
  const css='*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#123e82 0,#071936 42%,#041127 100%);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}main{width:min(1180px,94%);margin:26px auto 60px}.hero,.panel,.status,.note{background:#ffffff0b;border:1px solid #ffffff18;border-radius:24px;padding:20px;margin:14px 0}.hero{display:flex;justify-content:space-between;gap:18px;align-items:center}.hero span{font-size:11px;color:#f5b329;letter-spacing:.12em}.hero h1{margin:4px 0;color:#f5b329}.pulse,.grade{padding:9px 12px;border-radius:999px;background:#ffffff0c;border:1px solid #ffffff22}.grade.green{color:#8df0c2;border-color:#38d99688}.grade.amber{color:#ffd478;border-color:#f5b32988}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.metrics>div{padding:15px;border-radius:18px;background:#ffffff0b;border:1px solid #ffffff14}.metrics b,.metrics span{display:block}.metrics b{font-size:26px;color:#f5b329}.metrics span{font-size:12px;opacity:.72}.status{display:flex;justify-content:space-between;align-items:center;border-color:#f5b32955}.status small,.status b{display:block}.status b{color:#f5b329}.status a{background:#f5b329;color:#061a43;text-decoration:none;padding:10px 13px;border-radius:12px;font-weight:900}.layout{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel h2{color:#f5b329;margin-top:0}.task{display:flex;justify-content:space-between;align-items:center;color:#fff;text-decoration:none;padding:12px 0;border-bottom:1px solid #ffffff12}.task b,.task span{display:block}.task span{opacity:.7}.modules{display:grid;grid-template-columns:1fr 1fr;gap:9px}.modules a{color:#fff;text-decoration:none;padding:13px;border-radius:14px;border:1px solid #ffffff18;background:#ffffff08}.check{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid #ffffff12}.check.ok b{color:#89efc0}.check.bad b{color:#ff9999}.note{border-color:#f5b32955}.note b{color:#f5b329}@media(max-width:900px){.metrics{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.layout{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.hero,.status{display:block}.status a{display:inline-block;margin-top:12px}}';
  return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' · '+CLUB+'</title><style>'+css+'</style></head><body><main>'+body+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
function injectCss(){return '.wdn73{margin:18px 0;padding:18px;border:1px solid #f5b32955;border-radius:22px;background:linear-gradient(135deg,#061a43,#0a347c);color:#fff}.wdn73-head{display:flex;justify-content:space-between;gap:16px}.wdn73-head span{font-size:11px;color:#f5b329}.wdn73 h2{color:#f5b329;margin:4px 0}.wdn73 p{margin:0;opacity:.82}.wdn73-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.wdn73-grid a{padding:12px;border-radius:13px;background:#f5b329;color:#061a43;text-decoration:none;font-weight:900;text-align:center}.wdn73-grid a+ a{background:#fff}@media(max-width:600px){.wdn73-head{display:block}}'}
