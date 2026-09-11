import app from './worker-global-v56.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(!env.DB) return app.fetch(req,env,ctx);

    if(p.startsWith('/club-admin')){
      const admin=await adminSession(req,env.DB);
      if(!admin) return red('/login');
      await ensureV57(env.DB);

      if(p==='/club-admin/overview'&&m==='GET') return overview(env.DB);
      if(p==='/club-admin/finance'&&m==='GET') return finance(env.DB,u.searchParams);
      if(p==='/club-admin/ledger'&&m==='GET') return ledger(env.DB,u.searchParams);
      if(p==='/club-admin/ledger'&&m==='POST') return addLedger(req,env.DB,admin);
      if(p==='/club-admin/reports'&&m==='GET') return reports(env.DB,u.searchParams);
      if(p==='/club-admin/reports.csv'&&m==='GET') return reportsCsv(env.DB);

      let x=p.match(/^\/club-admin\/payments\/(\d+)\/review$/);
      if(x&&m==='POST') return reviewPayment(req,env.DB,admin,Number(x[1]));

      x=p.match(/^\/club-admin\/member\/(\d+)$/);
      if(x&&m==='GET') return memberProfile(env.DB,Number(x[1]));
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&p==='/club-admin/memberships'){
      let html=await r.text();
      html=html.replace(/<article class="member-row">/g,'<article class="member-row">');
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v57-complete-club-ops');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensureV57(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_finance_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,entry_type TEXT NOT NULL,currency TEXT NOT NULL DEFAULT 'SDG',amount REAL NOT NULL DEFAULT 0,category TEXT,note TEXT,reference_no TEXT,member_id INTEGER,payment_id INTEGER,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_cfe_type ON club_finance_entries(entry_type)`,
    `CREATE INDEX IF NOT EXISTS idx_cfe_created ON club_finance_entries(created_at)`,
    `CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_cal_created ON club_audit_log(created_at)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
  for(const [t,c,typ] of [['club_payment_submissions','renewal_months','INTEGER'],['club_payment_submissions','review_note','TEXT'],['members','membership_expires_at','TEXT'],['members','updated_at','TEXT']]){
    const cc=await cols(db,t);if(!cc.has(c)){try{await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} ${typ}`).run()}catch(_){}}
  }
}

async function adminSession(req,db){
  const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username,COALESCE(u.role,'admin') role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}
}
async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return new Set((r.results||[]).map(x=>x.name))}catch(_){return new Set()}}
async function one(db,q,b=[]){try{return await db.prepare(q).bind(...b).first()}catch(_){return null}}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function n(db,q,b=[]){return Number((await one(db,q,b))?.c||0)}
async function audit(db,a,action,type,id,details=''){try{await db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`).bind(a?.username||'admin',action,type,String(id??''),details).run()}catch(_){}}

async function overview(db){
  const mc=await cols(db,'members'),ac=await cols(db,'applications');
  const exp=mc.has('membership_expires_at')?'membership_expires_at':null,ms=mc.has('status')?'status':null,as=ac.has('status')?'status':null;
  const vals=[
    ['طلبات العضوية',await n(db,'SELECT COUNT(*) c FROM applications')],
    ['تحت المتابعة',as?await n(db,`SELECT COUNT(*) c FROM applications WHERE ${as} IN ('pending','review','needs-info','ready')`):0],
    ['إجمالي الأعضاء',await n(db,'SELECT COUNT(*) c FROM members')],
    ['أعضاء نشطون',ms?await n(db,`SELECT COUNT(*) c FROM members WHERE COALESCE(${ms},'active')='active'`):await n(db,'SELECT COUNT(*) c FROM members')],
    ['تنتهي خلال 30 يوم',exp?await n(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})>datetime('now') AND datetime(${exp})<=datetime('now','+30 days')`):0],
    ['عضويات منتهية',exp?await n(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})<=datetime('now')`):0],
    ['مدفوعات للمراجعة',await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE COALESCE(status,'pending')='pending'`)],
    ['إشعارات تحتاج متابعة',await n(db,`SELECT COUNT(*) c FROM club_notifications WHERE status IN ('waiting_template','failed')`)]
  ];
  const body=`<div class="stats">${vals.map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>${nav()}<section class="panel"><h2>مركز التشغيل</h2><p>الإدارة الآن مجمعة: العضوية، المالية، المراجعة، التقارير، البطاقات وواتساب من لوحة واحدة.</p></section>`;
  return H('لوحة الإدارة التنفيذية',body);
}

async function finance(db,sp){
  const status=String(sp.get('status')||'all');
  let q='SELECT * FROM club_payment_submissions',b=[];
  if(status!=='all'){q+=' WHERE status=?';b=[status]}
  q+=' ORDER BY id DESC LIMIT 150';
  const rows=await many(db,q,b);
  const income=await many(db,`SELECT currency,ROUND(SUM(amount),2) total FROM club_finance_entries WHERE entry_type='income' GROUP BY currency`);
  const expense=await many(db,`SELECT currency,ROUND(SUM(amount),2) total FROM club_finance_entries WHERE entry_type='expense' GROUP BY currency`);
  const cards=rows.length?rows.map(paymentCard).join(''):'<div class="empty">لا توجد مدفوعات بهذه الحالة.</div>';
  const body=`<div class="stats"><div class="stat"><b>${await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE status='pending'`)}</b><span>قيد المراجعة</span></div><div class="stat"><b>${await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE status='approved'`)}</b><span>معتمدة</span></div><div class="stat"><b>${fmtMoney(income)}</b><span>دخل مسجل</span></div><div class="stat"><b>${fmtMoney(expense)}</b><span>مصروف مسجل</span></div></div>${nav()}<div class="filters"><a href="?status=all">الكل</a><a href="?status=pending">قيد المراجعة</a><a href="?status=approved">معتمد</a><a href="?status=rejected">مرفوض</a></div><section class="panel"><h2>مراجعة المدفوعات</h2>${cards}</section>`;
  return H('المدفوعات والمالية',body);
}

function paymentCard(x){
  const st=String(x.status||'pending');
  return `<article class="pay"><div class="paytop"><b>${esc(x.payer_name||x.member_no||x.application_no||'دفعة')}</b><span class="pill ${st}">${label(st)}</span></div><p>${esc(x.application_no||x.member_no||'')} · ${esc(x.phone||'')}</p><strong>${esc(x.currency||'SDG')} ${esc(x.amount||0)}</strong><small>${esc(x.payment_method||'—')} · ${esc(x.reference_no||'بدون مرجع')} · ${esc(x.created_at||'')}</small>${x.proof_name?`<a class="mini" href="/club-admin/payments/${Number(x.id)}/proof">فتح الإثبات</a>`:''}${st==='pending'?`<form class="review" method="post" action="/club-admin/payments/${Number(x.id)}/review"><select name="decision"><option value="approved">اعتماد</option><option value="rejected">رفض</option></select><select name="months"><option value="1">تجديد شهر</option><option value="3">3 أشهر</option><option value="6">6 أشهر</option><option value="12" selected>سنة</option></select><input name="note" placeholder="ملاحظة المراجعة"><button>تنفيذ القرار</button></form>`:`<small>مراجعة: ${esc(x.review_note||'—')}</small>`}</article>`;
}

async function reviewPayment(req,db,admin,id){
  const f=await req.formData(),decision=f.get('decision')==='rejected'?'rejected':'approved',months=Math.max(1,Math.min(24,Number(f.get('months')||12))),note=String(f.get('note')||'').trim();
  const p=await one(db,'SELECT * FROM club_payment_submissions WHERE id=?',[id]);if(!p)return red('/club-admin/finance');
  if(String(p.status||'pending')!=='pending')return red('/club-admin/finance');
  await db.prepare(`UPDATE club_payment_submissions SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,renewal_months=?,review_note=? WHERE id=?`).bind(decision,admin.username||'admin',months,note,id).run();
  if(decision==='approved'){
    let member=null;
    if(p.member_id) member=await one(db,'SELECT * FROM members WHERE id=?',[p.member_id]);
    if(!member&&p.member_no){const c=await cols(db,'members'),mn=c.has('member_no')?'member_no':(c.has('membership_no')?'membership_no':null);if(mn)member=await one(db,`SELECT * FROM members WHERE ${mn}=? LIMIT 1`,[p.member_no])}
    if(!member&&p.application_id){const a=await one(db,'SELECT * FROM applications WHERE id=?',[p.application_id]);if(a?.member_id)member=await one(db,'SELECT * FROM members WHERE id=?',[a.member_id])}
    if(member){
      const mc=await cols(db,'members');
      if(mc.has('membership_expires_at')){
        const now=new Date();let base=member.membership_expires_at?new Date(member.membership_expires_at):now;if(!(base>now))base=now;base.setMonth(base.getMonth()+months);
        const sets=['membership_expires_at=?'],vals=[base.toISOString()];if(mc.has('status')){sets.push("status='active'")}if(mc.has('updated_at'))sets.push('updated_at=CURRENT_TIMESTAMP');vals.push(member.id);
        await db.prepare(`UPDATE members SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
      }
    }
    await db.prepare(`INSERT INTO club_finance_entries(entry_type,currency,amount,category,note,reference_no,member_id,payment_id,created_by) VALUES('income',?,?,?,?,?,?,?,?)`).bind(p.currency||'SDG',Number(p.amount||0),'اشتراك عضوية',note||'اعتماد دفعة عضوية',p.reference_no||'',member?.id||p.member_id||null,id,admin.username||'admin').run();
  }
  await audit(db,admin,'payment_review','payment',id,`${decision}; months=${months}; ${note}`);
  return red('/club-admin/finance?status='+decision);
}

async function ledger(db){
  const rows=await many(db,'SELECT * FROM club_finance_entries ORDER BY id DESC LIMIT 200');
  const totals=await many(db,`SELECT currency,entry_type,ROUND(SUM(amount),2) total FROM club_finance_entries GROUP BY currency,entry_type ORDER BY currency`);
  const body=`${nav()}<div class="stats">${totals.map(x=>`<div class="stat"><b>${esc(x.currency)} ${esc(x.total)}</b><span>${x.entry_type==='income'?'دخل':'مصروف'}</span></div>`).join('')||'<div class="stat"><b>0</b><span>لا توجد حركة بعد</span></div>'}</div><section class="panel"><h2>إضافة حركة مالية</h2><form class="gridform" method="post"><select name="entry_type"><option value="income">دخل</option><option value="expense">مصروف</option></select><select name="currency"><option>SDG</option><option>SAR</option><option>QAR</option><option>USD</option></select><input type="number" step="0.01" min="0" name="amount" placeholder="المبلغ" required><input name="category" placeholder="البند" required><input name="reference_no" placeholder="المرجع"><input name="note" placeholder="البيان"><button>حفظ الحركة</button></form></section><section class="panel"><h2>دفتر الحركة</h2>${rows.map(x=>`<article><div><b>${x.entry_type==='income'?'دخل':'مصروف'} · ${esc(x.category||'')}</b><strong>${esc(x.currency)} ${esc(x.amount)}</strong></div><small>${esc(x.note||'')} · ${esc(x.reference_no||'')} · ${esc(x.created_at||'')}</small></article>`).join('')||'لا توجد حركات.'}</section>`;
  return H('دفتر المالية',body);
}
async function addLedger(req,db,admin){const f=await req.formData(),type=f.get('entry_type')==='expense'?'expense':'income',currency=String(f.get('currency')||'SDG'),amount=Math.max(0,Number(f.get('amount')||0)),cat=String(f.get('category')||'').trim(),note=String(f.get('note')||'').trim(),ref=String(f.get('reference_no')||'').trim();if(amount>0&&cat)await db.prepare(`INSERT INTO club_finance_entries(entry_type,currency,amount,category,note,reference_no,created_by) VALUES(?,?,?,?,?,?,?)`).bind(type,currency,amount,cat,note,ref,admin.username||'admin').run();await audit(db,admin,'ledger_add','finance','',`${type}; ${currency} ${amount}; ${cat}`);return red('/club-admin/ledger')}

async function memberProfile(db,id){
  const m=await one(db,'SELECT * FROM members WHERE id=?',[id]);if(!m)return H('ملف العضو','<div class="empty">العضو غير موجود.</div>',404);
  const pays=await many(db,'SELECT * FROM club_payment_submissions WHERE member_id=? OR member_no=? ORDER BY id DESC LIMIT 50',[id,m.member_no||m.membership_no||'']);
  const ledgerRows=await many(db,'SELECT * FROM club_finance_entries WHERE member_id=? ORDER BY id DESC LIMIT 50',[id]);
  const body=`${nav()}<section class="profile"><h2>${esc(m.full_name||m.name||'عضو')}</h2><div class="meta"><span>رقم العضوية: <b>${esc(m.member_no||m.membership_no||'—')}</b></span><span>الهاتف: <b>${esc(m.phone||'—')}</b></span><span>الحالة: <b>${esc(m.status||'active')}</b></span><span>صالح حتى: <b>${esc(m.membership_expires_at||'غير محدد')}</b></span></div>${m.qr_token?`<a class="big" href="/member-card/${encodeURIComponent(m.qr_token)}">فتح بطاقة العضوية</a>`:''}</section><section class="panel"><h2>مدفوعات العضو</h2>${pays.map(x=>`<article><div><b>${esc(x.currency||'SDG')} ${esc(x.amount||0)}</b><span class="pill ${esc(x.status||'pending')}">${label(x.status||'pending')}</span></div><small>${esc(x.payment_method||'')} · ${esc(x.created_at||'')}</small></article>`).join('')||'لا توجد مدفوعات مرتبطة.'}</section><section class="panel"><h2>الحركة المالية المرتبطة</h2>${ledgerRows.map(x=>`<article><div><b>${x.entry_type==='income'?'دخل':'مصروف'} · ${esc(x.category||'')}</b><strong>${esc(x.currency)} ${esc(x.amount)}</strong></div><small>${esc(x.created_at||'')}</small></article>`).join('')||'لا توجد حركة.'}</section>`;
  return H('ملف العضو',body);
}

async function reports(db){
  const currencies=await many(db,`SELECT currency,SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END) income,SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END) expense FROM club_finance_entries GROUP BY currency ORDER BY currency`);
  const latest=await many(db,'SELECT * FROM club_audit_log ORDER BY id DESC LIMIT 80');
  const body=`${nav()}<div class="stats"><div class="stat"><b>${await n(db,'SELECT COUNT(*) c FROM members')}</b><span>إجمالي الأعضاء</span></div><div class="stat"><b>${await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE status='approved'`)}</b><span>دفعات معتمدة</span></div><div class="stat"><b>${await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE status='pending'`)}</b><span>دفعات قيد المراجعة</span></div><div class="stat"><b>${await n(db,'SELECT COUNT(*) c FROM club_audit_log')}</b><span>أحداث إدارية مسجلة</span></div></div><section class="panel"><h2>ملخص مالي حسب العملة</h2>${currencies.map(x=>`<article><div><b>${esc(x.currency)}</b><span>الدخل ${esc(Number(x.income||0).toFixed(2))} · المصروف ${esc(Number(x.expense||0).toFixed(2))} · الصافي ${esc((Number(x.income||0)-Number(x.expense||0)).toFixed(2))}</span></div></article>`).join('')||'لا توجد حركة مالية.'}<a class="big" href="/club-admin/reports.csv">تنزيل CSV</a></section><section class="panel"><h2>سجل العمليات</h2>${latest.map(x=>`<article><div><b>${esc(x.action||'')}</b><span>${esc(x.actor||'')}</span></div><small>${esc(x.entity_type||'')} ${esc(x.entity_id||'')} · ${esc(x.details||'')} · ${esc(x.created_at||'')}</small></article>`).join('')||'لا توجد عمليات.'}</section>`;
  return H('التقارير وسجل العمليات',body);
}
async function reportsCsv(db){
  const rows=await many(db,'SELECT id,entry_type,currency,amount,category,note,reference_no,member_id,payment_id,created_by,created_at FROM club_finance_entries ORDER BY id DESC LIMIT 5000');
  const head=['id','type','currency','amount','category','note','reference','member_id','payment_id','created_by','created_at'];
  const csv=[head,...rows.map(x=>[x.id,x.entry_type,x.currency,x.amount,x.category,x.note,x.reference_no,x.member_id,x.payment_id,x.created_by,x.created_at])].map(r=>r.map(csvCell).join(',')).join('\n');
  return new Response('\ufeff'+csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="wadnofei-finance-report.csv"','cache-control':'no-store'}})
}

function nav(){return `<div class="actions"><a href="/club-admin/overview">لوحة الإدارة</a><a href="/club-admin/memberships">سجل العضوية</a><a href="/club-admin/finance">المدفوعات</a><a href="/club-admin/ledger">دفتر المالية</a><a href="/club-admin/reports">التقارير</a><a href="/club-admin/cards">البطاقات</a><a href="/club-admin/whatsapp-status">واتساب</a><a href="/club-admin/readiness">فحص الجاهزية</a></div>`}
function H(title,body,status=200){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main><footer>نادي ود نفيع · نظام الإدارة المؤسسية</footer></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a,a{color:inherit}main{width:min(1080px,94%);margin:24px auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel,.profile{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px;margin-bottom:14px}.stat b{display:block;color:#d5a928;font-size:28px}.stat span,small{opacity:.83}.actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:15px 0}.actions a,.big,.mini{background:#d5a928;color:#061a43;text-decoration:none;text-align:center;padding:12px;border-radius:12px;font-weight:900}.actions a:nth-child(even){background:#25D366}.filters{display:flex;gap:8px;overflow:auto;margin:12px 0}.filters a{white-space:nowrap;padding:8px 12px;border:1px solid #d5a92888;border-radius:999px;text-decoration:none}.panel article,.pay{padding:14px 0;border-bottom:1px solid #ffffff1f}.panel article:last-child,.pay:last-child{border:0}.panel article>div,.paytop{display:flex;justify-content:space-between;gap:10px}.pay strong{display:block;color:#ffd65b;font-size:20px}.pay small{display:block;margin:6px 0}.pill{padding:5px 9px;border-radius:999px;background:#ffffff14}.pill.approved{color:#72e6a0}.pill.rejected{color:#ff9999}.pill.pending{color:#ffd65b}.review,.gridform{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.review input,.review select,.gridform input,.gridform select{padding:10px;border-radius:10px;border:1px solid #ffffff33}.review button,.gridform button{border:0;border-radius:10px;background:#d5a928;color:#061a43;font-weight:900}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:10px 0 16px}.meta span{background:#ffffff0c;padding:10px;border-radius:10px}.empty{padding:20px;text-align:center;opacity:.8}footer{text-align:center;padding:22px;opacity:.65}@media(max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}.actions{grid-template-columns:repeat(2,1fr)}.review,.gridform{grid-template-columns:1fr}.meta{grid-template-columns:1fr}}`}
function fmtMoney(rows){if(!rows.length)return '0';return rows.map(x=>`${x.currency} ${x.total}`).join(' / ')}
function label(s){return s==='approved'?'معتمد':s==='rejected'?'مرفوض':'قيد المراجعة'}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function csvCell(v){const s=String(v??'').replace(/"/g,'""');return `"${s}"`}
