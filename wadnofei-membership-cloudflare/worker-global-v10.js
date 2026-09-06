import app from './worker-global-v9.js';
import { LOGO_B64, LOGO_MIME } from './logo.js';

const CLUB = 'نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO = `data:${LOGO_MIME};base64,${LOGO_B64}`;
const GOLD = '#d5a928';
const BLUE = '#0a347c';
const DARK = '#061a43';

export default {
  async fetch(req, env, ctx) {
    const response = await app.fetch(req, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (req.method !== 'GET' || !type.includes('text/html')) return response;

    let html = await response.text();
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    html = html.replace(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g, LOGO);
    html = html
      .replace(/الصلاحية الحالية:\s*owner/gi, 'الصلاحية الحالية: مالك النظام')
      .replace(/>\s*owner\s*</gi, '>مالك النظام<');

    html = html.replace(
      `<header><b>${CLUB}</b>`,
      `<header><a class="wdn-brand" href="/club-admin"><img class="wdn-logo-sm" src="${LOGO}" alt="شعار نادي ود نفيع"><span><b>${CLUB}</b><small>تأسس عام 1964</small></span></a>`
    );

    if (path === '/club-admin') {
      html = html.replace(
        '<section class="hero"><h1>',
        `<section class="hero wdn-hero"><img class="wdn-logo-hero" src="${LOGO}" alt="الشعار الرسمي لنادي ود نفيع"><div><p class="wdn-kicker">الرياضي · الثقافي · الاجتماعي</p><h1>`
      );
      html = html.replace(
        '</h1><p>إدارة النادي من مكان واحد: رياضة، أصول، وثائق، نشاط، مال، إعلام، ورقابة.</p></section>',
        '</h1><p>إدارة العضوية والرياضة والمال والوثائق والنشاط والأصول والإعلام والرقابة من مكان واحد.</p></div></section>'
      );
    }

    const polish = `
<style id="wdn-v10-polish">
:root{--wdn-blue:${BLUE};--wdn-dark:${DARK};--wdn-gold:${GOLD}}
.wdn-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;min-width:0}
.wdn-brand span{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.wdn-brand b{color:var(--wdn-gold);font-weight:900}
.wdn-brand small{color:#fff;opacity:.72;margin-top:3px;font-size:.72rem}
.wdn-logo-sm{width:54px;height:54px;object-fit:contain;border-radius:16px;background:#fff;padding:3px;box-shadow:0 6px 20px #0004;border:1px solid #d5a92888}
.wdn-hero{display:flex!important;align-items:center;gap:22px}
.wdn-logo-hero{width:118px;height:118px;object-fit:contain;flex:0 0 auto;border-radius:24px;background:#fff;padding:5px;box-shadow:0 12px 35px #0005;border:1px solid #d5a92899}
.wdn-kicker{margin:0 0 6px!important;color:#8fb4ff!important;font-weight:900;letter-spacing:.02em}
.stat,.tile,.panel,.card,article{backdrop-filter:saturate(120%)}
a,button,input,textarea,select{transition:.18s ease}
button:active,.btn:active,a.tile:active{transform:translateY(1px)}
@media(max-width:640px){
 .wdn-logo-sm{width:46px;height:46px;border-radius:13px}
 .wdn-brand b{font-size:.92rem}
 .wdn-brand small{font-size:.65rem}
 .wdn-hero{align-items:flex-start;gap:14px}
 .wdn-logo-hero{width:88px;height:88px;border-radius:18px}
 .wdn-kicker{font-size:.78rem}
}
</style>`;

    html = html.includes('</head>') ? html.replace('</head>', `${polish}</head>`) : polish + html;
    if (!html.includes('name="theme-color"')) {
      html = html.replace('<head>', `<head><meta name="theme-color" content="${DARK}">`);
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, max-age=0');
    headers.set('x-wadnofei-ui', 'v10');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
};
