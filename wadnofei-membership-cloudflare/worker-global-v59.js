import app from './worker-global-v58.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p.startsWith('/club-admin')&&env.DB){
      const admin=await adminSession(req,env.DB);
      if(!admin)return red('/login');
      await ensure(env.DB);

      if(p==='/club-admin/workqueue'&&m==='GET')return workQueue(env.DB);
      if(p==='/club-admin/system-check'&&m==='GET')return systemCheck(env);
      if(p==='/club-admin/applications.csv'&&m==='GET')return applicationsCsv(env.DB);
      if(p==='/club-admin/expiring.csv'&&m==='GET')return expiringCsv(env.DB);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/club-admin','/club-admin/overview','/club-admin/operations'].includes(p)){
      let html=await r.text();
      const tools=`<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928;margin-top:0">غرفة المتابعة اليومية</h2><p style="line-height:1.8">تجمع كل ما يحتاج إجراء: الطلبات، المدفوعات، واتساب، العضويات المنتهية وفحص النظام.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><a href="/club-admin/workqueue" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#d5a928;color:#061a43">قائمة العمل الآن</a><a href="/club-admin/system-check" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#25D366;color:#06233f">فحص النظام</a><a href="/club-admin/applications.csv" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">تصدير الطلبات CSV</a><a href="/club-admin/expiring.csv" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">تصدير الانتهاء CSV</a></div></section>`;
      html=html.includes('</main>')?html.replace('</main>',tools+'</main>'):html+tools;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store, no-cache, must-revalidate');h.set('x-content-type-options','nosniff');h.set('referrer-policy','same-origin');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('x-wadnofei-ui','v59-daily-work-queue');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_members_status ON members(status)`,
    `CREATE INDEX IF NOT EXISTS idx_members_expiry ON members(membership_expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_status ON club_notifications(status)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}

async function adminSession(req,db){
  const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}
}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function n(db,q,b=[]){try{return Number((await db.prepare(q).bind(...b).first())?.c||0)}catch(_){return 0}}

async function workQueue(db){
  const apps=await many(db,`SELECT * FROM applications WHERE status IN ('pending','review','needs-info','ready') ORDER BY id DESC LIMIT 60`);
  const pays=await many(db,`SELECT * FROM club_payment_submissions WHERE COALESCE(status,'pending')='pending' ORDER BY id DESC LIMIT 40`);
  const notes=await many(db,`SELECT * FROM club_notifications WHERE status IN ('failed','waiting_template') ORDER BY id DESC LIMIT 40`);
  const expired=await many(db,`SELECT * FROM members WHERE membership_expires_at IS NOT NULL AND datetime(membership_expires_at)<=datetime('now') ORDER BY membership_expires_at ASC LIMIT 40`);
  const body=`<div class="stats"><div class="stat"><b>${apps.length}</b><span>طلبات ظاهرة الآن</span></div><div class="stat"><b>${pays.length}</b><span>مدفوعات معلقة</span></div><div class="stat"><b>${notes.length}</b><span>إشعارات تحتاج متابعة</span></div><div class="stat"><b>${expired.length}</b><span>عضويات منتهية</span></div></div>${links()}<section class="panel"><h2>طلبات العضوية التي تحتاج إجراء</h2>${apps.length?apps.map(a=>`<article><div><b>${esc(a.name||a.full_name||a.app_no||'طلب عضوية')}</b><span>${esc(a.status||'pending')}</span></div><small>${esc(a.app_no||'')} · ${esc(a.phone||'')} · ${esc(a.created_at||'')}</small></article>`).join(''):'<p>لا توجد طلبات معلقة.</p>'}</section><section class="panel"><h2>مدفوعات تنتظر المراجعة</h2>${pays.length?pays.map(x=>`<article><div><b>${esc(x.payer_name||x.member_no||x.application_no||'دفعة')}</b><span>${esc(x.currency||'SDG')} ${esc(x.amount||0)}</span></div><small>${esc(x.payment_method||'—')} · ${esc(x.created_at||'')}</small></article>`).join(''):'<p>لا توجد مدفوعات معلقة.</p>'}</section><section class="panel"><h2>إشعارات واتساب تحتاج متابعة</h2>${notes.length?notes.map(x=>`<article><div><b>${esc(x.member_name||x.application_no||'إشعار')}</b><span>${esc(x.status||'')}</span></div><small>${esc(x.event_type||'')} · ${esc(x.error||'')}</small></article>`).join(''):'<p>لا توجد إشعارات معلقة.</p>'}</section><section class="panel"><h2>عضويات منتهية</h2>${expired.length?expired.map(x=>`<article><div><b>${esc(x.full_name||x.name||x.member_no||'عضو')}</b><span>${esc(x.member_no||x.membership_no||'')}</span></div><small>انتهت: ${esc(x.membership_expires_at||'')}</small></article>`).join(''):'<p>لا توجد عضويات منتهية.</p>'}</section>`;
  return H('قائمة العمل اليومية',body);
}

async function systemCheck(env){
  const db=env.DB;
  const checks=[];
  checks.push(['قاعدة البيانات D1',!!db]);
  checks.push(['WhatsApp Phone Number ID',!!env.WHATSAPP_PHONE_NUMBER_ID]);
  checks.push(['WhatsApp Business Account ID',!!env.WHATSAPP_BUSINESS_ACCOUNT_ID]);
  checks.push(['WhatsApp Token',!!env.WHATSAPP_TOKEN]);
  checks.push(['Webhook Verify Token',!!env.WHATSAPP_VERIFY_TOKEN||!!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN]);
  if(db){
    checks.push(['جدول الطلبات',(await n(db,`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='applications'`))>0]);
    checks.push(['جدول الأعضاء',(await n(db,`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='members'`))>0]);
    checks.push(['جدول المدفوعات',(await n(db,`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='club_payment_submissions'`))>0]);
    checks.push(['جدول الإشعارات',(await n(db,`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='club_notifications'`))>0]);
  }
  const ok=checks.filter(x=>x[1]).length;
  const body=`<div class="summary ${ok===checks.length?'good':'warn'}">${ok===checks.length?'✅ النظام سليم في الفحوص الأساسية':'⚠️ توجد نقاط تحتاج انتباه'}<small>${ok} من ${checks.length} فحص ناجح</small></div>${links()}<section class="panel">${checks.map(([l,v])=>`<article><div><b>${esc(l)}</b><span class="${v?'yes':'no'}">${v?'سليم ✓':'غير مكتمل ✕'}</span></div></article>`).join('')}</section><p class="hint">الفحص لا يعرض أي أسرار أو رموز وصول، وإنما يتحقق من وجود الإعدادات المطلوبة فقط.</p>`;
  return H('فحص النظام',body);
}

async function applicationsCsv(db){return csv(await many(db,'SELECT * FROM applications ORDER BY id DESC'),'applications')}
async function expiringCsv(db){return csv(await many(db,`SELECT * FROM members WHERE membership_expires_at IS NOT NULL ORDER BY membership_expires_at ASC`),'membership-expiry')}
function csv(rows,name){const cols=[...new Set(rows.flatMap(x=>Object.keys(x)))];const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const text='\ufeff'+(cols.length?cols.map(cell).join(',')+'\n'+rows.map(r=>cols.map(c=>cell(r[c])).join(',')).join('\n'):'');return new Response(text,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}.csv"`,'cache-control':'no-store'}})}
function links(){return `<div class="links"><a href="/applications">طلبات العضوية</a><a href="/club-admin/finance?status=pending">مراجعة المدفوعات</a><a href="/club-admin/whatsapp-status">حالة واتساب</a><a href="/club-admin/memberships">العضويات والتجديد</a><a href="/club-admin/operations">مركز التشغيل</a><a href="/club-admin/system-check">فحص النظام</a></div>`}
function H(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(1000px,94%);margin:24px auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel,.summary{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px}.stat b{display:block;color:#d5a928;font-size:28px}.stat span{opacity:.85}.links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.links a{background:#d5a928;color:#061a43;text-decoration:none;text-align:center;padding:12px;border-radius:12px;font-weight:900}.panel{margin:16px 0}.panel article{padding:12px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel article div{display:flex;justify-content:space-between;gap:12px}.panel span,.panel small,.summary small{display:block;opacity:.8}.summary{font-weight:900;font-size:20px}.summary.good{border-color:#25D366}.summary.warn{border-color:#ffbd3d}.yes{color:#72e6a0}.no{color:#ff9999}.hint{opacity:.8;line-height:1.8}@media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}.links{grid-template-columns:1fr}}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
