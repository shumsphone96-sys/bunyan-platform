import app from './worker-global-v25.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const GOLD='#d5a928', BLUE='#0a347c', DARK='#061a43';
const CLUB_WHATSAPP='249912603242';
const MAX_PROOF_BYTES=1024*1024;

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    const p=u.pathname.replace(/\/$/,'')||'/';
    const m=req.method.toUpperCase();

    if(env.DB) await initPlus(env.DB);

    if(p==='/join') return red('/membership');

    // Public payment / document submission.
    if(p==='/membership/payment'){
      if(m==='POST') return submitPayment(req,env);
      return paymentPage(env,u.searchParams);
    }
    if(p==='/membership/payment/success') return paymentSuccess(u.searchParams);

    // Secure all club-admin routes before newer layers that only checked cookie presence.
    let currentAdmin=null;
    if(p.startsWith('/club-admin')){
      currentAdmin=env.DB?await adminSession(req,env.DB):null;
      if(!currentAdmin) return red('/login');
    }

    // New membership management center.
    if(p==='/club-admin/membership') return membershipCenter(env,currentAdmin,u.searchParams);
    if(p==='/club-admin/payments') return paymentsAdmin(env,currentAdmin,u.searchParams);

    let mt=p.match(/^\/club-admin\/applications\/(\d+)\/edit$/);
    if(mt) return m==='POST'?saveApplication(req,env,currentAdmin,Number(mt[1])):editApplication(env,Number(mt[1]));

    mt=p.match(/^\/club-admin\/members\/(\d+)\/edit$/);
    if(mt) return m==='POST'?saveMember(req,env,currentAdmin,Number(mt[1])):editMember(env,Number(mt[1]));

    mt=p.match(/^\/club-admin\/payments\/(\d+)\/status$/);
    if(mt&&m==='POST') return setPaymentStatus(req,env,currentAdmin,Number(mt[1]));

    mt=p.match(/^\/club-admin\/payments\/(\d+)\/proof$/);
    if(mt&&m==='GET') return paymentProof(env,Number(mt[1]));

    // Capture extra membership payment fields and proof before the legacy join handler.
    const joinPost=m==='POST'&&(p==='/membership'||p==='/membership/join');
    let extra=null;
    if(joinPost){
      try{ extra=await extractJoinExtras(req.clone()); }catch(_){ }
    }

    const response=await app.fetch(req,env,ctx);

    if(joinPost&&response.status<400&&env.DB&&extra){
      ctx.waitUntil(afterJoinExtra(env,extra));
    }

    const ct=response.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await response.text();

      if(p==='/'||p==='/membership'||p==='/membership/join') html=enhancePublicMembership(html,p,env);
      if(p==='/applications'||p==='/members'||p==='/club-admin') html=enhanceAdminNavigation(html,p);

      const h=new Headers(response.headers);
      h.delete('content-length');
      h.set('cache-control','no-store, max-age=0');
      h.set('x-wadnofei-ui','v26-membership-payments');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  }
};

async function initPlus(db){
  const creates=[
    `CREATE TABLE IF NOT EXISTS club_payment_submissions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER,
      application_no TEXT,
      member_id INTEGER,
      member_no TEXT,
      payer_name TEXT,
      phone TEXT,
      payment_method TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SDG',
      amount REAL NOT NULL DEFAULT 0,
      reference_no TEXT,
      note TEXT,
      proof_name TEXT,
      proof_mime TEXT,
      proof_data BLOB,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cps_appno ON club_payment_submissions(application_no)`,
    `CREATE INDEX IF NOT EXISTS idx_cps_phone ON club_payment_submissions(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_cps_status ON club_payment_submissions(status)`
  ];
  for(const q of creates){try{await db.prepare(q).run()}catch(_){}}
  const adds=[
    ['applications','payment_method','TEXT'],['applications','payment_currency','TEXT'],['applications','payment_amount','REAL'],
    ['applications','payment_reference','TEXT'],['applications','payment_status','TEXT'],['applications','updated_at','TEXT'],
    ['members','updated_at','TEXT']
  ];
  for(const [t,c,typ] of adds){try{await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} ${typ}`).run()}catch(_){}}
}

async function adminSession(req,db){
  const c=req.headers.get('cookie')||'';
  const x=c.match(/(?:^|;\s*)sid=([^;]+)/);
  if(!x) return null;
  const token=decodeURIComponent(x[1]);
  try{
    const a=await db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(token).first();
    if(a) return a;
  }catch(_){ }
  try{
    const a=await db.prepare(`SELECT u.id,u.username,COALESCE(u.role,'admin') role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(token).first();
    if(a) return a;
  }catch(_){ }
  return null;
}

async function columns(db,table){
  try{const r=await db.prepare(`PRAGMA table_info(${table})`).all();return new Set((r.results||[]).map(x=>x.name));}catch(_){return new Set()}
}
function pick(cols,...names){return names.find(n=>cols.has(n))||null}
function phoneNorm(v){let s=String(v||'').replace(/\D/g,'');if(s.startsWith('0'))s='249'+s.slice(1);if(!s.startsWith('249'))s='249'+s;return s}

async function extractJoinExtras(req){
  const f=await req.formData();
  const proof=f.get('payment_proof');
  return {
    full_name:String(f.get('full_name')||f.get('name')||'').trim(),
    phone:phoneNorm(f.get('phone')),
    method:String(f.get('payment_method')||'').trim(),
    currency:String(f.get('payment_currency')||'SDG').trim(),
    amount:Number(String(f.get('payment_amount')||'0').replace(',','.'))||0,
    reference:String(f.get('payment_reference')||'').trim(),
    note:String(f.get('payment_note')||'').trim(),
    proof:await safeProof(proof)
  };
}

async function safeProof(file){
  if(!file||typeof file==='string'||!file.size) return null;
  if(file.size>MAX_PROOF_BYTES) return {error:'حجم المستند أكبر من 1 ميغابايت'};
  const allowed=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!allowed.includes(file.type)) return {error:'نوع المستند غير مدعوم'};
  const buf=await file.arrayBuffer();
  return {name:String(file.name||'proof'),mime:file.type,data:new Uint8Array(buf)};
}

async function afterJoinExtra(env,x){
  try{
    const cols=await columns(env.DB,'applications');
    const nameCol=pick(cols,'full_name','name');
    const noCol=pick(cols,'application_no','app_no');
    if(!nameCol||!noCol||!cols.has('phone')) return;
    const row=await env.DB.prepare(`SELECT * FROM applications WHERE phone=? ORDER BY id DESC LIMIT 1`).bind(x.phone).first();
    if(!row) return;
    const sets=[],vals=[];
    for(const [c,v] of [['payment_method',x.method],['payment_currency',x.currency],['payment_amount',x.amount],['payment_reference',x.reference],['payment_status',x.method?'pending':null]]){
      if(cols.has(c)&&v!==undefined){sets.push(`${c}=?`);vals.push(v)}
    }
    if(cols.has('updated_at')){sets.push('updated_at=CURRENT_TIMESTAMP')}
    if(sets.length){vals.push(row.id);await env.DB.prepare(`UPDATE applications SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}
    if(x.method||x.reference||x.proof?.data){
      await insertPayment(env.DB,{application_id:row.id,application_no:row[noCol],payer_name:row[nameCol]||x.full_name,phone:x.phone,method:x.method||'مستند دفع',currency:x.currency,amount:x.amount,reference:x.reference,note:x.note,proof:x.proof});
    }
  }catch(_){ }
}

async function submitPayment(req,env){
  if(!env.DB) return H(publicPage('إرسال إثبات الدفع','قاعدة البيانات غير متاحة حالياً.'));
  let f;try{f=await req.formData()}catch(_){return red('/membership/payment?error='+encodeURIComponent('تعذر قراءة النموذج'))}
  const applicationNo=String(f.get('application_no')||'').trim();
  const phone=phoneNorm(f.get('phone'));
  const payer=String(f.get('payer_name')||'').trim();
  const method=String(f.get('payment_method')||'').trim();
  const currency=String(f.get('currency')||'SDG').trim();
  const amount=Number(String(f.get('amount')||'0').replace(',','.'))||0;
  const reference=String(f.get('reference_no')||'').trim();
  const note=String(f.get('note')||'').trim();
  const proof=await safeProof(f.get('proof'));
  if(proof?.error) return red('/membership/payment?error='+encodeURIComponent(proof.error));
  if(!applicationNo||!phone||!method) return red('/membership/payment?error='+encodeURIComponent('أدخل رقم الطلب ورقم الهاتف وطريقة الدفع'));

  const cols=await columns(env.DB,'applications');
  const noCol=pick(cols,'application_no','app_no');
  const nameCol=pick(cols,'full_name','name');
  if(!noCol) return red('/membership/payment?error='+encodeURIComponent('تعذر مطابقة رقم الطلب'));
  let row=null;
  try{row=await env.DB.prepare(`SELECT * FROM applications WHERE ${noCol}=? AND phone=? LIMIT 1`).bind(applicationNo,phone).first()}catch(_){ }
  if(!row) return red('/membership/payment?error='+encodeURIComponent('رقم الطلب أو الهاتف غير مطابق لطلب عضوية مسجل'));
  await insertPayment(env.DB,{application_id:row.id,application_no:applicationNo,payer_name:payer||row[nameCol]||'',phone,method,currency,amount,reference,note,proof});
  try{
    const sets=[],vals=[];
    for(const [c,v] of [['payment_method',method],['payment_currency',currency],['payment_amount',amount],['payment_reference',reference],['payment_status','pending']]) if(cols.has(c)){sets.push(`${c}=?`);vals.push(v)}
    if(cols.has('updated_at')) sets.push('updated_at=CURRENT_TIMESTAMP');
    if(sets.length){vals.push(row.id);await env.DB.prepare(`UPDATE applications SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}
  }catch(_){ }
  return red('/membership/payment/success?no='+encodeURIComponent(applicationNo));
}

async function insertPayment(db,x){
  const proof=x.proof?.data||null;
  await db.prepare(`INSERT INTO club_payment_submissions(application_id,application_no,member_id,member_no,payer_name,phone,payment_method,currency,amount,reference_no,note,proof_name,proof_mime,proof_data,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`)
    .bind(x.application_id||null,x.application_no||null,x.member_id||null,x.member_no||null,x.payer_name||'',x.phone||'',x.method||'',x.currency||'SDG',Number(x.amount||0),x.reference||'',x.note||'',x.proof?.name||null,x.proof?.mime||null,proof).run();
}

function paymentPage(env,sp){
  const err=sp.get('error');
  return H(publicPage('إرسال إثبات الدفع',`
    <section class="hero"><span class="tag">بوابة آمنة للأعضاء</span><h1>إرسال إشعار أو مستند دفع</h1><p>أرسل إشعار بنكك أو ماي كاشي أو فوري أو إيصال التحويل، وسيظهر مباشرة للإدارة للمراجعة.</p></section>
    ${err?`<div class="alert bad">${e(err)}</div>`:''}
    <form class="form" method="post" enctype="multipart/form-data" action="/membership/payment">
      <label>رقم طلب العضوية<input name="application_no" placeholder="WDN-REQ-00003" required></label>
      <label>رقم الهاتف<input name="phone" inputmode="tel" placeholder="09xxxxxxxx" required></label>
      <label>اسم صاحب الدفع<input name="payer_name" placeholder="الاسم كما يظهر في التحويل"></label>
      <label>طريقة الدفع<select name="payment_method" required>${paymentOptions()}</select></label>
      <label>العملة<select name="currency">${currencyOptions()}</select></label>
      <label>المبلغ<input name="amount" inputmode="decimal" type="number" step="0.01" min="0" placeholder="0.00"></label>
      <label>رقم العملية / المرجع<input name="reference_no" placeholder="اختياري"></label>
      <label class="wide">ملاحظات<textarea name="note" rows="3" placeholder="أي تفاصيل إضافية"></textarea></label>
      <label class="wide upload">إرفاق إشعار البنك أو أي مستند<input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"><small>صورة أو PDF أو Word — بحد أقصى 1MB</small></label>
      <button class="primary wide">إرسال للإدارة</button>
    </form>
    <div class="actions"><a class="secondary" href="/membership">تسجيل عضوية جديدة</a><a class="wa" href="https://wa.me/${env.PUBLIC_WHATSAPP_NUMBER||CLUB_WHATSAPP}">مراسلة النادي عبر واتساب</a></div>
  `));
}

function paymentSuccess(sp){return H(publicPage('تم استلام المستند',`<section class="hero"><span class="tag">تم بنجاح</span><h1>وصل إشعار الدفع للإدارة ✅</h1><p>رقم الطلب: <b>${e(sp.get('no')||'—')}</b></p><p>سيتم مراجعته وتحديث حالته في النظام.</p></section><div class="actions"><a class="primaryLink" href="/membership/track">متابعة الطلب</a><a class="secondary" href="/">الرئيسية</a></div>`))}

async function membershipCenter(env,a,sp){
  const db=env.DB;if(!db)return H(adminPage('إدارة العضوية','قاعدة البيانات غير متاحة.'));
  const appCols=await columns(db,'applications'), memCols=await columns(db,'members');
  const appNo=pick(appCols,'application_no','app_no'), appName=pick(appCols,'full_name','name');
  const memNo=pick(memCols,'member_no'), memName=pick(memCols,'full_name','name');
  let apps=[],members=[],pay=[];
  try{apps=(await db.prepare(`SELECT * FROM applications ORDER BY id DESC LIMIT 100`).all()).results||[]}catch(_){ }
  try{members=(await db.prepare(`SELECT * FROM members ORDER BY id DESC LIMIT 100`).all()).results||[]}catch(_){ }
  try{pay=(await db.prepare(`SELECT * FROM club_payment_submissions ORDER BY id DESC LIMIT 12`).all()).results||[]}catch(_){ }
  const q=String(sp.get('q')||'').trim().toLowerCase();
  const af=q?apps.filter(x=>JSON.stringify(x).toLowerCase().includes(q)):apps;
  const mf=q?members.filter(x=>JSON.stringify(x).toLowerCase().includes(q)):members;
  const body=`
  <section class="hero"><span class="tag">مركز العضوية</span><h1>العضوية من التسجيل حتى الاعتماد</h1><p>تعديل البيانات، مراجعة الطلبات، المدفوعات والمستندات في مكان واحد.</p></section>
  <div class="stats"><div><b>${apps.length}</b><span>طلبات</span></div><div><b>${members.length}</b><span>أعضاء</span></div><div><b>${pay.filter(x=>x.status==='pending').length}</b><span>دفعات تنتظر المراجعة</span></div></div>
  <form class="search"><input name="q" value="${e(sp.get('q')||'')}" placeholder="ابحث بالاسم أو الهاتف أو رقم الطلب"><button>بحث</button></form>
  <div class="tabs"><a href="#applications">طلبات العضوية</a><a href="#members">الأعضاء</a><a href="/club-admin/payments">المدفوعات والمستندات</a><a href="/membership" target="_blank">فتح التسجيل العام</a></div>
  <h2 id="applications">طلبات العضوية</h2><div class="cards">${af.length?af.map(x=>`<article><div><b>${e(x[appName]||'—')}</b><span class="pill">${e(x.status||x.review_stage||'pending')}</span></div><p>${e(x[appNo]||'')} · <span dir="ltr">+${e(phoneNorm(x.phone||''))}</span></p><a class="edit" href="/club-admin/applications/${x.id}/edit">تعديل البيانات</a></article>`).join(''):'<article>لا توجد طلبات.</article>'}</div>
  <h2 id="members">الأعضاء المعتمدون</h2><div class="cards">${mf.length?mf.map(x=>`<article><div><b>${e(x[memName]||'—')}</b><span class="pill">${e(x.status||'active')}</span></div><p>${e(memNo?x[memNo]:'')} · <span dir="ltr">+${e(phoneNorm(x.phone||''))}</span></p><a class="edit" href="/club-admin/members/${x.id}/edit">تعديل بيانات العضو</a></article>`).join(''):'<article>لا توجد عضويات معتمدة.</article>'}</div>`;
  return H(adminPage('مركز إدارة العضوية',body));
}

async function editApplication(env,id){
  const db=env.DB,cols=await columns(db,'applications');
  const row=await db.prepare('SELECT * FROM applications WHERE id=?').bind(id).first();
  if(!row)return H(adminPage('تعديل الطلب','الطلب غير موجود.'),404);
  const name=pick(cols,'full_name','name'), no=pick(cols,'application_no','app_no');
  return H(adminPage('تعديل طلب العضوية',editForm(`/club-admin/applications/${id}/edit`,[
    ['رقم الطلب',no,row[no],true],['الاسم الكامل',name,row[name],false],['رقم الهاتف','phone',row.phone,false],['العنوان','address',row.address,false],['تاريخ الميلاد','dob',row.dob,false],['المهنة','job',row.job,false],['نوع العضوية','member_type',row.member_type,false],['ملاحظات','notes',row.notes||row.admin_note||row.review_note,false]
  ],'حفظ التعديلات')+`<a class="secondary" href="/club-admin/membership">إلغاء والعودة</a>`));
}

async function saveApplication(req,env,a,id){
  const db=env.DB,cols=await columns(db,'applications');
  const f=await req.formData();
  const aliases=[['full_name','name'],['phone'],['address'],['dob'],['job'],['member_type'],['notes','admin_note','review_note']];
  const sets=[],vals=[];
  for(const group of aliases){const c=group.find(x=>cols.has(x));if(c){const key=group[0];let val=String(f.get(key)||'').trim();if(key==='phone')val=phoneNorm(val);sets.push(`${c}=?`);vals.push(val)}}
  if(cols.has('updated_at'))sets.push('updated_at=CURRENT_TIMESTAMP');
  if(sets.length){vals.push(id);await db.prepare(`UPDATE applications SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}
  await audit(db,a,'edit_application',String(id));
  return red('/club-admin/membership?updated=1');
}

async function editMember(env,id){
  const db=env.DB,cols=await columns(db,'members');
  const row=await db.prepare('SELECT * FROM members WHERE id=?').bind(id).first();
  if(!row)return H(adminPage('تعديل العضو','العضو غير موجود.'),404);
  const name=pick(cols,'full_name','name'), no=pick(cols,'member_no');
  return H(adminPage('تعديل بيانات العضو',editForm(`/club-admin/members/${id}/edit`,[
    ['رقم العضوية',no,row[no],true],['الاسم الكامل',name,row[name],false],['رقم الهاتف','phone',row.phone,false],['العنوان','address',row.address,false],['تاريخ الميلاد','dob',row.dob,false],['المهنة','job',row.job,false],['نوع العضوية','member_type',row.member_type,false],['ملاحظات','notes',row.notes,false]
  ],'حفظ بيانات العضو')+`<a class="secondary" href="/club-admin/membership">إلغاء والعودة</a>`));
}

async function saveMember(req,env,a,id){
  const db=env.DB,cols=await columns(db,'members'),f=await req.formData();
  const aliases=[['full_name','name'],['phone'],['address'],['dob'],['job'],['member_type'],['notes']];
  const sets=[],vals=[];
  for(const group of aliases){const c=group.find(x=>cols.has(x));if(c){let val=String(f.get(group[0])||'').trim();if(group[0]==='phone')val=phoneNorm(val);sets.push(`${c}=?`);vals.push(val)}}
  if(cols.has('updated_at'))sets.push('updated_at=CURRENT_TIMESTAMP');
  if(sets.length){vals.push(id);await db.prepare(`UPDATE members SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}
  await audit(db,a,'edit_member',String(id));
  return red('/club-admin/membership?updated=1');
}

async function paymentsAdmin(env,a,sp){
  const db=env.DB;let rows=[];
  try{rows=(await db.prepare('SELECT * FROM club_payment_submissions ORDER BY id DESC LIMIT 300').all()).results||[]}catch(_){ }
  const status=String(sp.get('status')||'');if(status)rows=rows.filter(x=>x.status===status);
  const cards=rows.length?rows.map(x=>`<article><div><b>${e(x.payer_name||'بدون اسم')}</b><span class="pill ${e(x.status)}">${statusLabel(x.status)}</span></div><p>${e(x.application_no||x.member_no||'')} · ${methodLabel(x.payment_method)} · <b>${money(x.amount,x.currency)}</b></p><small>مرجع: ${e(x.reference_no||'—')} · <span dir="ltr">+${e(x.phone||'')}</span> · ${e(x.created_at||'')}</small>${x.note?`<p>${e(x.note)}</p>`:''}<div class="row">${x.proof_data?`<a class="secondary" href="/club-admin/payments/${x.id}/proof">فتح المستند</a>`:'<span class="muted">بدون مرفق</span>'}<form method="post" action="/club-admin/payments/${x.id}/status"><button name="status" value="approved" class="approve">اعتماد</button><button name="status" value="rejected" class="reject">رفض</button></form></div></article>`).join(''):'<article>لا توجد دفعات أو مستندات حتى الآن.</article>';
  return H(adminPage('المدفوعات والمستندات',`<section class="hero"><span class="tag">مراجعة مالية</span><h1>إشعارات البنوك والمستندات</h1><p>بنكك، ماي كاشي، فوري والتحويلات بمختلف العملات.</p></section><div class="tabs"><a href="/club-admin/payments">الكل</a><a href="?status=pending">قيد المراجعة</a><a href="?status=approved">معتمد</a><a href="?status=rejected">مرفوض</a></div><div class="cards">${cards}</div>`));
}

async function setPaymentStatus(req,env,a,id){
  const f=await req.formData();const s=String(f.get('status')||'pending');
  if(!['pending','approved','rejected'].includes(s))return red('/club-admin/payments');
  await env.DB.prepare(`UPDATE club_payment_submissions SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(s,a?.username||'admin',id).run();
  const row=await env.DB.prepare('SELECT application_id FROM club_payment_submissions WHERE id=?').bind(id).first();
  if(row?.application_id){const cols=await columns(env.DB,'applications');if(cols.has('payment_status'))try{await env.DB.prepare('UPDATE applications SET payment_status=? WHERE id=?').bind(s,row.application_id).run()}catch(_){}}
  await audit(env.DB,a,'payment_'+s,String(id));
  return red('/club-admin/payments');
}

async function paymentProof(env,id){
  const x=await env.DB.prepare('SELECT proof_name,proof_mime,proof_data FROM club_payment_submissions WHERE id=?').bind(id).first();
  if(!x?.proof_data)return new Response('المستند غير موجود',{status:404});
  const data=x.proof_data instanceof ArrayBuffer?x.proof_data:new Uint8Array(x.proof_data);
  const name=String(x.proof_name||'payment-proof').replace(/["\r\n]/g,'_');
  return new Response(data,{headers:{'content-type':x.proof_mime||'application/octet-stream','content-disposition':`inline; filename="${name}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}

function enhancePublicMembership(html,p,env){
  const css=`<style id="wdn-v26-public">.wdn-public-cta{margin:18px auto;padding:20px;border:1px solid ${GOLD}88;border-radius:22px;background:linear-gradient(135deg,#08265d,#0d3b86);box-shadow:0 14px 40px #0003}.wdn-public-cta h2{color:${GOLD};margin:0 0 8px}.wdn-public-cta p{line-height:1.8}.wdn-public-actions{display:flex;gap:10px;flex-wrap:wrap}.wdn-public-actions a{padding:12px 15px;border-radius:12px;font-weight:900;text-decoration:none}.wdn-join{background:${GOLD};color:${DARK}!important}.wdn-pay{background:#fff;color:${DARK}!important}.wdn-wa{background:#25D366;color:#06233f!important}.wdn-pay-fields{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;grid-column:1/-1;padding:15px;border:1px dashed #d5a92888;border-radius:16px;background:#061a4322}.wdn-pay-fields h3{grid-column:1/-1;color:${GOLD};margin:0}.wdn-pay-fields label{display:flex;flex-direction:column;gap:7px}.wdn-pay-fields select,.wdn-pay-fields input{width:100%;padding:12px;border-radius:10px;border:1px solid #ccc}.wdn-pay-fields .wide{grid-column:1/-1}@media(max-width:680px){.wdn-pay-fields{grid-template-columns:1fr}}</style>`;
  if(html.includes('</head>'))html=html.replace('</head>',css+'</head>');
  const cta=`<section class="wdn-public-cta"><h2>عضوية نادي ود نفيع متاحة للجميع</h2><p>سجّل طلبك إلكترونياً، تابع حالته، وأرسل إثبات الدفع أو أي مستند من نفس البوابة.</p><div class="wdn-public-actions"><a class="wdn-join" href="/membership">سجّل عضويتك الآن</a><a class="wdn-pay" href="/membership/payment">إرسال إشعار دفع / مستند</a><a class="wdn-wa" href="https://wa.me/${env.PUBLIC_WHATSAPP_NUMBER||CLUB_WHATSAPP}">واتساب النادي</a></div></section>`;
  if(p==='/'){
    html=html.replace(/<main[^>]*>/,x=>x+cta);
  }else{
    html=html.replace(/<main[^>]*>/,x=>x+cta);
    // Add optional payment details directly to the public membership form.
    const extra=`<div class="wdn-pay-fields"><h3>الدفع وإثبات التحويل (اختياري وقت التسجيل)</h3><label>طريقة الدفع<select name="payment_method"><option value="">الدفع لاحقاً</option>${paymentOptions(false)}</select></label><label>العملة<select name="payment_currency">${currencyOptions()}</select></label><label>المبلغ<input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00"></label><label>رقم العملية / المرجع<input name="payment_reference" placeholder="اختياري"></label><label class="wide">إشعار البنك أو المستند<input type="file" name="payment_proof" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"><small>حتى 1MB</small></label><label class="wide">ملاحظة الدفع<input name="payment_note" placeholder="اختياري"></label></div>`;
    html=html.replace(/<form([^>]*)(action=["']\/membership(?:\/join)?["'][^>]*)>/i,(all,a,b)=>`<form${a}${b} enctype="multipart/form-data">`);
    html=html.replace(/(<form[^>]*action=["']\/membership(?:\/join)?["'][\s\S]*?)(<button[^>]*>)/i,`$1${extra}$2`);
  }
  return html;
}

function enhanceAdminNavigation(html,p){
  const css=`<style id="wdn-v26-adminnav">.wdn-v26bar{margin:16px 0;padding:14px;border:1px solid #d5a92866;border-radius:16px;background:#061a4388;display:flex;gap:10px;flex-wrap:wrap}.wdn-v26bar a{background:#d5a928;color:#061a43!important;padding:10px 13px;border-radius:11px;text-decoration:none;font-weight:900}.wdn-v26bar a:nth-child(2){background:#fff}.wdn-v26bar a:nth-child(3){background:#25D366}</style>`;
  if(html.includes('</head>'))html=html.replace('</head>',css+'</head>');
  const bar=`<div class="wdn-v26bar"><a href="/club-admin/membership">مركز العضوية والتعديل</a><a href="/club-admin/payments">المدفوعات والمستندات</a><a href="/membership" target="_blank">فتح التسجيل العام</a></div>`;
  html=html.replace(/<main[^>]*>/,x=>x+bar);
  return html;
}

function editForm(action,fields,button){return `<form class="form" method="post" action="${action}">${fields.filter(x=>x[1]).map(([label,name,value,readonly])=>`<label>${e(label)}<input name="${e(name==='name'?'full_name':name)}" value="${e(value||'')}" ${readonly?'readonly':''}></label>`).join('')}<button class="primary wide">${e(button)}</button></form>`}

function paymentOptions(includePlaceholder=true){return `${includePlaceholder?'<option value="">اختر الطريقة</option>':''}<option value="bankak">بنكك</option><option value="mycashy">ماي كاشي</option><option value="fawry">فوري</option><option value="bank_transfer">تحويل مصرفي</option><option value="cash">نقدي</option><option value="whatsapp_proof">إثبات دفع عبر واتساب</option>`}
function currencyOptions(){return `<option value="SDG">جنيه سوداني (SDG)</option><option value="SAR">ريال سعودي (SAR)</option><option value="QAR">ريال قطري (QAR)</option><option value="USD">دولار أمريكي (USD)</option>`}
function methodLabel(v){return ({bankak:'بنكك',mycashy:'ماي كاشي',fawry:'فوري',bank_transfer:'تحويل مصرفي',cash:'نقدي',whatsapp_proof:'واتساب'})[v]||e(v||'—')}
function statusLabel(v){return ({pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض'})[v]||e(v||'—')}
function money(n,c){const labels={SDG:'ج.س',SAR:'ر.س',QAR:'ر.ق',USD:'$'};return `${new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(Number(n||0))} ${labels[c]||e(c||'')}`}

async function audit(db,a,action,target){try{await db.prepare(`INSERT INTO audit_log(admin_id,username,role,action,target_type,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(a?.id||null,a?.username||'system',a?.role||'admin',action,target).run()}catch(_){}}

function publicPage(title,body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${DARK}"><title>${e(title)} · ${CLUB}</title><style>${baseCss()}</style></head><body><header><a href="/"><img src="/wdn-logo.jpg" alt="شعار النادي"><span><b>${CLUB}</b><small>تأسس عام 1964</small></span></a><nav><a href="/membership">التسجيل</a><a href="/membership/track">متابعة الطلب</a><a href="/membership/payment">الدفع والمستندات</a></nav></header><main>${body}</main><footer>نادي ود نفيع · الرياضي · الثقافي · الاجتماعي</footer></body></html>`}
function adminPage(title,body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${DARK}"><title>${e(title)} · ${CLUB}</title><style>${baseCss()}</style></head><body><header><a href="/club-admin"><img src="/wdn-logo.jpg" alt="شعار النادي"><span><b>${CLUB}</b><small>لوحة الإدارة</small></span></a><nav><a href="/club-admin/membership">العضوية</a><a href="/club-admin/payments">المدفوعات</a><a href="/club-admin/notifications">الإشعارات</a><a href="/club-admin">المركز</a></nav></header><main><h1>${e(title)}</h1>${body}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function baseCss(){return `:root{--g:${GOLD};--b:${BLUE};--d:${DARK}}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,var(--d),var(--b));color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{position:sticky;top:0;z-index:10;background:#061a43f2;border-bottom:1px solid #d5a92855;padding:12px 4%;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}header>a{display:flex;align-items:center;gap:9px;text-decoration:none;color:#fff}header img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:13px;padding:3px}header span{display:grid}header b,h1,h2{color:var(--g)}header small{opacity:.72}nav{display:flex;gap:9px;flex-wrap:wrap}nav a{color:#fff;text-decoration:none;font-weight:800}main{width:min(980px,92%);margin:28px auto}.hero{background:linear-gradient(135deg,#08265d,#0d3b86);border:1px solid #d5a92866;border-radius:24px;padding:22px;box-shadow:0 14px 40px #0003;margin-bottom:18px}.hero h1{font-size:clamp(1.6rem,5vw,2.6rem);margin:.3em 0}.hero p{line-height:1.9}.tag{display:inline-block;background:#d5a92822;color:#ffd65b;border:1px solid #d5a92877;border-radius:999px;padding:6px 10px;font-weight:900}.form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;background:#08265dcc;border:1px solid #d5a92866;padding:18px;border-radius:20px}.form label{display:flex;flex-direction:column;gap:7px;color:#f8dfa0;font-weight:800}.form input,.form select,.form textarea,.search input{padding:12px;border-radius:12px;border:1px solid #d5a92888;background:#fff;color:#111;font:inherit}.wide{grid-column:1/-1}.upload{border:1px dashed #d5a92888;padding:12px;border-radius:12px}.primary,.approve,.reject,.search button{border:0;border-radius:12px;padding:12px 15px;font-weight:900;cursor:pointer}.primary,.approve,.search button{background:var(--g);color:var(--d)}.reject{background:#7a2430;color:#fff}.actions,.tabs,.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.actions a,.tabs a,.secondary,.edit,.primaryLink,.wa{display:inline-block;text-decoration:none;padding:11px 14px;border-radius:12px;font-weight:900}.secondary,.edit{background:#fff;color:var(--d)!important}.primaryLink{background:var(--g);color:var(--d)!important}.wa{background:#25D366;color:#06233f!important}.cards{display:grid;gap:12px}.cards article{background:#08265dcc;border:1px solid #d5a92866;border-radius:17px;padding:15px}.cards article>div:first-child{display:flex;justify-content:space-between;gap:10px;align-items:center}.pill{background:#ffffff18;padding:5px 9px;border-radius:999px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0}.stats>div{background:#08265d;border:1px solid #d5a92855;border-radius:16px;padding:15px;text-align:center}.stats b{display:block;color:#ffd65b;font-size:1.5rem}.stats span{opacity:.8}.search{display:flex;gap:8px;margin:15px 0}.search input{flex:1}.alert{padding:12px;border-radius:12px;margin-bottom:12px}.bad{background:#7a2430}.muted{opacity:.65}footer{text-align:center;padding:28px;color:#e8d49b}@media(max-width:700px){.form{grid-template-columns:1fr}.wide{grid-column:auto}.stats{grid-template-columns:1fr}.search{flex-direction:column}}`}
function H(x,status=200){return new Response(x,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'}})}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
