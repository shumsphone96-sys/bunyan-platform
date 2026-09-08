import app from './worker-global-v28.js';

const META_VERSION='v22.0';
const TEMPLATES={
  application_received:{name:'wdn_application_received',params:r=>[r.member_name||'عضو النادي',r.application_no||'—']},
  review:{name:'wdn_review_started',params:r=>[r.member_name||'عضو النادي',r.application_no||'—']},
  'needs-info':{name:'wdn_needs_info',params:r=>[r.member_name||'عضو النادي',r.application_no||'—',r.admin_note||'يرجى التواصل مع إدارة النادي']},
  ready:{name:'wdn_ready_for_approval',params:r=>[r.member_name||'عضو النادي',r.application_no||'—']},
  membership_approved:{name:'wdn_membership_approved',params:r=>[r.member_name||'عضو النادي',r.member_no||'تم الإصدار']},
  application_rejected:{name:'wdn_application_rejected',params:r=>[r.member_name||'عضو النادي',r.application_no||'—',r.admin_note||'يرجى التواصل مع إدارة النادي']}
};

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(p==='/club-admin/notifications/health'&&m==='GET'){
      if(!(await adminSession(req,env.DB))) return red('/login');
      return healthPage(env);
    }
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&p==='/club-admin/notifications'){
      let html=await response.text();
      html=html.replace('مركز الإشعارات · V28','مركز الإشعارات · V29');
      html=html.replace('</main>',`<div style="width:min(820px,92%);margin:0 auto 26px"><a href="/club-admin/notifications/health" style="display:block;text-align:center;background:#fff;color:#061a43;text-decoration:none;padding:13px;border-radius:14px;font-weight:900">فحص واتساب والقوالب الآن</a></div></main>`);
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v29-auto-retry');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  },
  async scheduled(_event,env,ctx){
    ctx.waitUntil(autoRetry(env));
  }
};

async function autoRetry(env){
  if(!env.DB||!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!env.WHATSAPP_BUSINESS_ACCOUNT_ID)return;
  const approved=await approvedTemplates(env);
  let rows=[];
  try{const r=await env.DB.prepare(`SELECT * FROM club_notifications WHERE status IN ('waiting_template','failed') ORDER BY id ASC LIMIT 50`).all();rows=r.results||[]}catch(_){return}
  for(const n of rows){
    const cfg=TEMPLATES[n.event_type];
    if(!cfg||!approved.has(cfg.name))continue;
    const r=await sendTemplate(env,n);
    const s=r.ok?'sent':(r.code===132001?'waiting_template':'failed');
    try{await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`).bind(s,r.id||null,r.ok?null:r.error||null,s,n.id).run()}catch(_){}
  }
}

async function approvedTemplates(env){
  const out=new Set();
  try{const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,language&limit=200`,{headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}});const d=await r.json().catch(()=>({}));for(const x of d.data||[])if(x.status==='APPROVED'&&x.language==='ar')out.add(x.name)}catch(_){}
  return out;
}

async function sendTemplate(env,n){
  const cfg=TEMPLATES[n.event_type];if(!cfg)return {ok:false,error:'لا يوجد قالب لهذه الحالة'};
  let adminNote='',memberNo='';
  try{if(n.application_id){const a=await env.DB.prepare('SELECT admin_note FROM applications WHERE id=?').bind(n.application_id).first();adminNote=a?.admin_note||'';const m=await env.DB.prepare('SELECT member_no FROM members WHERE application_id=? ORDER BY id DESC LIMIT 1').bind(n.application_id).first();memberNo=m?.member_no||''}}catch(_){}
  const row={...n,admin_note:adminNote,member_no:memberNo};
  const params=cfg.params(row).map(v=>({type:'text',text:String(v??'—')}));
  try{const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:String(n.actual_recipient||n.target_phone||'').replace(/\D/g,''),type:'template',template:{name:cfg.name,language:{code:'ar'},components:[{type:'body',parameters:params}]}})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=d.error||{};return {ok:false,code:Number(e.code||0),error:[e.message,e.error_user_title,e.error_user_msg,e.code?`code ${e.code}`:''].filter(Boolean).join(' — ')||`HTTP ${r.status}`}}return {ok:true,id:d?.messages?.[0]?.id||null}}catch(e){return {ok:false,error:String(e?.message||e)}}
}

async function healthPage(env){
  const approved=await approvedTemplates(env);
  let waiting=0;try{const r=await env.DB.prepare(`SELECT COUNT(*) c FROM club_notifications WHERE status='waiting_template'`).first();waiting=Number(r?.c||0)}catch(_){}
  const items=Object.values(TEMPLATES).map(x=>`<li><b>${esc(x.name)}</b> — ${approved.has(x.name)?'<span class="ok">APPROVED</span>':'<span class="wait">بانتظار Meta</span>'}</li>`).join('');
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فحص واتساب</title><style>body{margin:0;background:#061a43;color:#fff;font-family:system-ui}main{width:min(760px,92%);margin:28px auto}.box{background:#0a347c;border:1px solid #d5a92877;border-radius:20px;padding:18px}h1{color:#d5a928}.ok{color:#7cff9b}.wait{color:#ffd65b}li{margin:12px 0;line-height:1.6}a{display:block;background:#d5a928;color:#061a43;text-align:center;text-decoration:none;font-weight:900;padding:13px;border-radius:12px;margin-top:16px}</style></head><body><main><div class="box"><h1>فحص واتساب المباشر</h1><p>Phone Number ID: <b>${esc(env.WHATSAPP_PHONE_NUMBER_ID||'غير موجود')}</b></p><p>الإشعارات المنتظرة: <b>${waiting}</b></p><ul>${items}</ul><p>النظام يفحص القوالب تلقائياً كل 15 دقيقة، وأول ما يتحول القالب إلى APPROVED يعيد إرسال الإشعارات المنتظرة تلقائياً بدون تدخل منك.</p><a href="/club-admin/notifications">العودة لمركز الإشعارات</a></div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

async function adminSession(req,db){if(!db)return null;const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);try{const a=await db.prepare(`SELECT a.id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}try{return await db.prepare(`SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
