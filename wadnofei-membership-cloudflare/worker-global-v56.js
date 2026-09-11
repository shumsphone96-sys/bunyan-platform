import app from './worker-global-v55.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if((p==='/club-admin/overview'||p==='/club-admin/finance')&&m==='GET'){
      const admin=await adminSession(req,env.DB);
      if(!admin)return red('/login');
      return p==='/club-admin/overview'?overviewPage(env.DB):financePage(env.DB);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&p==='/club-admin'){
      let html=await r.text();
      const block=`<section style="margin:22px 0;padding:18px;border:1px solid #d5a92888;border-radius:20px;background:#08265dcc"><h2 style="margin-top:0;color:#d5a928">لوحة الإدارة التنفيذية</h2><p style="line-height:1.8">متابعة العضوية، التجديدات، المدفوعات، الطلبات وواتساب من مكان واحد.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><a href="/club-admin/overview" style="display:block;background:#d5a928;color:#061a43;text-align:center;text-decoration:none;font-weight:900;padding:13px;border-radius:12px">فتح لوحة الإدارة</a><a href="/club-admin/finance" style="display:block;background:#25D366;color:#06233f;text-align:center;text-decoration:none;font-weight:900;padding:13px;border-radius:12px">العضوية المالية والتجديد</a></div></section>`;
      html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v56-executive-dashboard');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function adminSession(req,db){
  if(!db)return null;const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}
}

async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return new Set((r.results||[]).map(x=>x.name))}catch(_){return new Set()}}
async function count(db,q,bind=[]){try{const r=await db.prepare(q).bind(...bind).first();return Number(r?.c||0)}catch(_){return 0}}

async function overviewPage(db){
  const ac=await cols(db,'applications'),mc=await cols(db,'members');
  const appStatus=ac.has('status')?'status':null;
  const exp=mc.has('membership_expires_at')?'membership_expires_at':null;
  const memberStatus=mc.has('status')?'status':null;
  const totalApps=await count(db,'SELECT COUNT(*) c FROM applications');
  const pending=appStatus?await count(db,`SELECT COUNT(*) c FROM applications WHERE ${appStatus} IN ('pending','review','needs-info','ready')`):0;
  const totalMembers=await count(db,'SELECT COUNT(*) c FROM members');
  const active=memberStatus?await count(db,`SELECT COUNT(*) c FROM members WHERE COALESCE(${memberStatus},'active')='active'`):totalMembers;
  const expiring=exp?await count(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})>datetime('now') AND datetime(${exp})<=datetime('now','+30 days')`):0;
  const expired=exp?await count(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})<=datetime('now')`):0;
  const payPending=await count(db,`SELECT COUNT(*) c FROM club_payment_submissions WHERE status='pending'`);
  const waPending=await count(db,`SELECT COUNT(*) c FROM club_notifications WHERE status IN ('waiting_template','failed')`);
  const stats=[['طلبات العضوية',totalApps],['تحت المتابعة',pending],['إجمالي الأعضاء',totalMembers],['أعضاء نشطون',active],['تنتهي خلال 30 يوم',expiring],['عضويات منتهية',expired],['مدفوعات للمراجعة',payPending],['إشعارات تحتاج متابعة',waPending]];
  const body=`<div class="stats">${stats.map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div><div class="actions"><a href="/applications">طلبات العضوية</a><a href="/club-admin/memberships">سجل العضوية والتجديد</a><a href="/club-admin/finance">المدفوعات والمالية</a><a href="/club-admin/cards">بطاقات العضوية</a><a href="/club-admin/whatsapp-status">حالة واتساب</a><a href="/club-admin/readiness">فحص جاهزية النظام</a></div>`;
  return H('لوحة الإدارة التنفيذية',body);
}

async function financePage(db){
  const mc=await cols(db,'members');const exp=mc.has('membership_expires_at')?'membership_expires_at':null;
  let rows=[];try{rows=(await db.prepare(`SELECT * FROM club_payment_submissions ORDER BY id DESC LIMIT 80`).all()).results||[]}catch(_){}
  const pending=rows.filter(x=>(x.status||'pending')==='pending').length;
  const approved=rows.filter(x=>['approved','paid','confirmed'].includes(String(x.status||'').toLowerCase())).length;
  const expiring=exp?await count(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})>datetime('now') AND datetime(${exp})<=datetime('now','+30 days')`):0;
  const expired=exp?await count(db,`SELECT COUNT(*) c FROM members WHERE ${exp} IS NOT NULL AND datetime(${exp})<=datetime('now')`):0;
  const cards=rows.length?rows.map(x=>`<article><div><b>${esc(x.payer_name||x.member_no||x.application_no||'دفعة')}</b><span class="pill">${esc(x.status||'pending')}</span></div><p>${esc(x.application_no||x.member_no||'')}</p><small>${esc(x.payment_method||'—')} · ${esc(x.currency||'SDG')} ${esc(x.amount||0)} · ${esc(x.created_at||'')}</small></article>`).join(''):'<article>لا توجد مدفوعات مسجلة حتى الآن.</article>';
  const body=`<div class="stats"><div class="stat"><b>${pending}</b><span>مدفوعات قيد المراجعة</span></div><div class="stat"><b>${approved}</b><span>مدفوعات مؤكدة</span></div><div class="stat"><b>${expiring}</b><span>تنتهي خلال 30 يوم</span></div><div class="stat"><b>${expired}</b><span>عضويات منتهية</span></div></div><div class="actions"><a href="/club-admin/memberships">فتح التجديدات</a><a href="/club-admin/payments">إدارة المدفوعات</a><a href="/membership/payment">بوابة إثبات الدفع</a><a href="/club-admin/overview">العودة للوحة التنفيذية</a></div><section class="panel"><h2>آخر المدفوعات</h2>${cards}</section>`;
  return H('العضوية المالية والتجديد',body);
}

function H(title,body,status=200){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(1000px,94%);margin:26px auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px}.stat b{display:block;color:#d5a928;font-size:30px}.stat span{opacity:.85}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.actions a{background:#d5a928;color:#061a43;text-decoration:none;text-align:center;padding:13px;border-radius:12px;font-weight:900}.actions a:nth-child(even){background:#25D366;color:#06233f}.panel article{padding:13px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel article>div{display:flex;justify-content:space-between;gap:10px}.pill{background:#ffffff15;padding:5px 9px;border-radius:999px;color:#ffd65b}small{opacity:.8}@media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}.actions{grid-template-columns:1fr}}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
