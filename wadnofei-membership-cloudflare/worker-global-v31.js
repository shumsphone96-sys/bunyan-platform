import app from './worker-global-v30.js';

const META_VERSION='v22.0';
const UNIVERSAL_NAME='wdn_membership_update';
const UNIVERSAL_LANGUAGE='ar';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    // Keep Meta/template handling completely behind the scenes.
    if(p.startsWith('/club-admin/notifications')||p==='/club-admin/whatsapp-templates'){
      ctx.waitUntil(ensureUniversalTemplate(env));
      ctx.waitUntil(retryWithUniversalFallback(env));
    }

    // Manual retry now also uses the approved universal fallback automatically.
    if(p==='/club-admin/notifications/retry-pending'&&m==='POST'){
      ctx.waitUntil(retryWithUniversalFallback(env));
    }

    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    const isMembership=(p==='/membership'||p==='/membership/join'||p==='/join');

    if(isMembership&&ct.includes('text/html')){
      let html=await response.text();
      // Remove the old opt-in panel: the member should only register and receive updates automatically.
      html=html.replace(/<section[^>]*>\s*<div[^>]*>📲 فعّل إشعارات واتساب<\/div>[\s\S]*?<\/section>/i,'');
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v31-auto-whatsapp');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }

    if(ct.includes('text/html')&&p==='/club-admin/notifications'){
      let html=await response.text();
      html=html.replace('مركز الإشعارات · V30','مركز الإشعارات · V31');
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v31-auto-fallback');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }

    return response;
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(ensureUniversalTemplate(env));
    ctx.waitUntil(retryWithUniversalFallback(env));
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

async function ensureUniversalTemplate(env){
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_BUSINESS_ACCOUNT_ID)return;
  try{
    const q=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language&limit=200`,{headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}});
    const data=await q.json().catch(()=>({}));
    if(!q.ok)return;
    const exists=(data.data||[]).some(x=>x.name===UNIVERSAL_NAME&&x.language===UNIVERSAL_LANGUAGE);
    if(exists)return;
    await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,{
      method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({name:UNIVERSAL_NAME,language:UNIVERSAL_LANGUAGE,category:'UTILITY',components:[{type:'BODY',text:'إشعار من نادي ود نفيع: يوجد تحديث جديد على طلب العضوية رقم {{1}}. الحالة الحالية: {{2}}. يرجى متابعة طلبك عبر القنوات الرسمية للنادي.',example:{body_text:[['WDN-REQ-00003','يحتاج الطلب إلى استكمال بيانات']]}}]})
    });
  }catch(_){}
}

async function retryWithUniversalFallback(env){
  if(!env.DB||!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!env.WHATSAPP_BUSINESS_ACCOUNT_ID)return;
  const approved=await approvedTemplates(env);
  if(!approved.has(UNIVERSAL_NAME))return;
  let rows=[];
  try{const r=await env.DB.prepare(`SELECT * FROM club_notifications WHERE status IN ('waiting_template','failed') ORDER BY id ASC LIMIT 100`).all();rows=r.results||[]}catch(_){return}
  for(const n of rows){
    const phone=String(n.actual_recipient||n.target_phone||'').replace(/\D/g,'');
    if(!phone)continue;
    const applicationNo=n.application_no||'—';
    const state=eventLabel(n.event_type);
    const result=await sendUniversal(env,phone,applicationNo,state);
    const status=result.ok?'sent':(result.code===132001?'waiting_template':'failed');
    try{await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`).bind(status,result.id||null,result.ok?null:result.error||null,status,n.id).run()}catch(_){}
  }
}

async function approvedTemplates(env){
  const out=new Set();
  try{const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,language&limit=200`,{headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}});const d=await r.json().catch(()=>({}));for(const x of d.data||[])if(x.status==='APPROVED'&&x.language===UNIVERSAL_LANGUAGE)out.add(x.name)}catch(_){}
  return out;
}

async function sendUniversal(env,to,applicationNo,state){
  try{
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:UNIVERSAL_NAME,language:{code:UNIVERSAL_LANGUAGE},components:[{type:'body',parameters:[{type:'text',text:String(applicationNo)},{type:'text',text:String(state)}]}]}})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=d.error||{};return {ok:false,code:Number(e.code||0),error:[e.message,e.error_user_title,e.error_user_msg,e.code?`code ${e.code}`:''].filter(Boolean).join(' — ')||`HTTP ${r.status}`}}
    return {ok:true,id:d?.messages?.[0]?.id||null};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}

function eventLabel(v){return ({application_received:'تم استلام طلب العضوية',review:'بدأت مراجعة الطلب','needs-info':'الطلب يحتاج إلى استكمال بيانات',ready:'الطلب جاهز للاعتماد',membership_approved:'تم اعتماد العضوية',application_rejected:'تم تحديث الطلب إلى غير معتمد'})[v]||'تم تحديث طلب العضوية'}
