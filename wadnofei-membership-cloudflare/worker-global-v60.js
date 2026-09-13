import app from './worker-global-v59.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(p.startsWith('/club-admin')&&env.DB){
      const admin=await adminSession(req,env.DB);
      if(!admin)return red('/login');
      await ensure(env.DB);
      if(p==='/club-admin/service-level'&&m==='GET')return serviceLevel(env.DB);
      if(p==='/club-admin/data-quality'&&m==='GET')return dataQuality(env.DB);
      if(p==='/club-admin/aging.csv'&&m==='GET')return agingCsv(env.DB);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/club-admin','/club-admin/overview','/club-admin/operations','/club-admin/workqueue'].includes(p)){
      let html=await r.text();
      const block=`<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928;margin-top:0">الرقابة وجودة البيانات</h2><p style="line-height:1.8">متابعة أعمار الطلبات، الطلبات المتأخرة، جودة بيانات الأعضاء، ونقاط النقص التي تحتاج معالجة قبل أن تتحول لمشكلة تشغيلية.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><a href="/club-admin/service-level" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#d5a928;color:#061a43">زمن معالجة الطلبات</a><a href="/club-admin/data-quality" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#25D366;color:#06233f">جودة البيانات</a><a href="/club-admin/aging.csv" style="padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#fff;color:#061a43">تصدير أعمار الطلبات CSV</a></div></section>`;
      html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store, no-cache, must-revalidate');h.set('x-content-type-options','nosniff');h.set('referrer-policy','same-origin');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('x-wadnofei-ui','v60-ops-quality-control');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE INDEX IF NOT EXISTS idx_app_created ON applications(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_app_status_created ON applications(status,created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_member_no_v60 ON members(member_no)`
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
async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return new Set((r.results||[]).map(x=>x.name))}catch(_){return new Set()}}

async function serviceLevel(db){
  const total=await n(db,`SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready')`);
  const d2=await n(db,`SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready') AND datetime(created_at)<=datetime('now','-2 days')`);
  const d7=await n(db,`SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready') AND datetime(created_at)<=datetime('now','-7 days')`);
  const d14=await n(db,`SELECT COUNT(*) c FROM applications WHERE status IN ('pending','review','needs-info','ready') AND datetime(created_at)<=datetime('now','-14 days')`);
  const rows=await many(db,`SELECT *,CAST(julianday('now')-julianday(created_at) AS INTEGER) age_days FROM applications WHERE status IN ('pending','review','needs-info','ready') ORDER BY datetime(created_at) ASC LIMIT 120`);
  const body=`<div class="stats"><div class="stat"><b>${total}</b><span>إجمالي تحت المعالجة</span></div><div class="stat"><b>${d2}</b><span>أقدم من يومين</span></div><div class="stat"><b>${d7}</b><span>أقدم من 7 أيام</span></div><div class="stat"><b>${d14}</b><span>أقدم من 14 يوم</span></div></div>${nav()}<section class="panel"><h2>الأقدم أولاً</h2>${rows.length?rows.map(x=>`<article><div><b>${esc(x.name||x.full_name||x.app_no||'طلب')}</b><span class="age ${Number(x.age_days)>=7?'late':''}">${Number(x.age_days)||0} يوم</span></div><small>${esc(x.app_no||'')} · ${esc(x.status||'pending')} · ${esc(x.phone||'')} · ${esc(x.created_at||'')}</small></article>`).join(''):'<p>لا توجد طلبات قيد المعالجة.</p>'}</section>`;
  return H('زمن معالجة طلبات العضوية',body);
}

async function dataQuality(db){
  const ac=await cols(db,'applications'),mc=await cols(db,'members');
  const appName=ac.has('name')?'name':(ac.has('full_name')?'full_name':null);
  const memName=mc.has('full_name')?'full_name':(mc.has('name')?'name':null);
  const issues=[];
  if(ac.has('phone'))issues.push(['طلبات بدون هاتف',await n(db,`SELECT COUNT(*) c FROM applications WHERE phone IS NULL OR trim(phone)=''`)]);
  if(appName)issues.push(['طلبات بدون اسم',await n(db,`SELECT COUNT(*) c FROM applications WHERE ${appName} IS NULL OR trim(${appName})=''`)]);
  if(mc.has('phone'))issues.push(['أعضاء بدون هاتف',await n(db,`SELECT COUNT(*) c FROM members WHERE phone IS NULL OR trim(phone)=''`)]);
  if(memName)issues.push(['أعضاء بدون اسم',await n(db,`SELECT COUNT(*) c FROM members WHERE ${memName} IS NULL OR trim(${memName})=''`)]);
  if(mc.has('member_no'))issues.push(['أعضاء بدون رقم عضوية',await n(db,`SELECT COUNT(*) c FROM members WHERE member_no IS NULL OR trim(member_no)=''`)]);
  if(mc.has('qr_token'))issues.push(['أعضاء بدون QR',await n(db,`SELECT COUNT(*) c FROM members WHERE qr_token IS NULL OR trim(qr_token)=''`)]);
  if(mc.has('membership_expires_at'))issues.push(['عضويات بلا تاريخ انتهاء',await n(db,`SELECT COUNT(*) c FROM members WHERE membership_expires_at IS NULL OR trim(membership_expires_at)=''`)]);
  const score=Math.max(0,100-issues.reduce((a,x)=>a+Math.min(20,Number(x[1]||0)*5),0));
  const body=`<div class="quality"><b>${score}%</b><span>مؤشر جودة البيانات</span></div>${nav()}<section class="panel"><h2>نقاط الفحص</h2>${issues.map(([l,v])=>`<article><div><b>${esc(l)}</b><span class="${v===0?'ok':'warn'}">${v}</span></div></article>`).join('')}</section><p class="hint">المؤشر تشغيلي مبسط: كل نقص ظاهر يقلل الجودة، والغرض منه كشف المشكلات مبكرًا وليس تقييم الأشخاص.</p>`;
  return H('جودة البيانات',body);
}

async function agingCsv(db){
  const rows=await many(db,`SELECT *,CAST(julianday('now')-julianday(created_at) AS INTEGER) age_days FROM applications WHERE status IN ('pending','review','needs-info','ready') ORDER BY datetime(created_at) ASC`);
  const cols=[...new Set(rows.flatMap(x=>Object.keys(x)))];const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const text='\ufeff'+(cols.length?cols.map(cell).join(',')+'\n'+rows.map(r=>cols.map(c=>cell(r[c])).join(',')).join('\n'):'');
  return new Response(text,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="application-aging.csv"','cache-control':'no-store'}})
}

function nav(){return `<div class="links"><a href="/club-admin/workqueue">قائمة العمل اليومية</a><a href="/club-admin/operations">مركز التشغيل</a><a href="/club-admin/service-level">زمن المعالجة</a><a href="/club-admin/data-quality">جودة البيانات</a><a href="/club-admin/system-check">فحص النظام</a><a href="/club-admin/overview">لوحة الإدارة</a></div>`}
function H(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(1000px,94%);margin:24px auto}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel,.quality{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px}.stat b,.quality b{display:block;color:#d5a928;font-size:30px}.stat span,.quality span,.panel small{opacity:.82}.links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.links a{background:#d5a928;color:#061a43;text-decoration:none;text-align:center;padding:12px;border-radius:12px;font-weight:900}.panel{margin:16px 0}.panel article{padding:12px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel article div{display:flex;justify-content:space-between;gap:12px}.age,.ok,.warn{font-weight:900}.age.late,.warn{color:#ffb3b3}.ok{color:#72e6a0}.quality{margin-bottom:16px}.hint{opacity:.8;line-height:1.8}@media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}.links{grid-template-columns:1fr}}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
