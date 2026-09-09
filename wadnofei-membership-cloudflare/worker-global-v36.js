import app from './worker-global-v32.js';
import { LOGO_B64 } from './logo.js';

const LOGO=`data:image/jpeg;base64,${LOGO_B64}`;

export default {
  async fetch(req,env,ctx){
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(!ct.includes('text/html')) return response;

    const u=new URL(req.url);
    const p=u.pathname.replace(/\/$/,'')||'/';
    let html=await response.text();

    const css=`<style id="wdn-v36-brand">
      .wdn-v36-top{background:#061a43;border-bottom:1px solid #d5a92866;padding:14px 12px 10px;text-align:center}
      .wdn-v36-top img{display:block;width:150px;max-width:42vw;height:auto;margin:0 auto;object-fit:contain;border:0;background:transparent;box-shadow:none;border-radius:0}
      .wdn-v36-inline-logo{display:inline-block!important;width:58px!important;height:58px!important;object-fit:contain!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;vertical-align:middle!important}
      .wdn-v36-card-logo{display:block!important;width:112px!important;height:112px!important;object-fit:contain!important;margin:0 auto 14px!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      @media(max-width:430px){.wdn-v36-top img{width:132px;max-width:38vw}.wdn-v36-inline-logo{width:52px!important;height:52px!important}}
    </style>`;

    // Remove all logo/header layers added by previous experimental versions.
    html=html.replace(/<section id="wdn-v34-top"[\s\S]*?<\/section>/gi,'');
    html=html.replace(/<div id="wdn-official-logo-top"[\s\S]*?<\/div>/gi,'');
    html=html.replace(/<style id="wdn-v33-top-logo">[\s\S]*?<\/style>/gi,'');
    html=html.replace(/<style id="wdn-v34-brand">[\s\S]*?<\/style>/gi,'');
    html=html.replace(/<style id="wdn-v35-logo">[\s\S]*?<\/style>/gi,'');
    html=html.replace(/<script id="wdn-v35-logo-script">[\s\S]*?<\/script>/gi,'');

    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    // Public pages: one clean crest at the very top, with NOTHING below it inside the logo block.
    if(p==='/'||p==='/membership'||p==='/membership/join'||p==='/join'){
      const top=`<div class="wdn-v36-top" aria-label="شعار نادي ود نفيع"><img src="${LOGO}" alt="شعار نادي ود نفيع"></div>`;
      html=html.replace(/<body([^>]*)>/i,`<body$1>${top}`);
    }

    // Replace every current legacy crest / WDN badge with the same official clean logo.
    html=html.replace(/<img([^>]*alt=["'][^"']*(?:شعار[^"']*ود نفيع|ود نفيع[^"']*شعار)[^"']*["'][^>]*)>/gi,`<img$1 src="${LOGO}">`);
    html=html.replace(/>(\s*)WDN(\s*)</g,`><img class="wdn-v36-inline-logo" src="${LOGO}" alt="شعار نادي ود نفيع"><`);

    // Force all club-logo images, including the small logo beside the site title and the membership-card logo.
    const script=`<script id="wdn-v36-logo-fix">(()=>{const src=${JSON.stringify(LOGO)};function run(){
      document.querySelectorAll('img').forEach(img=>{const alt=(img.alt||'').toLowerCase();const s=(img.getAttribute('src')||'').toLowerCase();if(alt.includes('شعار')&&alt.includes('ود نفيع')){img.src=src;img.classList.add('wdn-v36-card-logo')}if(s.includes('logo')&&img.closest('header,nav,.brand,.hero')){img.src=src;img.classList.add('wdn-v36-inline-logo')}});
      document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&el.textContent.trim()==='WDN'){const im=document.createElement('img');im.src=src;im.alt='شعار نادي ود نفيع';im.className='wdn-v36-inline-logo';el.replaceWith(im)}})
    }document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run()})();</script>`;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);
    h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v36-logo-rebuild');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
