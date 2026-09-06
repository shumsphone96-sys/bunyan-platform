import app from './worker-global-v16.js';

const CLUB_PHONE='249912930540';

export default {
  async fetch(req, env, ctx) {
    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    const url = new URL(req.url);
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();

    if (url.pathname === '/club-admin') {
      const wa = `<section style="margin:24px 0;padding:18px;border:1px solid #d5a92888;border-radius:20px;background:#08265dcc"><h2 style="margin-top:0;color:#d5a928">واتساب العضوية</h2><p>اختبار الإرسال ومراجعة سجل رسائل العضوية والدفع من مكان واحد.</p><a href="/club-admin/notifications" style="display:inline-block;background:#25D366;color:#06233f;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900">فتح اختبار واتساب</a></section>`;
      html = html.replace('</main>', wa + '</main>');
    }

    if (url.pathname === '/club-admin/notifications') {
      const quick = `<div style="margin:14px 0;display:flex;gap:10px;flex-wrap:wrap"><a href="https://wa.me/${CLUB_PHONE}" target="_blank" rel="noopener" style="background:#25D366;color:#06233f;text-decoration:none;padding:11px 14px;border-radius:12px;font-weight:900">فتح واتساب على رقم النادي</a><span style="padding:11px 14px;border:1px solid #d5a92855;border-radius:12px">الإرسال الآلي يعمل من زر «إرسال اختبار» داخل النموذج أعلاه عند وجود WHATSAPP_TOKEN في Cloudflare.</span></div>`;
      html = html.replace('</h1>', '</h1>'+quick);
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store, max-age=0');
    headers.set('x-wadnofei-ui','v17-whatsapp-actions');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
};
