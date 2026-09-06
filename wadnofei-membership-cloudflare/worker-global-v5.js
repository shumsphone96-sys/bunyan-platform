import base from './worker-global-v4.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const SHORT='نادي ود نفيع';
const GOLD='#d5a928';
const BLUE='#0a347c';
const DARK='#061a43';

export default {
  async fetch(req, env, ctx) {
    try {
      if (!env.DB) return html(page('قاعدة البيانات غير مربوطة', '<div class="box"><h2>تعذر الاتصال بقاعدة البيانات</h2></div>'), 500);
      await ensureV5(env.DB);
      const url = new URL(req.url);
      const path = clean(url.pathname);
      const method = req.method.toUpperCase();

      if (path === '/membership' || path === '/membership/join') {
        if (method === 'GET') return html(joinPage());
        if (method === 'POST') return submitJoin(req, env.DB);
      }

      if (path === '/membership/track') {
        if (method === 'GET') return html(trackPage(url.searchParams));
        if (method === 'POST') return submitTrack(req);
      }

      if (path.startsWith('/membership/status/')) {
        const no = decodeURIComponent(path.slice('/membership/status/'.length));
        return membershipStatus(env.DB, no, url.searchParams.get('phone') || '');
      }

      if (path === '/applications' && method === 'GET') {
        const admin = await adminSession(req, env.DB);
        if (!admin) return redirect('/login');
        return adminApplications(env.DB, admin);
      }

      const stageMatch = path.match(/^\/applications\/(\d+)\/stage\/(received|review|needs-info|ready|approve|reject)$/);
      if (stageMatch && method === 'POST') {
        const admin = await adminSession(req, env.DB);
        if (!admin) return redirect('/login');
        return changeStage(req, env.DB, admin, Number(stageMatch[1]), stageMatch[2]);
      }

      if (path === '/club' && method === 'GET') {
        const response = await base.fetch(req, env, ctx);
        if (response.status !== 404) return response;
        return html(publicClubPage());
      }

      return base.fetch(req, env, ctx);
    } catch (e) {
      return html(page('حدث خطأ', `<div class="box"><h2>حدث خطأ غير متوقع</h2><p>${esc(e?.message || e)}</p></div>`), 500);
    }
  }
};

async function ensureV5(db) {
  const alters = [
    "ALTER TABLE applications ADD COLUMN review_stage TEXT DEFAULT 'received'",
    "ALTER TABLE applications ADD COLUMN admin_note TEXT",
    "ALTER TABLE applications ADD COLUMN updated_at TEXT"
  ];
  for (const q of alters) { try { await db.prepare(q).run(); } catch (_) {} }
  try { await db.prepare("UPDATE applications SET application_no='WDN-' || application_no WHERE application_no LIKE 'REQ-%'").run(); } catch (_) {}
  try { await db.prepare("UPDATE applications SET review_stage='approved' WHERE status='approved' AND (review_stage IS NULL OR review_stage='received')").run(); } catch (_) {}
  try { await db.prepare("UPDATE applications SET review_stage='rejected' WHERE status='rejected' AND (review_stage IS NULL OR review_stage='received')").run(); } catch (_) {}
}

async function submitJoin(req, db) {
  const f = await req.formData();
  const full_name = text(f, 'full_name');
  const phone = normalizePhone(text(f, 'phone'));
  const birth_date = text(f, 'birth_date');
  const address = text(f, 'address');
  const occupation = text(f, 'occupation');
  const membership_type = text(f, 'membership_type');
  const notes = text(f, 'notes');

  if (full_name.length < 4 || phone.length < 6) {
    return html(joinPage('يرجى كتابة الاسم الكامل ورقم هاتف صحيح.', {full_name, phone, birth_date, address, occupation, membership_type, notes}), 400);
  }

  const duplicate = await db.prepare("SELECT application_no,status,review_stage FROM applications WHERE phone=? AND status='pending' ORDER BY id DESC LIMIT 1").bind(phone).first();
  if (duplicate) {
    return html(successPage(duplicate.application_no, phone, true));
  }

  const row = await db.prepare('SELECT COALESCE(MAX(id),0)+1 n FROM applications').first();
  const no = 'WDN-REQ-' + String(Number(row?.n || 1)).padStart(5, '0');
  await db.prepare(`INSERT INTO applications(application_no,full_name,phone,birth_date,address,occupation,membership_type,notes,status,review_stage,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?, 'pending','received',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    .bind(no, full_name, phone, birth_date, address, occupation, membership_type, notes).run();

  return html(successPage(no, phone, false), 201);
}

async function submitTrack(req) {
  const f = await req.formData();
  const no = text(f, 'application_no').toUpperCase();
  const phone = normalizePhone(text(f, 'phone'));
  if (!no || !phone) return redirect('/membership/track');
  return redirect('/membership/status/' + encodeURIComponent(no) + '?phone=' + encodeURIComponent(phone));
}

async function membershipStatus(db, no, phone) {
  const p = normalizePhone(phone);
  const app = await db.prepare('SELECT * FROM applications WHERE UPPER(application_no)=UPPER(?) AND phone=?').bind(no, p).first();
  if (!app) return html(trackPage(new URLSearchParams(), 'لم نعثر على طلب مطابق. تأكد من رقم الطلب ورقم الهاتف.'), 404);

  const member = app.status === 'approved'
    ? await db.prepare('SELECT * FROM members WHERE application_id=? ORDER BY id DESC LIMIT 1').bind(app.id).first()
    : null;

  return html(statusPage(app, member));
}

async function adminApplications(db, admin) {
  const result = await db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT 500').all();
  const cards = result.results.map(a => {
    const stage = effectiveStage(a);
    return `<article class="request-card">
      <div class="request-top"><div><div class="request-no">${esc(a.application_no)}</div><h3>${esc(a.full_name)}</h3></div>${stageBadge(stage)}</div>
      <div class="request-grid">
        <span><b>الهاتف</b>${esc(a.phone || '—')}</span>
        <span><b>السكن</b>${esc(a.address || '—')}</span>
        <span><b>المهنة</b>${esc(a.occupation || '—')}</span>
        <span><b>نوع العضوية</b>${esc(a.membership_type || 'حسب النظام الأساسي')}</span>
        <span><b>تاريخ الطلب</b>${dateAr(a.created_at)}</span>
        <span><b>آخر تحديث</b>${dateAr(a.updated_at || a.decided_at || a.created_at)}</span>
      </div>
      ${a.notes ? `<div class="note"><b>ملاحظات المتقدم:</b> ${esc(a.notes)}</div>` : ''}
      ${a.admin_note ? `<div class="note admin"><b>ملاحظة الإدارة:</b> ${esc(a.admin_note)}</div>` : ''}
      ${a.status === 'pending' ? `<div class="stage-actions">
        ${stageButton(a.id,'review','بدء المراجعة')}
        ${stageButton(a.id,'needs-info','طلب استكمال')}
        ${stageButton(a.id,'ready','جاهز للاعتماد')}
        ${stageButton(a.id,'approve','اعتماد العضوية','ok')}
        ${stageButton(a.id,'reject','رفض','danger')}
      </div>` : ''}
    </article>`;
  }).join('') || '<div class="box"><p>لا توجد طلبات عضوية حتى الآن.</p></div>';

  return html(adminPage('طلبات العضوية', `<div class="admin-head"><div><h1>طلبات العضوية</h1><p>إدارة دورة الطلب من الاستلام حتى إصدار رقم العضوية.</p></div><a class="btn" href="/membership/join" target="_blank">فتح بوابة التسجيل</a></div><div class="requests">${cards}</div>`, admin));
}

async function changeStage(req, db, admin, id, action) {
  const app = await db.prepare('SELECT * FROM applications WHERE id=?').bind(id).first();
  if (!app || app.status !== 'pending') return redirect('/applications');

  let note = '';
  try { const f = await req.formData(); note = text(f, 'admin_note'); } catch (_) {}

  if (action === 'approve') {
    const exists = await db.prepare('SELECT id FROM members WHERE application_id=?').bind(id).first();
    if (!exists) {
      const nrow = await db.prepare('SELECT COALESCE(MAX(id),0)+1 n FROM members').first();
      const memberNo = 'WDN-' + String(Number(nrow?.n || 1)).padStart(5,'0');
      await db.batch([
        db.prepare(`INSERT INTO members(member_no,full_name,phone,birth_date,address,occupation,membership_type,status,joined_at,application_id)
          VALUES(?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,?)`)
          .bind(memberNo, app.full_name, app.phone, app.birth_date, app.address, app.occupation, app.membership_type, id),
        db.prepare("UPDATE applications SET status='approved',review_stage='approved',admin_note=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(note, id)
      ]);
    }
    return redirect('/applications');
  }

  if (action === 'reject') {
    await db.prepare("UPDATE applications SET status='rejected',review_stage='rejected',admin_note=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(note, id).run();
    return redirect('/applications');
  }

  const map = {received:'received', review:'review', 'needs-info':'needs_info', ready:'ready'};
  const stage = map[action] || 'review';
  await db.prepare("UPDATE applications SET review_stage=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stage, note, id).run();
  return redirect('/applications');
}

function joinPage(msg='', vals={}) {
  return publicPage('طلب عضوية جديدة', `
    <section class="hero compact"><div class="mark">WDN</div><h1>طلب عضوية نادي ود نفيع</h1><p>قدّم طلبك إلكترونيًا، واحفظ رقم المتابعة لتعرف مرحلة الطلب حتى الاعتماد.</p></section>
    ${msg ? `<div class="alert">${esc(msg)}</div>` : ''}
    <form method="post" class="form-card">
      <div class="grid2">
        ${field('الاسم الكامل','full_name',vals.full_name,true)}
        ${field('رقم الهاتف','phone',vals.phone,true,'tel')}
        ${field('تاريخ الميلاد','birth_date',vals.birth_date,false,'date')}
        ${field('السكن','address',vals.address)}
        ${field('المهنة','occupation',vals.occupation)}
        ${field('نوع العضوية','membership_type',vals.membership_type,false,'text','حسب النظام الأساسي للنادي')}
      </div>
      <label>ملاحظات<textarea name="notes" rows="4">${esc(vals.notes || '')}</textarea></label>
      <label class="consent"><input type="checkbox" required> أقر بأن البيانات المدخلة صحيحة، وأن تقديم الطلب لا يعني اعتماد العضوية إلا بعد مراجعة إدارة النادي.</label>
      <button class="primary" type="submit">إرسال طلب العضوية</button>
    </form>
    <div class="sub-actions"><a href="/membership/track">متابعة طلب سابق</a><a href="/club">العودة إلى موقع النادي</a></div>
  `);
}

function successPage(no, phone, duplicate) {
  return publicPage('تم استلام الطلب', `
    <section class="success-box">
      <div class="success-icon">✓</div>
      <h1>${duplicate ? 'لديك طلب قيد المعالجة' : 'تم استلام طلب العضوية'}</h1>
      <p>${duplicate ? 'لم ننشئ طلبًا مكررًا. استخدم رقم طلبك الحالي للمتابعة.' : 'تم تسجيل طلبك بنجاح في نظام نادي ود نفيع.'}</p>
      <div class="big-no">${esc(no)}</div>
      <p class="hint">احتفظ بهذا الرقم. ستحتاج إليه مع رقم الهاتف لمتابعة مراحل الطلب.</p>
      ${timeline('received')}
      <a class="primary linkbtn" href="/membership/status/${encodeURIComponent(no)}?phone=${encodeURIComponent(phone)}">متابعة الطلب الآن</a>
    </section>
  `);
}

function trackPage(params=new URLSearchParams(), error='') {
  const no = params.get('application_no') || '';
  return publicPage('متابعة طلب العضوية', `
    <section class="hero compact"><div class="mark">WDN</div><h1>متابعة طلب العضوية</h1><p>أدخل رقم الطلب ورقم الهاتف المستخدم عند التسجيل.</p></section>
    ${error ? `<div class="alert">${esc(error)}</div>` : ''}
    <form method="post" class="form-card narrow">
      ${field('رقم الطلب','application_no',no,true,'text','WDN-REQ-00001')}
      ${field('رقم الهاتف','phone','',true,'tel')}
      <button class="primary" type="submit">عرض حالة الطلب</button>
    </form>
    <div class="sub-actions"><a href="/membership/join">تقديم طلب عضوية جديد</a></div>
  `);
}

function statusPage(app, member) {
  const stage = effectiveStage(app);
  const approved = app.status === 'approved';
  return publicPage('حالة طلب العضوية', `
    <section class="status-head">
      <div><div class="request-no">${esc(app.application_no)}</div><h1>${esc(app.full_name)}</h1><p>آخر تحديث: ${dateAr(app.updated_at || app.decided_at || app.created_at)}</p></div>
      ${stageBadge(stage)}
    </section>
    ${timeline(stage)}
    ${app.admin_note ? `<div class="notice"><b>رسالة من إدارة النادي</b><p>${esc(app.admin_note)}</p></div>` : ''}
    ${approved && member ? `<section class="member-card"><div class="member-label">عضوية معتمدة</div><div class="mark big">WDN</div><h2>${esc(member.full_name)}</h2><div class="member-no">${esc(member.member_no)}</div><p>${esc(member.membership_type || 'عضوية النادي')}</p><p>تاريخ الاعتماد: ${dateAr(member.joined_at)}</p><a href="/verify/${encodeURIComponent(member.member_no)}">التحقق من العضوية</a></section>` : ''}
    ${stage === 'needs_info' ? `<div class="notice warn"><b>مطلوب استكمال بيانات</b><p>راجع ملاحظة الإدارة أعلاه ثم تواصل مع النادي لاستكمال المطلوب. سنضيف الاستكمال الإلكتروني الكامل في المرحلة التالية.</p></div>` : ''}
    <div class="sub-actions"><a href="/membership/track">متابعة طلب آخر</a><a href="/club">موقع النادي</a></div>
  `);
}

function publicClubPage() {
  return publicPage('نادي ود نفيع', `<section class="hero"><div class="mark big">WDN</div><p class="eyebrow">تأسس عام 1964</p><h1>${CLUB}</h1><p>المنصة الرقمية الرسمية لإدارة النادي والعضوية والأنشطة الرياضية والثقافية والاجتماعية.</p><div class="hero-actions"><a class="primary linkbtn" href="/membership/join">طلب عضوية</a><a class="secondary linkbtn" href="/membership/track">متابعة طلب</a><a class="secondary linkbtn" href="/login">دخول الإدارة</a></div></section>`);
}

function timeline(stage) {
  const stages = [
    ['received','تم استلام الطلب'],
    ['review','قيد المراجعة'],
    ['needs_info','استكمال البيانات'],
    ['ready','بانتظار الاعتماد'],
    ['approved','تم الاعتماد وإصدار العضوية']
  ];
  if (stage === 'rejected') return `<div class="timeline rejected"><div class="step done"><i>✓</i><span>تم استلام الطلب</span></div><div class="step current bad"><i>!</i><span>لم يتم اعتماد الطلب</span></div></div>`;
  const order = {received:0, review:1, needs_info:2, ready:3, approved:4};
  const current = order[stage] ?? 0;
  return `<div class="timeline">${stages.map(([k,label],i)=>`<div class="step ${i<current?'done':''} ${i===current?'current':''}"><i>${i<current?'✓':i+1}</i><span>${label}</span></div>`).join('')}</div>`;
}

function effectiveStage(a) {
  if (a.status === 'approved') return 'approved';
  if (a.status === 'rejected') return 'rejected';
  return a.review_stage || 'received';
}

function stageBadge(stage) {
  const m = {
    received:['تم الاستلام','neutral'], review:['قيد المراجعة','review'], needs_info:['مطلوب استكمال','warn'], ready:['بانتظار الاعتماد','ready'], approved:['معتمد','ok'], rejected:['غير معتمد','danger']
  };
  const [t,c] = m[stage] || m.received;
  return `<span class="badge ${c}">${t}</span>`;
}

function stageButton(id, action, label, cls='') {
  const needsNote = action === 'needs-info' || action === 'reject';
  return `<form method="post" action="/applications/${id}/stage/${action}" class="stage-form ${needsNote?'with-note':''}">${needsNote?'<input name="admin_note" placeholder="اكتب الملاحظة للمتقدم" required>':''}<button class="mini ${cls}" type="submit">${label}</button></form>`;
}

async function adminSession(req, db) {
  const cookie = req.headers.get('Cookie') || '';
  const sid = cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);
  if (!sid) return null;
  return db.prepare(`SELECT a.id,a.username,a.must_change FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(sid).first();
}

function adminPage(title, body, admin) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} - ${SHORT}</title><style>${css()}</style></head><body class="admin"><header class="adminbar"><a href="/" class="brand">${SHORT}</a><nav><a href="/">الرئيسية</a><a href="/applications">الطلبات</a><a href="/members">الأعضاء</a><a href="/payments">التحصيل</a><a href="/reports">التقارير</a><a href="/club" target="_blank">الموقع العام</a><a href="/logout">خروج</a></nav></header><main class="wrap">${body}</main><footer>${CLUB} · تأسس عام 1964</footer></body></html>`;
}

function publicPage(title, body) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${DARK}"><title>${esc(title)} - ${SHORT}</title><style>${css()}</style></head><body class="public"><header class="publicbar"><a href="/club" class="brand"><span class="brandmark">WDN</span><span>${SHORT}<small>تأسس عام 1964</small></span></a><nav><a href="/membership/join">طلب عضوية</a><a href="/membership/track">متابعة الطلب</a><a href="/login">الإدارة</a></nav></header><main class="wrap public-wrap">${body}</main><footer>${CLUB} · رياضة · ثقافة · اجتماع · مسؤولية</footer></body></html>`;
}

function field(label,name,value='',required=false,type='text',placeholder='') {
  return `<label>${label}<input type="${type}" name="${name}" value="${esc(value || '')}" ${required?'required':''} placeholder="${esc(placeholder)}"></label>`;
}

function page(title, body){ return publicPage(title, body); }
function html(body,status=200){ return new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"}}); }
function redirect(to){ return new Response(null,{status:303,headers:{Location:to}}); }
function clean(p){ return p.replace(/\/$/,'') || '/'; }
function text(f,k){ return String(f.get(k) || '').trim(); }
function normalizePhone(v){ return String(v || '').replace(/[^0-9+]/g,''); }
function esc(v){ return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function dateAr(v){ if(!v) return '—'; const d=new Date(String(v).replace(' ','T')+'Z'); if(Number.isNaN(d.getTime())) return esc(v); return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Khartoum'}).format(d); }

function css(){return `
:root{--blue:${BLUE};--dark:${DARK};--gold:${GOLD};--ink:#eef4ff;--muted:#b8c7e6;--line:rgba(213,169,40,.35);--card:#09275f;--card2:#0d367c;--danger:#d9534f;--ok:#14985f;--warn:#c58b13}
*{box-sizing:border-box}html{background:var(--dark)}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:radial-gradient(circle at top right,#104493 0,var(--dark) 45%,#04122f 100%);color:var(--ink);min-height:100vh}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,92%);margin:auto;padding:28px 0 55px}footer{text-align:center;color:#91a6d2;padding:28px 10px;border-top:1px solid var(--line);font-size:14px}.publicbar,.adminbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px max(4%,calc((100% - 1180px)/2));background:rgba(6,26,67,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand small{display:block;color:var(--gold);font-size:11px;margin-top:3px}.brandmark,.mark{display:grid;place-items:center;border:2px solid var(--gold);color:var(--gold);font-weight:900;border-radius:50%;width:48px;height:48px;letter-spacing:1px}.mark.big{width:92px;height:92px;font-size:27px;margin:auto}.publicbar nav,.adminbar nav{display:flex;gap:8px;flex-wrap:wrap}.publicbar nav a,.adminbar nav a{padding:9px 12px;border-radius:10px;color:#dbe7ff}.publicbar nav a:hover,.adminbar nav a:hover{background:#113d83;color:var(--gold)}.hero{text-align:center;padding:55px 20px;background:linear-gradient(145deg,rgba(13,54,124,.9),rgba(6,26,67,.9));border:1px solid var(--line);border-radius:28px;box-shadow:0 20px 80px rgba(0,0,0,.25)}.hero.compact{padding:36px 20px}.hero h1{font-size:clamp(28px,5vw,46px);margin:14px 0}.hero p{max-width:780px;margin:0 auto 20px;color:var(--muted);font-size:18px;line-height:1.9}.eyebrow{color:var(--gold)!important;font-weight:700}.hero-actions,.sub-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px}.linkbtn,.btn,.primary,.secondary,button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:13px 20px;font-weight:800;cursor:pointer}.primary,.btn{background:var(--gold);color:#07183c}.secondary{border:1px solid var(--gold);color:var(--gold);background:transparent}.form-card,.box,.notice,.status-head,.success-box,.member-card,.request-card{background:linear-gradient(145deg,rgba(13,54,124,.92),rgba(8,39,95,.94));border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.18)}.form-card{padding:22px;margin:22px auto;max-width:920px}.form-card.narrow{max-width:560px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:15px}label{display:grid;gap:8px;color:#dce8ff;font-weight:700;margin-bottom:14px}input,textarea,select{width:100%;background:#061a43;border:1px solid #315896;color:#fff;border-radius:11px;padding:13px;font:inherit;outline:none}input:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(213,169,40,.12)}.consent{display:flex;align-items:flex-start;font-weight:400;color:var(--muted);line-height:1.7}.consent input{width:20px;margin-top:3px}.alert{max-width:920px;margin:18px auto;background:#662f32;border:1px solid #df7777;padding:14px;border-radius:12px}.success-box{max-width:760px;margin:30px auto;padding:35px;text-align:center}.success-icon{width:72px;height:72px;margin:auto;border-radius:50%;display:grid;place-items:center;background:var(--ok);font-size:38px;font-weight:bold}.big-no,.member-no,.request-no{direction:ltr;color:var(--gold);font-weight:900;letter-spacing:1px}.big-no{font-size:30px;margin:20px}.hint{color:var(--muted)}.timeline{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:28px 0}.step{position:relative;text-align:center;color:#7188b6;font-size:13px}.step i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;margin:0 auto 8px;background:#16396f;border:2px solid #2c5291;font-style:normal;font-weight:800}.step.done,.step.current{color:#fff}.step.done i{background:var(--ok);border-color:var(--ok)}.step.current i{background:var(--gold);border-color:var(--gold);color:#07183c}.step.current.bad i{background:var(--danger);color:#fff}.timeline.rejected{grid-template-columns:1fr 1fr;max-width:480px;margin:28px auto}.status-head{padding:22px;display:flex;justify-content:space-between;gap:20px;align-items:center}.status-head h1{margin:6px 0}.status-head p{color:var(--muted);margin:0}.badge{display:inline-flex;padding:8px 12px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap;background:#37527f}.badge.review{background:#315f9a}.badge.warn{background:var(--warn)}.badge.ready{background:#6a4aa0}.badge.ok{background:var(--ok)}.badge.danger{background:var(--danger)}.notice{padding:18px;margin:18px 0}.notice b{color:var(--gold)}.notice.warn{border-color:#d49b2f}.member-card{max-width:620px;margin:24px auto;padding:28px;text-align:center;border:2px solid var(--gold)}.member-label{color:var(--gold);font-weight:800}.member-card h2{font-size:28px}.member-card a{display:inline-block;margin-top:10px;color:var(--gold);text-decoration:underline}.admin-head{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:20px}.admin-head h1{margin-bottom:5px}.admin-head p{color:var(--muted);margin:0}.requests{display:grid;gap:14px}.request-card{padding:18px}.request-top{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}.request-top h3{margin:6px 0 0}.request-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0}.request-grid span{background:rgba(4,18,47,.5);padding:11px;border-radius:10px;color:#e3edff}.request-grid b{display:block;color:#92a9d5;font-size:12px;margin-bottom:4px}.note{background:#071c48;padding:11px;border-radius:10px;margin-top:9px}.note.admin{border-right:3px solid var(--gold)}.stage-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.stage-form{display:flex;gap:6px}.stage-form.with-note{flex:1 1 280px}.stage-form input{padding:9px;min-width:170px}.mini{padding:9px 12px;background:#315f9a;color:white}.mini.ok{background:var(--ok)}.mini.danger{background:var(--danger)}
@media(max-width:780px){.publicbar,.adminbar{position:relative;align-items:flex-start;flex-direction:column}.publicbar nav,.adminbar nav{width:100%;overflow:auto;flex-wrap:nowrap;padding-bottom:4px}.publicbar nav a,.adminbar nav a{white-space:nowrap}.grid2,.request-grid{grid-template-columns:1fr}.timeline{grid-template-columns:1fr;gap:6px}.step{display:flex;align-items:center;gap:10px;text-align:right}.step i{margin:0}.status-head,.admin-head,.request-top{align-items:flex-start;flex-direction:column}.stage-actions,.stage-form{width:100%}.stage-form{flex-direction:column}.stage-form button{width:100%}.hero{padding:34px 16px}.wrap{width:min(94%,1180px);padding-top:18px}}
@media print{.publicbar,.adminbar,footer,.sub-actions,.stage-actions,.hero-actions{display:none!important}body{background:white;color:black}.form-card,.box,.notice,.status-head,.success-box,.member-card,.request-card{box-shadow:none;background:white;color:black;border:1px solid #aaa}}
`}
