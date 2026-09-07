import app from './worker-global-v13.js';

const CLUB_PHONE='249912930540';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/,'') || '/';

    if (path === '/club-admin/notifications/health') {
      return json({
        ok: true,
        whatsapp: {
          token: !!env.WHATSAPP_TOKEN,
          phone_number_id: !!env.WHATSAPP_PHONE_NUMBER_ID,
          business_account_id: !!env.WHATSAPP_BUSINESS_ACCOUNT_ID,
          mode: env.WHATSAPP_MODE || 'unset',
          recipient: CLUB_PHONE
        }
      });
    }

    if (path === '/club-admin/notifications/quick-test' && req.method === 'POST') {
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
        return json({ok:false,error:'WhatsApp credentials incomplete'},500);
      }
      const result = await sendWhatsApp(env, CLUB_PHONE, 'رسالة اختبار من نظام عضوية نادي ود نفيع — ربط WhatsApp Cloud API يعمل من داخل الموقع.');
      if (!result.ok) return json({ok:false,error:result.error},502);
      return new Response(null,{status:303,headers:{Location:'/club-admin/notifications?sent=1'}});
    }

    if (path === '/club-admin/notifications' && req.method === 'GET') {
      const ready = !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
      const sent = url.searchParams.get('sent') === '1';
      return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>إشعارات واتساب</title><style>body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,Tahoma,Arial;min-height:100vh}main{width:min(760px,92%);margin:40px auto}.box{background:#08265dcc;border:1px solid #d5a92888;border-radius:22px;padding:22px}h1,h2{color:#d5a928}.status{padding:12px;border-radius:12px;background:#ffffff0b;margin:12px 0}.ok{color:#7CFF9B}.wait{color:#ffd166}button,a{display:inline-block;border:0;border-radius:12px;padding:12px 16px;font-weight:900;text-decoration:none}.send{background:#25D366;color:#06233f}.back{background:#d5a928;color:#061a43;margin-inline-start:8px}.msg{background:#123d76;border:1px solid #51cf66;padding:12px;border-radius:12px;margin-bottom:14px}</style></head><body><main><div class="box"><h1>إشعارات العضوية والدفع</h1>${sent?'<div class="msg">✅ تم إرسال رسالة الاختبار إلى +249912930540</div>':''}<div class="status"><h2>${ready?'✅ واتساب جاهز للاختبار':'⚠️ الربط غير مكتمل'}</h2><p>Token: ${env.WHATSAPP_TOKEN?'موجود ومحمي':'غير موجود'}<br>Phone Number ID: ${env.WHATSAPP_PHONE_NUMBER_ID?'موجود':'غير موجود'}<br>الوضع: ${env.WHATSAPP_MODE||'غير محدد'}</p></div>${ready?`<form method="post" action="/club-admin/notifications/quick-test"><button class="send">إرسال اختبار الآن إلى +${CLUB_PHONE}</button></form>`:'<p>أكمل إعداد WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID داخل Cloudflare.</p>'}<p><a href="/club-admin/notifications/health">فحص حالة الربط</a></p><a class="back" href="/club-admin">العودة للمركز</a></div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    }

    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();
    if (path === '/club-admin') {
      html = html.replace('</main>', `<section style="margin:24px 0;padding:18px;border:1px solid #d5a92888;border-radius:20px;background:#08265dcc"><h2 style="margin-top:0;color:#d5a928">واتساب العضوية</h2><p>اختبار إرسال إشعارات العضوية عبر WhatsApp Cloud API.</p><a href="/club-admin/notifications" style="display:inline-block;background:#25D366;color:#06233f;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900">فتح اختبار واتساب</a></section></main>`);
    }
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store, max-age=0');
    headers.set('x-wadnofei-ui','v19-whatsapp-hotfix');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
};

async function sendWhatsApp(env,to,message){
  try{
    const r=await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:'POST',
      headers:{'authorization':`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:message}})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) return {ok:false,error:data?.error?.message||`HTTP ${r.status}`};
    return {ok:true,id:data?.messages?.[0]?.id||null};
  }catch(err){return {ok:false,error:String(err?.message||err)}}
}

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
