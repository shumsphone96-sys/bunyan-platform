import app from './worker-global-v51.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const META_VERSION='v22.0';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/club-admin/whatsapp-status'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return whatsappStatus(env);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&p.startsWith('/club-admin')){
      let html=await r.text();
      const link='<a href="/club-admin/whatsapp-status" style="display:inline-block;margin:8px;padding:10px 14px;border-radius:12px;background:#18b66a;color:#fff;font-weight:900;text-decoration:none">💬 حالة واتساب</a>';
      if(!html.includes('/club-admin/whatsapp-status')) html=html.includes('</main>')?html.replace('</main>',link+'</main>'):html+link;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v52-whatsapp-ops');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function adminGate(req,env,ctx){
  try{
    const u=new URL(req.url);u.pathname='/club-admin';u.search='';
    const probe=await app.fetch(new Request(u.toString(),req),env,ctx);
    if(probe.status>=300&&probe.status<400)return new Response(null,{status:303,headers:{location:probe.headers.get('location')||'/login'}});
  }catch(_){return red('/login')}
  return null;
}

async function whatsappStatus(env){
  const configured=Boolean(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID&&env.WHATSAPP_BUSINESS_ACCOUNT_ID);
  let templates=[],metaError='';
  if(configured){
    try{
      const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,language,category&limit=200`,{headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}});
      const d=await r.json().catch(()=>({}));
      if(r.ok) templates=(d.data||[]).filter(x=>String(x.name||'').startsWith('wdn_'));
      else metaError=(d.error?.message||`HTTP ${r.status}`);
    }catch(e){metaError=String(e?.message||e)}
  }

  const wanted=['wdn_application_received','wdn_review_started','wdn_needs_info','wdn_ready_for_approval','wdn_membership_approved','wdn_application_rejected','wdn_membership_update'];
  const byName=new Map(templates.map(x=>[x.name,x]));
  let counts={sent:0,waiting_template:0,failed:0,pending:0,total:0};
  if(env.DB){
    try{
      const r=await env.DB.prepare(`SELECT status,COUNT(*) c FROM club_notifications GROUP BY status`).all();
      for(const x of r.results||[]){const k=String(x.status||'pending');counts[k]=Number(x.c||0);counts.total+=Number(x.c||0)}
    }catch(_){ }
  }

  const approved=wanted.filter(n=>byName.get(n)?.status==='APPROVED').length;
  const body=`
    <section class="hero"><div class="big">${approved}/${wanted.length}</div><div><h2>جاهزية قوالب واتساب</h2><p>${configured?'ربط WhatsApp Cloud API موجود':'إعدادات WhatsApp غير مكتملة'}</p></div></section>
    ${metaError?`<div class="alert bad">تعذر قراءة Meta الآن: ${esc(metaError)}</div>`:''}
    <section class="grid">
      <div><b>${counts.sent||0}</b><span>رسائل مرسلة</span></div>
      <div><b>${counts.waiting_template||0}</b><span>بانتظار قالب</span></div>
      <div><b>${counts.failed||0}</b><span>فشلت</span></div>
      <div><b>${counts.total||0}</b><span>إجمالي الإشعارات</span></div>
    </section>
    <section class="panel"><h2>القوالب المطلوبة</h2>${wanted.map(n=>{const t=byName.get(n);const s=t?.status||'NOT_FOUND';return `<div class="row"><code>${esc(n)}</code><span class="pill ${s==='APPROVED'?'ok':s==='REJECTED'?'bad':'wait'}">${esc(label(s))}</span></div>`}).join('')}</section>
    <section class="panel"><h2>التشغيل</h2><p>${approved===wanted.length?'✅ كل القوالب معتمدة، الإرسال الآلي جاهز.':'الإشعارات محفوظة في النظام، وما يتعطل منها بسبب القوالب ينتظر الاعتماد ثم يعاد إرساله.'}</p><div class="actions"><form method="post" action="/club-admin/notifications/retry-pending"><button>🔁 إعادة محاولة الرسائل المعلقة</button></form><a href="/club-admin/notifications">مركز الإشعارات</a><a href="/club-admin/notifications/history">سجل الرسائل</a><a href="/club-admin/readiness">فحص النظام</a></div></section>`;
  return H(page('حالة رسائل واتساب',body));
}

function label(s){return ({APPROVED:'معتمد',PENDING:'قيد المراجعة',REJECTED:'مرفوض',PAUSED:'متوقف',DISABLED:'معطل',NOT_FOUND:'غير موجود'})[s]||s}
function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(t)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;align-items:center;padding:16px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(900px,94%);margin:28px auto}.hero,.panel,.grid div{background:#08265dee;border:1px solid #d5a92866;border-radius:20px}.hero{display:flex;align-items:center;gap:18px;padding:20px}.big{font-size:48px;font-weight:1000;color:#d5a928}.hero h2{margin:0}.hero p{margin:6px 0 0;opacity:.85}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.grid div{padding:16px;text-align:center}.grid b{display:block;font-size:28px;color:#d5a928}.grid span{font-size:13px;opacity:.8}.panel{padding:18px;margin:16px 0}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #ffffff18}.row:last-child{border:0}code{direction:ltr;font-size:12px;overflow-wrap:anywhere}.pill{padding:5px 9px;border-radius:999px;font-weight:800}.ok{background:#123d2b;color:#76e5a0}.bad{background:#4a2020;color:#ff9d9d}.wait{background:#4b3b13;color:#ffd86a}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button,.actions a{border:0;border-radius:12px;background:#d5a928;color:#061a43;padding:11px 14px;font-weight:900;text-decoration:none;cursor:pointer}.alert{padding:12px;border-radius:12px;background:#ffffff15;margin:12px 0}.alert.bad{border:1px solid #ff8d8d}footer{text-align:center;padding:24px;color:#e6d8aa}@media(max-width:650px){.grid{grid-template-columns:1fr 1fr}.hero{align-items:flex-start}.big{font-size:38px}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function red(x){return new Response(null,{status:303,headers:{location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
