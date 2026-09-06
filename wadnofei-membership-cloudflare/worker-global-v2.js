import app from './worker-quickedit.js';

const APP_VERSION = '2.1-global';

export default {
  async fetch(request, env, ctx) {
    // توحيد هوية النادي: كل أرقام الطلبات القديمة والجديدة تصبح WDN-REQ-xxxxx
    if (env.DB) {
      try {
        await env.DB.prepare("UPDATE applications SET application_no='WDN-' || application_no WHERE application_no LIKE 'REQ-%'").run();
      } catch (_) {}
    }

    const response = await app.fetch(request, env, ctx);

    // بعد أي عملية إنشاء طلب، طبّق الهوية فوراً قبل الطلب التالي.
    if (env.DB && request.method === 'POST' && new URL(request.url).pathname.replace(/\/$/, '') === '/applications/new') {
      try {
        await env.DB.prepare("UPDATE applications SET application_no='WDN-' || application_no WHERE application_no LIKE 'REQ-%'").run();
      } catch (_) {}
    }

    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('X-WDN-Version', APP_VERSION);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
