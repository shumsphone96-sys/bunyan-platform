import app from './worker-global-v27.js';

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

    const retry=p.match(/^\/club-admin\/notifications\/retry\/(\d+)$/);
    if(retry&&m==='POST'){
      const admin=await adminSession(req,env.DB);
      if(!admin) return red('/login');
      return retryNotification(env,Number(retry[1]));
    }
    if(p==='/club-admin/notifications/retry-pending'&&m==='POST'){
      const admin=await adminSession(req,env.DB);
      if(!admin) return red('/login');
      return retryPending(env);
    }

    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await response.text();
      if(p==='/club-admin/notifications/history') html=polishHistory(html);
      if(p==='/club-admin/whatsapp-templates') html=polishTemplates(html);
      if(p==='/club-admin/notifications') html=polishCenter(html);
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v28-live-polish');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  }
};

async function adminSession(req,db){
  if(!db)return null;const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}
  try{return await db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}
}

async function retryNotification(env,id){
  if(!env.DB)return red('/club-admin/notifications/history');
  let n;try{n=await env.DB.prepare('SELECT * FROM club_notifications WHERE id=?').bind(id).first()}catch(_){return red('/club-admin/notifications/history')}
  if(!n)return red('/club-admin/notifications/history');
  const result=await sendTemplate(env,n.actual_recipient||n.target_phone,n.event_type,n);
  const status=result.ok?'sent':(result.code===132001?'waiting_template':'failed');
  try{await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`).bind(status,result.id||null,result.ok?null:result.error||null,status,id).run()}catch(_){}
  return red('/club-admin/notifications/history?retry='+encodeURIComponent(status));
}

async function retryPending(env){
  if(!env.DB)return red('/club-admin/notifications/history');
  let rows=[];try{const r=await env.DB.prepare(`SELECT * FROM club_notifications WHERE status IN ('failed','waiting_template') ORDER BY id DESC LIMIT 25`).all();rows=r.results||[]}catch(_){}
  let sent=0,waiting=0,failed=0;
  for(const n of rows){const r=await sendTemplate(env,n.actual_recipient||n.target_phone,n.event_type,n);const s=r.ok?'sent':(r.code===132001?'waiting_template':'failed');if(s==='sent')sent++;else if(s==='waiting_template')waiting++;else failed++;try{await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`).bind(s,r.id||null,r.ok?null:r.error||null,s,n.id).run()}catch(_){}}
  return red(`/club-admin/notifications/history?bulk=${sent}-${waiting}-${failed}`);
}

async function sendTemplate(env,to,event,row){
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)return {ok:false,error:'بيانات واتساب غير مكتملة'};
  const cfg=TEMPLATES[event];if(!cfg)return {ok:false,error:'لا يوجد قالب لهذه الحالة'};
  let adminNote='';let memberNo='';
  try{if(env.DB&&row.application_id){const a=await env.DB.prepare('SELECT admin_note FROM applications WHERE id=?').bind(row.application_id).first();adminNote=a?.admin_note||'';const m=await env.DB.prepare('SELECT member_no FROM members WHERE application_id=? ORDER BY id DESC LIMIT 1').bind(row.application_id).first();memberNo=m?.member_no||''}}catch(_){}
  const dataRow={...row,admin_note:adminNote,member_no:memberNo};
  const params=cfg.params(dataRow).map(v=>({type:'text',text:String(v??'—')}));
  try{const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:String(to||'').replace(/\D/g,''),type:'template',template:{name:cfg.name,language:{code:String(env.WHATSAPP_TEMPLATE_LANGUAGE||'ar')},components:[{type:'body',parameters:params}]}})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=d?.error||{};return {ok:false,code:Number(e.code||0),error:[e.message,e.error_user_title,e.error_user_msg,e.code?`code ${e.code}`:''].filter(Boolean).join(' — ')||`HTTP ${r.status}`}}return {ok:true,id:d?.messages?.[0]?.id||null}}catch(e){return {ok:false,error:String(e?.message||e)}}
}

function polishHistory(html){
  html=html.replace('</style>',`.retrybar{display:grid;grid-template-columns:1fr;gap:10px;margin:0 0 18px}.retrybar form{margin:0}.retrybar button,.retry-one{width:100%;border:0;border-radius:12px;padding:11px 14px;font-weight:900;cursor:pointer}.retrybar button{background:#25D366;color:#06233f}.retry-one{background:#d5a928;color:#061a43;margin-top:12px}.hint{background:#ffffff10;border:1px solid #ffffff1f;border-radius:14px;padding:12px 14px;line-height:1.7;margin-bottom:16px}.status.waiting{color:#ffd65b}</style>`);
  html=html.replace('<div class="list">',`<div class="hint">إذا كان القالب ما زال <b>PENDING</b> سيظهر الإشعار بانتظار اعتماد Meta. بعد ظهور <b>APPROVED</b> اضغط إعادة إرسال المعلّق فقط.</div><div class="retrybar"><form method="post" action="/club-admin/notifications/retry-pending"><button>إعادة إرسال الإشعارات المعلّقة</button></form></div><div class="list">`);
  html=html.replace(/<\/article>/g,m=>`<form method="post" action="/club-admin/notifications/retry/0" class="wdn-placeholder" style="display:none"></form>${m}`);
  html=html.replace(/<article>([\s\S]*?)<\/article>/g,(whole,inner)=>whole); // keeps markup stable
  return html.replace('سجل الإشعارات الآلية','سجل الإشعارات الآلية · مباشر');
}

function polishTemplates(html){
  html=html.replace('</style>',`.approved{background:#143d27!important}.pending{background:#4a3b11!important}.rejected{background:#4b1820!important}.status{font-weight:900}.livebox{margin:14px 0;padding:13px 14px;border-radius:14px;background:#ffffff10;line-height:1.7}</style>`);
  return html.replace('<div class="list">',`<div class="livebox">✅ <b>APPROVED</b>: جاهز للإرسال لأي عضو.<br>⏳ <b>PENDING</b>: تحت مراجعة Meta.<br>⚠️ <b>غير موجود</b>: اضغط زر الإرسال أسفل الصفحة.</div><div class="list">`);
}
function polishCenter(html){return html.replace('مركز الإشعارات · V27','مركز الإشعارات · V28').replace('</main>',`<div style="width:min(820px,92%);margin:0 auto 26px;display:grid;gap:10px"><a href="/club-admin/notifications/history" style="display:block;text-align:center;background:#d5a928;color:#061a43;text-decoration:none;padding:13px;border-radius:14px;font-weight:900">سجل الإشعارات المباشر</a><a href="/club-admin/whatsapp-templates" style="display:block;text-align:center;background:#25D366;color:#06233f;text-decoration:none;padding:13px;border-radius:14px;font-weight:900">حالة قوالب واتساب</a></div></main>`)}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
