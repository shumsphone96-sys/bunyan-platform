import app from './worker-global-v17.js';

const CLUB_PHONE='249912930540';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/,'') || '/';

    if (path === '/club-admin/notifications/health') {
      return new Response(JSON.stringify({
        ok: true,
        whatsapp: {
          token: !!env.WHATSAPP_TOKEN,
          phone_number_id: !!env.WHATSAPP_PHONE_NUMBER_ID,
          business_account_id: !!env.WHATSAPP_BUSINESS_ACCOUNT_ID,
          mode: env.WHATSAPP_MODE || 'unset',
          recipient: CLUB_PHONE
        }
      }, null, 2), {
        headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      });
    }

    if (path === '/club-admin/notifications/quick-test' && req.method === 'POST') {
      const fd = new FormData();
      fd.set('name','اختبار النظام');
      fd.set('phone',CLUB_PHONE);
      fd.set('message','رسالة اختبار من نظام عضوية نادي ود نفيع — ربط WhatsApp Cloud API يعمل من داخل الموقع.');
      const target = new URL('/club-admin/notifications/test', url.origin);
      const forwarded = new Request(target, {
        method:'POST',
        headers:{'cookie':req.headers.get('cookie') || ''},
        body:fd
      });
      return app.fetch(forwarded, env, ctx);
    }

    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();

    if (path === '/club-admin/notifications') {
      const ready = !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
      const status = `<section class="v18-wa"><div class="v18-head"><div><span>حالة الربط</span><h2>${ready?'✅ واتساب جاهز للاختبار من الموقع':'⚠️ الربط البرمجي غير مكتمل'}</h2></div><span class="v18-pill ${ready?'ok':'wait'}">${ready?'متصل':'بانتظار التوكن'}</span></div><div class="v18-meta"><b>Phone Number ID:</b> ${env.WHATSAPP_PHONE_NUMBER_ID?'موجود':'غير موجود'} · <b>Token:</b> ${env.WHATSAPP_TOKEN?'موجود ومحمي':'غير موجود'} · <b>الوضع:</b> ${env.WHATSAPP_MODE || 'غير محدد'}</div>${ready?`<form method="post" action="/club-admin/notifications/quick-test"><button class="v18-test">إرسال اختبار الآن إلى +${CLUB_PHONE}</button></form>`:`<p>أضف <code>WHATSAPP_TOKEN</code> كـ Secret داخل Cloudflare، ثم ارجع لهذه الصفحة واضغط اختبار.</p>`}<a class="v18-health" href="/club-admin/notifications/health">فحص حالة الربط</a></section>`;
      html = html.replace('<h1>إشعارات العضوية والدفع</h1>','<h1>إشعارات العضوية والدفع</h1>'+status);
    }

    const css = `<style>.v18-wa{margin:16px 0 20px;padding:18px;border:1px solid #d5a92888;border-radius:20px;background:linear-gradient(145deg,#061a43ee,#0a347cee)}.v18-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.v18-head span{color:#9ebcff;font-weight:900}.v18-head h2{margin:4px 0;color:#d5a928}.v18-pill{padding:8px 11px;border-radius:999px;font-weight:900}.v18-pill.ok{background:#25D366;color:#06233f}.v18-pill.wait{background:#ffd166;color:#4b3700}.v18-meta{margin:12px 0;padding:12px;border-radius:12px;background:#ffffff0b;line-height:1.8}.v18-test{border:0;background:#25D366;color:#06233f;padding:12px 16px;border-radius:12px;font-weight:900;font-size:1rem}.v18-health{display:inline-block;margin-top:12px;color:#ffe59a;text-decoration:none;border:1px solid #d5a92855;padding:8px 11px;border-radius:10px}code{direction:ltr;display:inline-block}</style>`;
    html = html.replace('</head>', css + '</head>');

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store, max-age=0');
    headers.set('x-wadnofei-ui','v18-whatsapp-health');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
};
