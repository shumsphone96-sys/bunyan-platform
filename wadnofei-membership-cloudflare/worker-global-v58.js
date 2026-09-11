import app from './worker-global-v57.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p.startsWith('/club-admin')&&env.DB){
      const admin=await adminSession(req,env.DB);
      if(!admin)return red('/login');
      await ensure(env.DB);

      if(p==='/club-admin/operations'&&m==='GET')return operations(env.DB);
      if(p==='/club-admin/audit'&&m==='GET')return auditPage(env.DB,u.searchParams);
      if(p==='/club-admin/members.csv'&&m==='GET')return membersCsv(env.DB);
      if(p==='/club-admin/payments.csv'&&m==='GET')return paymentsCsv(env.DB);
      if(p==='/club-admin/finance.csv'&&m==='GET')return financeCsv(env.DB);
      if(p==='/club-admin/backup.json'&&m==='GET')return backupJson(env.DB);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/club-admin','/club-admin/overview','/club-admin/finance','/club-admin/memberships'].includes(p)){
      let html=await r.text();
      const tools=`<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928;margin-top:0">مركز التشغيل والتقارير</h2><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><a href="/club-admin/operations" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#d5a928;color:#061a43">مركز التشغيل</a><a href="/club-admin/audit" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#25D366;color:#06233f">سجل العمليات</a><a href="/club-admin/members.csv" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">تصدير الأعضاء CSV</a><a href="/club-admin/backup.json" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">نسخة بيانات JSON</a></div></section>`;
      html=html.includes('</main>')?html.replace('</main>',tools+'</main>'):html+tools;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store, no-cache, must-revalidate');h.set('x-content-type-options','nosniff');h.set('referrer-policy','same-origin');h.set('x-wadnofei-ui','v58-operations-center');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  try{await db.prepare(`CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()}catch(_){}
}
async function adminSession(req,db){
  const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}
}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function n(db,q,b=[]){try{return Number((await db.prepare(q).bind(...b).first())?.c||0)}catch(_){return 0}}

async function operations(db){
  const stats=[
    ['طلبات معلقة',await n(db,`SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready')`)],
    ['مدفوعات للمراجعة',await n(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE COALESCE(status,'pending')='pending'`)],
    ['إشعارات فاشلة/منتظرة',await n(db,`SELECT COUNT(*) c FROM club_notifications WHERE status IN ('failed','waiting_template')`)],
    ['عضويات منتهية',await n(db,`SELECT COUNT(*) c FROM members WHERE membership_expires_at IS NOT NULL AND datetime(membership_expires_at)<=datetime('now')`)]
  ];
  const recent=await many(db,`SELECT * FROM club_audit_log ORDER BY id DESC LIMIT 12`);
  const body=`<div class="stats">${stats.map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div><div class="links"><a href="/applications">طلبات العضوية</a><a href="/club-admin/finance?status=pending">المدفوعات المعلقة</a><a href="/club-admin/whatsapp-status">حالة واتساب</a><a href="/club-admin/memberships">العضويات والتجديد</a><a href="/club-admin/readiness">فحص الجاهزية</a><a href="/club-admin/audit">سجل العمليات</a></div><section class="panel"><h2>آخر العمليات</h2>${recent.length?recent.map(x=>`<article><b>${esc(x.action||'عملية')}</b><span>${esc(x.actor||'admin')} · ${esc(x.created_at||'')}</span><small>${esc(x.details||'')}</small></article>`).join(''):'<p>لا توجد عمليات مسجلة بعد.</p>'}</section>`;
  return H('مركز التشغيل',body);
}

async function auditPage(db,sp){
  const q=String(sp.get('q')||'').trim();let rows=[];
  if(q)rows=await many(db,`SELECT * FROM club_audit_log WHERE actor LIKE ? OR action LIKE ? OR details LIKE ? ORDER BY id DESC LIMIT 300`,[`%${q}%`,`%${q}%`,`%${q}%`]);
  else rows=await many(db,`SELECT * FROM club_audit_log ORDER BY id DESC LIMIT 300`);
  const body=`<form class="search"><input name="q" value="${esc(q)}" placeholder="بحث في سجل العمليات"><button>بحث</button></form><div class="links"><a href="/club-admin/operations">مركز التشغيل</a><a href="/club-admin/overview">لوحة الإدارة</a></div><section class="panel">${rows.length?rows.map(x=>`<article><div><b>${esc(x.action||'عملية')}</b><span>${esc(x.actor||'admin')}</span></div><small>${esc(x.entity_type||'')} #${esc(x.entity_id||'')} · ${esc(x.created_at||'')}</small><p>${esc(x.details||'')}</p></article>`).join(''):'<p>لا توجد نتائج.</p>'}</section>`;
  return H('سجل العمليات',body);
}

async function membersCsv(db){return csv(await many(db,'SELECT * FROM members ORDER BY id DESC'),'members')}
async function paymentsCsv(db){return csv(await many(db,'SELECT * FROM club_payment_submissions ORDER BY id DESC'),'payments')}
async function financeCsv(db){return csv(await many(db,'SELECT * FROM club_finance_entries ORDER BY id DESC'),'finance')}
async function backupJson(db){
  const out={generated_at:new Date().toISOString(),club:CLUB,members:await many(db,'SELECT * FROM members ORDER BY id'),applications:await many(db,'SELECT * FROM applications ORDER BY id'),payments:await many(db,'SELECT * FROM club_payment_submissions ORDER BY id'),finance:await many(db,'SELECT * FROM club_finance_entries ORDER BY id'),audit:await many(db,'SELECT * FROM club_audit_log ORDER BY id DESC LIMIT 1000')};
  return new Response(JSON.stringify(out,null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="wadnofei-backup.json"','cache-control':'no-store'}})
}
function csv(rows,name){
  const cols=[...new Set(rows.flatMap(x=>Object.keys(x)))];
  const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const text='\ufeff'+(cols.length?cols.map(cell).join(',')+'\n'+rows.map(r=>cols.map(c=>cell(r[c])).join(',')).join('\n'):'');
  return new Response(text,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}.csv"`,'cache-control':'no-store'}})
}
function H(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(1000px,94%);margin:24px auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel,.search{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px}.stat b{display:block;color:#d5a928;font-size:28px}.stat span{opacity:.85}.links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.links a,.search button{background:#d5a928;color:#061a43;text-decoration:none;text-align:center;padding:12px;border-radius:12px;font-weight:900;border:0}.panel article{padding:12px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel article div{display:flex;justify-content:space-between;gap:12px}.panel span,.panel small{display:block;opacity:.78}.search{display:flex;gap:10px}.search input{flex:1;padding:12px;border-radius:11px;border:1px solid #ffffff33}@media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}.links{grid-template-columns:1fr}}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
