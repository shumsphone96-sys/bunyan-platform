import app from './worker-global-v15.js';

const CLUB_PHONE='249912930540';

export default {
  async fetch(req, env, ctx) {
    // Expose the club contact number as a safe default for notification testing/admin UI.
    // Real WhatsApp sending still requires WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID
    // from Meta's WhatsApp Business Platform.
    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    const url = new URL(req.url);
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();
    if (url.pathname === '/club-admin/notifications') {
      html = html.replace('placeholder="249..."', `value="${CLUB_PHONE}" placeholder="249..."`);
      html = html.replace(
        '<h1>إشعارات العضوية والدفع</h1>',
        `<h1>إشعارات العضوية والدفع</h1><div class="summary"><b>رقم واتساب/هاتف النادي المعتمد للاختبار: +${CLUB_PHONE}</b><br><small>لإرسال واتساب الحقيقي من هذا الرقم يجب ربطه في Meta وإضافة WHATSAPP_PHONE_NUMBER_ID وWHATSAPP_TOKEN داخل Cloudflare.</small></div>`
      );
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, max-age=0');
    headers.set('x-wadnofei-ui', 'v16-contact-phone');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
