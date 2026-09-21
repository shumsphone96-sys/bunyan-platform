import app from './worker-global-v70.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ROLES={president:'الرئيس',vice_president:'نائب الرئيس',secretary:'السكرتير',finance_manager:'أمين المال',owner:'مدير النظام'};
const VIEW=new Set(['president','vice_president','secretary','finance_manager','owner']);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(p==='/track-membership'&&m==='GET') return trackPage('');
    if(p==='/track-membership'&&m==='POST'&&env.DB) return track(req,env.DB);

    if(p==='/club-admin/membership-center'&&env.DB){
      const a=await actor(req,env.DB);
      if(!a)return red('/staff-login?next=/club-admin/membership-center');
      if(!VIEW.has(a.role))return deny('ليست لديك صلاحية مشاهدة مركز العضوية.');
      return center(env.DB,a,u);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();

      if(['/','/membership'].includes(p)&&!html.includes('/track-membership')){
        const box='<section class="wdn71-public"><div><b>متابعة الطلب والعضوية</b><p>قبل الاعتماد برقم الطلب REQ، وبعد الاعتماد برقم العضوية WN، مع تحقق بآخر 4 أرقام من الهاتف.</p></div><a href="/track-membership">متابعة الآن ←</a></section>';
        html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
      }

      if(['/club-admin','/club-admin/overview','/club-admin/operations','/club-admin/workqueue'].includes(p)){
        const a=env.DB?await actor(req,env.DB):null;
        if(a&&!html.includes('/club-admin/membership-center')){
          const box='<section class="wdn71-command"><span>WAD NAFIE · SMART CLUB</span><h2>مركز التشغيل الذكي</h2><p>عضوية، أمان، مالية، نظام أساسي ومهام اليوم في شاشة واحدة.</p><div><a href="/club-admin/membership-center"><b>نبض العضوية</b><small>بحث وحالات وملفات</small></a><a href="/club-admin/workqueue"><b>قائمة العمل</b><small>ما يحتاج إجراء الآن</small></a><a href="/club-admin/security-audit"><b>الأمان والتدقيق</b><small>مراقبة العمليات الحساسة</small></a><a href="/club-admin/constitution"><b>النظام الأساسي</b><small>مجاز من الاتحاد · في انتظار الجمعية</small></a></div></section>';
          html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
        }
      }

      if(html.includes('</head>')&&!html.includes('wdn71-style')){
        const css='<style id="wdn71-style">.wdn71-public,.wdn71-command{width:min(1100px,94%);margin:24px auto;padding:20px;border:1px solid #d5a92855;border-radius:24px;background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;box-shadow:0 18px 55px #061a4322}.wdn71-public{display:flex;align-items:center;justify-content:space-between;gap:18px}.wdn71-public b,.wdn71-command h2{color:#f5b329;font-size:20px}.wdn71-public p,.wdn71-command p{margin:4px 0;opacity:.88}.wdn71-public>a{background:#f5b329;color:#061a43;text-decoration:none;font-weight:900;padding:12px 16px;border-radius:14px}.wdn71-command>span{font-size:11px;letter-spacing:.12em;color:#f5b329}.wdn71-command>div{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.wdn71-command a{padding:14px;border-radius:17px;border:1px solid #ffffff1f;color:#fff;text-decoration:none;background:#ffffff0b}.wdn71-command a b,.wdn71-command a small{display:block}.wdn71-command a b{color:#f5b329}.wdn71-command a small{opacity:.72;margin-top:4px}@media(max-width:760px){.wdn71-command>div{grid-template-columns:1fr 1fr}.wdn71-public{display:block}.wdn71-public>a{display:block;text-align:center;margin-top:12px}}</style>';
        html=html.replace('</head>',css+'</head>');
      }

      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v71-smart-membership');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const q1="CREATE TABLE IF NOT EXISTS club_governance_state(id INTEGER PRIMARY KEY CHECK(id=1),constitution_status TEXT NOT NULL DEFAULT 'مجاز من الاتحاد المحلي لكرة القدم بالمناقل - في انتظار إجازة الجمعية العمومية',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)";
  const q2="INSERT OR IGNORE INTO club_governance_state(id) VALUES(1)";
  for(const q of [q1,q2]){try{await db.prepare(q).run()}catch(_){}}
}
async function actor(req,db){
  const cs=cookie(req,'club_sid');
  if(cs)try{const s=await db.prepare("SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions x JOIN club_staff_users u ON u.id=x.user_id WHERE x.token=? AND x.expires_at>datetime('now') AND u.is_active=1").bind(cs).first();if(s)return s}catch(_){}
  const sid=cookie(req,'sid');if(!sid)return null;
  try{const a=await db.prepare("SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first();if(a)return a}catch(_){}
  return null;
}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function one(db,q,b=[]){try{return await db.prepare(q).bind(...b).first()}catch(_){return null}}
async function n(db,q,b=[]){try{return Number((await db.prepare(q).bind(...b).first())?.c||0)}catch(_){return 0}}

async function center(db,a,u){
  const q=String(u.searchParams.get('q')||'').trim().slice(0,80),like='%'+q+'%';
  const stats=[
    [await n(db,"SELECT COUNT(*) c FROM applications WHERE status='pending'"),'طلبات جديدة'],
    [await n(db,"SELECT COUNT(*) c FROM applications WHERE status='review'"),'تحت المراجعة'],
    [await n(db,"SELECT COUNT(*) c FROM applications WHERE status='needs-info'"),'تحتاج استكمال'],
    [await n(db,"SELECT COUNT(*) c FROM applications WHERE status='ready'"),'جاهزة للاعتماد'],
    [await n(db,"SELECT COUNT(*) c FROM members WHERE status IN ('active','approved')"),'أعضاء نشطون'],
    [await n(db,"SELECT COUNT(*) c FROM club_payment_submissions WHERE COALESCE(status,'pending')='pending'"),'مدفوعات معلقة']
  ];
  const apps=q?await many(db,"SELECT id,app_no,name,status,created_at FROM applications WHERE app_no=? OR phone=? OR name LIKE ? ORDER BY id DESC LIMIT 40",[q,q,like]):await many(db,"SELECT id,app_no,name,status,created_at FROM applications ORDER BY id DESC LIMIT 18");
  const mem=q?await many(db,"SELECT id,member_no,name,status,approved_at FROM members WHERE member_no=? OR phone=? OR name LIKE ? ORDER BY id DESC LIMIT 40",[q,q,like]):await many(db,"SELECT id,member_no,name,status,approved_at FROM members ORDER BY id DESC LIMIT 12");
  const g=await one(db,"SELECT constitution_status FROM club_governance_state WHERE id=1");
  let rows='<section class="hero"><div><span>MEMBERSHIP COMMAND CENTER</span><h1>مركز العضوية الذكي</h1><p>كل الطلبات والأعضاء والمدفوعات والخطوة التالية المطلوبة.</p></div><aside>'+esc(a.full_name||a.username)+'<small>'+esc(ROLES[a.role]||a.role)+'</small></aside></section>';
  rows+='<div class="stats">'+stats.map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('')+'</div>';
  rows+='<section class="search"><form><input name="q" value="'+esc(q)+'" placeholder="رقم الطلب أو العضوية أو الاسم أو الهاتف"><button>بحث ذكي</button></form><nav><a href="/applications">طلبات العضوية</a><a href="/club-admin/workqueue">قائمة العمل</a><a href="/club-admin/finance?status=pending">المدفوعات</a><a href="/club-admin/data-quality">جودة البيانات</a></nav></section>';
  rows+='<section class="gov"><b>حالة النظام الأساسي</b><span>'+esc(g?.constitution_status||'قيد المتابعة')+'</span></section>';
  rows+='<div class="cols"><section class="panel"><h2>طلبات العضوية</h2>'+apps.map(x=>card(x.name,x.app_no,x.status)).join('')+'</section><section class="panel"><h2>الأعضاء</h2>'+mem.map(x=>card(x.name,x.member_no,x.status)).join('')+'</section></div>';
  return adminPage('مركز العضوية',rows);
}
function card(name,no,status){return '<div class="person"><i>'+initials(name)+'</i><div><b>'+esc(name||no)+'</b><span>'+esc(no||'')+' · '+esc(label(status))+'</span><small>'+esc(next(status))+'</small></div></div>'}

async function track(req,db){
  const f=await req.formData(),id=String(f.get('identifier')||'').trim().toUpperCase().replace(/\s+/g,''),last4=digits(String(f.get('last4')||'')).slice(-4);
  if(!id||last4.length!==4)return trackPage('أدخل الرقم وآخر 4 أرقام من الهاتف المسجل.');
  let a=null,m=null;
  if(id.startsWith('REQ'))a=await one(db,"SELECT app_no,name,phone,status,created_at,reviewed_at,member_id FROM applications WHERE upper(app_no)=?",[id]);
  else m=await one(db,"SELECT id,member_no,name,phone,status,approved_at,created_at FROM members WHERE upper(member_no)=?",[id]);
  if(a?.member_id)m=await one(db,"SELECT id,member_no,name,phone,status,approved_at,created_at FROM members WHERE id=?",[a.member_id]);
  if(m&&!a)a=await one(db,"SELECT app_no,name,phone,status,created_at,reviewed_at FROM applications WHERE member_id=? ORDER BY id DESC LIMIT 1",[m.id]);
  const phone=String(m?.phone||a?.phone||'');
  if((!m&&!a)||!phone||digits(phone).slice(-4)!==last4)return trackPage('تعذر مطابقة البيانات. تأكد من الرقم وآخر 4 أرقام من الهاتف.');
  const result='<section class="result"><span>تم التحقق</span><h2>'+esc(maskName(m?.name||a?.name||''))+'</h2><b>'+esc(label(m?.status||a?.status))+'</b><p>'+esc(a?.app_no||'')+(m?' · '+esc(m.member_no):'')+'</p><div class="timeline">'+timeline(a,m)+'</div><aside>لا نعرض العنوان أو تاريخ الميلاد أو الهاتف الكامل حمايةً للخصوصية.</aside></section>';
  return trackPage('',result);
}
function trackPage(err='',result=''){return publicPage('متابعة الطلب والعضوية','<a href="/">الرئيسية ←</a><section class="pubhero"><span>WAD NAFIE · MEMBER TRACK</span><h1>متابعة الطلب والعضوية</h1><p>قبل الاعتماد استخدم رقم الطلب REQ، وبعد الاعتماد استخدم رقم العضوية WN.</p></section>'+(err?'<div class="err">'+esc(err)+'</div>':'')+(result||'<section class="form"><form method="post"><input name="identifier" placeholder="REQ-2026-0001 أو WN-2026-0001" required><input name="last4" inputmode="numeric" maxlength="4" placeholder="آخر 4 أرقام من الهاتف" required><button>تحقق من الحالة</button></form><p>تحقق إضافي لحماية خصوصية بيانات العضو.</p></section>'))}

function label(s){const m={pending:'جديد',review:'تحت المراجعة','needs-info':'يحتاج استكمال',ready:'جاهز للاعتماد',approved:'معتمد',active:'نشط',inactive:'غير نشط',suspended:'موقوف',rejected:'مرفوض'};return m[String(s||'').toLowerCase()]||String(s||'—')}
function next(s){s=String(s||'').toLowerCase();return s==='pending'?'بدء المراجعة':s==='review'?'إكمال المراجعة':s==='needs-info'?'طلب البيانات الناقصة':s==='ready'?'جاهز للقرار/الاعتماد':s==='active'||s==='approved'?'متابعة الاشتراك والخدمات':'مراجعة الحالة'}
function initials(n){const a=String(n||'؟').trim().split(/\s+/);return esc((a[0]?.[0]||'؟')+(a[1]?.[0]||''))}
function timeline(a,m){let x=[];if(a)x.push(['استلام الطلب',a.created_at],['مراجعة الطلب',a.reviewed_at||a.created_at]);if(m)x.push(['إصدار رقم العضوية',m.created_at],['اعتماد العضوية',m.approved_at]);return x.map(y=>'<div><b>'+esc(y[0])+'</b><small>'+esc(date(y[1]))+'</small></div>').join('')}
function date(v){return v?String(v).replace('T',' ').slice(0,16):'—'}
function digits(x){const ar='٠١٢٣٤٥٦٧٨٩';return String(x||'').replace(/[٠-٩]/g,c=>String(ar.indexOf(c))).replace(/\D/g,'')}
function maskName(n){return String(n||'').trim().split(/\s+/).map((x,i)=>i===0?x:(x[0]||'')+'***').join(' ')}
function cookie(req,name){const c=req.headers.get('cookie')||'',m=c.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function deny(msg){return publicPage('غير مصرح','<section class="pubhero"><h1>غير مصرح</h1><p>'+esc(msg)+'</p></section>',403)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function adminPage(t,b,status=200){const css='*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#123e82,#071936 42%,#041127);color:#fff;font-family:system-ui;min-height:100vh}header{display:flex;justify-content:space-between;padding:14px 4%;background:#061a43e8;border-bottom:1px solid #f5b32944}header a{color:#fff;text-decoration:none}header>a{color:#f5b329;font-weight:900}main{width:min(1180px,94%);margin:26px auto}.hero,.panel,.search,.gov{background:#ffffff0b;border:1px solid #ffffff18;border-radius:22px;padding:18px;margin:14px 0}.hero{display:flex;justify-content:space-between}.hero span{font-size:11px;color:#f5b329}.hero h1,.panel h2{color:#f5b329}.hero aside small{display:block}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.stats>div{padding:14px;border-radius:17px;background:#ffffff0b}.stats b{display:block;font-size:25px;color:#f5b329}.search form{display:flex;gap:8px}.search input{flex:1;padding:12px;border:0;border-radius:12px}.search button{background:#f5b329;border:0;border-radius:12px;padding:12px;font-weight:900}.search nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.search nav a{color:#fff}.gov{display:flex;justify-content:space-between;border-color:#f5b32955}.gov b{color:#f5b329}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.person{display:grid;grid-template-columns:42px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid #ffffff12}.person i{width:42px;height:42px;border-radius:14px;background:#f5b329;color:#061a43;display:grid;place-items:center;font-style:normal;font-weight:900}.person div b,.person div span,.person div small{display:block}.person div span,.person div small{opacity:.7}@media(max-width:800px){.stats{grid-template-columns:repeat(3,1fr)}.cols{grid-template-columns:1fr}}';return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t)+' · '+CLUB+'</title><style>'+css+'</style></head><body><header><a href="/club-admin">'+CLUB+'</a><a href="/club-admin/workqueue">قائمة العمل</a></header><main>'+b+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function publicPage(t,b,status=200){const css='*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui}main{width:min(760px,94%);margin:28px auto}.pubhero{margin-top:18px;padding:24px;border-radius:26px;background:linear-gradient(135deg,#061a43,#0a347c);color:#fff}.pubhero span,.pubhero h1{color:#f5b329}.form,.result{background:#fff;border:1px solid #dce6f3;border-radius:22px;padding:20px;margin-top:14px}.form form{display:grid;gap:11px}.form input{padding:12px;border:1px solid #cad7e7;border-radius:12px}.form button{background:#f5b329;border:0;border-radius:12px;padding:12px;font-weight:900}.err{background:#fff0f1;color:#8d1f2e;padding:12px;margin-top:14px;border-radius:13px}.timeline{border-right:2px solid #f5b329;padding-right:16px}.timeline b,.timeline small{display:block}.timeline small{color:#667991}.result aside{background:#fff8dd;padding:10px;border-radius:12px;font-size:12px}';return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t)+' · '+CLUB+'</title><style>'+css+'</style></head><body><main>'+b+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
