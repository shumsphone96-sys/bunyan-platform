import app from './worker-global-v30.js';

const CLUB_WHATSAPP='249912603242';
const META_VERSION='v22.0';
const UNIVERSAL_NAME='wdn_membership_update';
const UNIVERSAL_LANGUAGE='ar';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/membership/activate-whatsapp'){
      const text='السلام عليكم، أريد تفعيل إشعارات عضويتي في نادي ود نفيع.';
      return new Response(null,{status:303,headers:{Location:`https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(text)}`}});
    }

    if(p.startsWith('/club-admin/notifications')||p==='/club-admin/whatsapp-templates'){
      ctx.waitUntil(ensureUniversalTemplate(env));
    }

    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    const isMembership=(p==='/membership'||p==='/membership/join'||p==='/join');

    if(isMembership&&ct.includes('text/html')){
      let html=await response.text();
      const panel=`<section style="width:min(920px,92%);margin:16px auto;padding:16px;border:1px solid #25D36688;border-radius:18px;background:#0b2e4fcc;color:#fff;line-height:1.8;text-align:right"><div style="font-size:18px;font-weight:900;color:#d5a928;margin-bottom:6px">📲 فعّل إشعارات واتساب</div><div style="margin-bottom:10px">اضغط الزر وأرسل الرسالة الجاهزة إلى رقم النادي. بهذه الخطوة تصل تحديثات طلبك فوراً أثناء فترة المحادثة، بينما يعمل النظام أيضاً بالقوالب الرسمية تلقائياً بعد اعتماد Meta.</div><a href="/membership/activate-whatsapp" style="display:block;text-align:center;background:#25D366;color:#06233f;text-decoration:none;padding:13px 16px;border-radius:13px;font-weight:900">فتح واتساب وإرسال رسالة التفعيل</a></section>`;
      if(html.includes('<main')) html=html.replace(/(<main[^>]*>)/i,`$1${panel}`);
      else if(html.includes('<body')) html=html.replace(/(<body[^>]*>)/i,`$1${panel}`);
      else html=panel+html;
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v31-whatsapp-activation');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }

    if(ct.includes('text/html')&&p==='/club-admin/notifications'){
      let html=await response.text();
      html=html.replace('مركز الإشعارات · V30','مركز الإشعارات · V31');
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v31-universal-fallback');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }

    return response;
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(ensureUniversalTemplate(env));
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
      method:'POST',
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({
        name:UNIVERSAL_NAME,
        language:UNIVERSAL_LANGUAGE,
        category:'UTILITY',
        components:[{
          type:'BODY',
          text:'إشعار من نادي ود نفيع: يوجد تحديث جديد على طلب العضوية رقم {{1}}. الحالة الحالية: {{2}}. يرجى متابعة طلبك عبر القنوات الرسمية للنادي.',
          example:{body_text:[['WDN-REQ-00003','يحتاج الطلب إلى استكمال بيانات']]}
        }]
      })
    });
  }catch(_){}
}
