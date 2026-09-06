import app from './worker-global-v5.js';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const isStagePost = req.method === 'POST' && /^\/applications\/\d+\/stage\/(received|review|needs-info|ready|approve|reject)$/.test(path);

    const res = await app.fetch(req, env, ctx);

    // Stage actions are processed by V5 (including auth + DB changes).
    // Instead of forcing an immediate 303 redirect on mobile Safari,
    // show a clear Arabic confirmation page with a manual return button.
    if (isStagePost && res.status === 303) {
      const action = path.split('/').pop();
      const labels = {
        received: 'تم إرجاع الطلب إلى مرحلة الاستلام',
        review: 'تم نقل الطلب إلى مرحلة المراجعة',
        'needs-info': 'تم إرسال طلب استكمال البيانات',
        ready: 'تم تجهيز الطلب للاعتماد',
        approve: 'تم اعتماد العضوية بنجاح',
        reject: 'تم رفض الطلب وتسجيل السبب'
      };
      return new Response(success(labels[action] || 'تم تحديث الطلب بنجاح'), {
        status: 200,
        headers: securityHeaders('text/html; charset=utf-8')
      });
    }

    // Improve labels on the applications page so each required note is obvious.
    if (req.method === 'GET' && path === '/applications' && res.headers.get('content-type')?.includes('text/html')) {
      let body = await res.text();
      body = body.replaceAll(
        'name="admin_note" placeholder="اكتب الملاحظة للمتقدم" required><button class="mini " type="submit">طلب استكمال</button>',
        'name="admin_note" placeholder="اكتب ما المطلوب استكماله" aria-label="ملاحظة طلب الاستكمال" required><button class="mini " type="submit">طلب استكمال</button>'
      );
      body = body.replaceAll(
        'name="admin_note" placeholder="اكتب الملاحظة للمتقدم" required><button class="mini danger" type="submit">رفض</button>',
        'name="admin_note" placeholder="اكتب سبب الرفض" aria-label="سبب الرفض" required><button class="mini danger" type="submit">رفض</button>'
      );
      body = body.replace('</style>', `.stage-form.with-note{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.stage-form.with-note input{min-width:0}.stage-form:not(.with-note) input{display:none}@media(max-width:640px){.stage-form.with-note{grid-template-columns:1fr}.stage-form.with-note button{width:100%}}</style>`);
      return new Response(body, { status: res.status, headers: cloneSafeHeaders(res.headers) });
    }

    return res;
  }
};

function success(message) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message}</title><style>:root{--b:#0a347c;--d:#061a43;--g:#d5a928}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,var(--d),var(--b));font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;color:#fff;padding:24px}.card{width:min(520px,100%);background:#08275f;border:1px solid #d5a92888;border-radius:24px;padding:28px;text-align:center;box-shadow:0 20px 60px #0006}.icon{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;background:#149b55;font-size:38px;font-weight:900}.card h1{margin:0 0 10px;font-size:24px}.card p{opacity:.9;line-height:1.8}.btn{display:block;margin-top:20px;background:var(--g);color:#061a43;text-decoration:none;font-weight:900;padding:14px 18px;border-radius:14px}</style></head><body><main class="card"><div class="icon">✓</div><h1>${message}</h1><p>تم حفظ التغيير في نظام نادي ود نفيع.</p><a class="btn" href="/applications">العودة إلى طلبات العضوية</a></main></body></html>`;
}

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"
  };
}

function cloneSafeHeaders(headers) {
  const out = new Headers(headers);
  out.set('x-content-type-options','nosniff');
  out.set('x-frame-options','DENY');
  return out;
}
