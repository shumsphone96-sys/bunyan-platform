import app from './worker-global-v12.js';

const DEFAULT_RECIPIENT='249912930540';
const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/,'') || '/';
    const recipient = normalizePhone(env.WHATSAPP_TEST_RECIPIENT || DEFAULT_RECIPIENT);

    if (path === '/club-admin/notifications/health') {
      return json({
        ok: true,
        version: 'v21',
        origin: env.APP_ORIGIN || url.origin,
        whatsapp: {
          ready: !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
          token: !!env.WHATSAPP_TOKEN,
          phone_number_id: !!env.WHATSAPP_PHONE_NUMBER_ID,
          business_account_id: !!env.WHATSAPP_BUSINESS_ACCOUNT_ID,
          mode: env.WHATSAPP_MODE || 'unset',
          recipient
        }
      });
    }

    if (path === '/club-admin/notifications/quick-test' && req.method === 'POST') {
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
        return json({ok:false,error:'WhatsApp credentials incomplete'},500);
      }
      const message = `رسالة اختبار من ${CLUB} — تم التأكد من أن ربط WhatsApp Cloud API يعمل من داخل نظام العضوية.`;
      const result = await sendWhatsApp(env, recipient, message);
      if (!result.ok) return json({ok:false,error:result.error,details:result.details||null},502);
      return new Response(null,{status:303,headers:{Location:'/club-admin/notifications?sent=1'}});
    }

    if (path === '/club-admin/notifications' && req.method === 'GET') {
      const ready = !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
      const sent = url.searchParams.get('sent') === '1';
      const origin = env.APP_ORIGIN || url.origin;
      return html(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>إشعارات العضوية والدفع</title><style>
*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}main{width:min(820px,92%);margin:34px auto}.box{background:#08265dcc;border:1px solid #d5a92888;border-radius:24px;padding:22px;box-shadow:0 16px 45px #0003}h1,h2{color:#d5a928;margin-top:0}.eyebrow{color:#9ebcff;font-weight:900;margin-bottom:8px}.status{padding:16px;border-radius:16px;background:#ffffff0b;margin:14px 0;border:1px solid #ffffff14}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.tile{background:#061a4388;border:1px solid #d5a92844;border-radius:14px;padding:13px}.tile b{display:block;color:#ffd65b;margin-bottom:5px}.ok{color:#7CFF9B}.wait{color:#ffd166}button,a{display:inline-block;border:0;border-radius:12px;padding:12px 16px;font-weight:900;text-decoration:none}.send{background:#25D366;color:#06233f;width:100%;font-size:1rem}.back{background:#d5a928;color:#061a43}.health{color:#9ec4ff;padding-inline:0}.msg{background:#123d76;border:1px solid #51cf66;padding:12px;border-radius:12px;margin-bottom:14px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.note{opacity:.8;font-size:.92rem;line-height:1.7}.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}@media(max-width:650px){.grid{grid-template-columns:1fr}}
</style></head><body><main><div class="box"><div class="eyebrow">مركز الإشعارات · V21</div><h1>إشعارات العضوية والدفع</h1>${sent?`<div class="msg">✅ تم إرسال رسالة الاختبار بنجاح إلى <span class="ltr">+${recipient}</span></div>`:''}<div class="status"><h2>${ready?'✅ واتساب جاهز للاختبار':'⚠️ الربط غير مكتمل'}</h2><div class="grid"><div class="tile"><b>رمز الوصول</b>${env.WHATSAPP_TOKEN?'موجود ومحمي':'غير موجود'}</div><div class="tile"><b>Phone Number ID</b>${env.WHATSAPP_PHONE_NUMBER_ID?'موجود':'غير موجود'}</div><div class="tile"><b>الوضع</b>${escapeHtml(env.WHATSAPP_MODE||'غير محدد')}</div><div class="tile"><b>الرابط الرسمي</b><span class="ltr">${escapeHtml(origin)}</span></div></div></div>${ready?`<form method="post" action="/club-admin/notifications/quick-test"><button class="send">إرسال اختبار الآن إلى <span class="ltr">+${recipient}</span></button></form>`:'<p>أكمل إعداد WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID داخل Cloudflare.</p>'}<div class="actions"><a class="back" href="/club-admin">العودة للمركز</a><a class="health" href="/club-admin/notifications/health">فحص حالة الربط</a></div><p class="note">المرحلة الحالية تجريبية عبر Meta. بعد تثبيت الرقم الإنتاجي واعتماد قوالب الرسائل، سيتم تحويل التنبيهات إلى تشغيل تلقائي للعضوية والدفع.</p></div></main></body></html>`);
    }

    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let page = await response.text();
    if (path === '/club-admin') {
      page = page.replace('</main>', `<section style="margin:24px 0;padding:18px;border:1px solid #d5a92888;border-radius:20px;background:#08265dcc"><h2 style="margin-top:0;color:#d5a928">واتساب العضوية</h2><p>إدارة اختبار وربط إشعارات العضوية والدفع عبر WhatsApp Cloud API.</p><a href="/club-admin/notifications" style="display:inline-block;background:#25D366;color:#06233f;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900">فتح مركز إشعارات واتساب</a></section></main>`);
    }
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store, max-age=0');
    headers.set('x-wadnofei-ui','v21-whatsapp-domain');
    return new Response(page,{status:response.status,statusText:response.statusText,headers});
  }
};

async function sendWhatsApp(env,to,message){
  try{
    const r=await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:'POST',
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:message}})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) return {ok:false,error:data?.error?.message||`HTTP ${r.status}`,details:data};
    return {ok:true,id:data?.messages?.[0]?.id||null};
  }catch(err){return {ok:false,error:String(err?.message||err)}}
}

function normalizePhone(v){let s=String(v||'').replace(/\D/g,'');if(s.startsWith('0'))s='249'+s.slice(1);if(!s.startsWith('249'))s='249'+s;return s}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function html(body){return new Response(body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
