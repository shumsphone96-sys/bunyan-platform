import app from './worker-global-v32.js';
import { LOGO_V41_B64 } from './logo-v41.js';

const LOGO_PATH='/assets/wdn-logo-v42.jpg';
const LOGO_TAG=`<img class="wdn-v42-logo" src="${LOGO_PATH}?v=42" alt="شعار نادي ود نفيع">`;

function logoResponse(){
  const raw=atob(LOGO_V41_B64);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return new Response(bytes,{headers:{
    'content-type':'image/jpeg',
    'cache-control':'no-store, no-cache, must-revalidate, max-age=0',
    'x-content-type-options':'nosniff'
  }});
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname===LOGO_PATH) return logoResponse();

    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(!ct.includes('text/html')) return response;

    let html=await response.text();
    const p=u.pathname.replace(/\/$/,'')||'/';
    const isPublicMembership=p==='/'||p==='/membership'||p==='/membership/join'||p==='/join';

    const css=`<style id="wdn-v42-logo-style">
      .wdn-v42-logo{display:block!important;object-fit:contain!important;background:#fff!important;border:0!important;box-shadow:none!important;border-radius:14px!important}
      header .wdn-v42-logo,nav .wdn-v42-logo,.header .wdn-v42-logo,.topbar .wdn-v42-logo,.brand .wdn-v42-logo{width:68px!important;height:68px!important;min-width:68px!important;margin:0!important}
      main .wdn-v42-logo,.card .wdn-v42-logo,section .wdn-v42-logo,article .wdn-v42-logo{width:118px!important;height:118px!important;margin:0 auto 16px!important}
      @media(max-width:430px){header .wdn-v42-logo,nav .wdn-v42-logo,.header .wdn-v42-logo,.topbar .wdn-v42-logo,.brand .wdn-v42-logo{width:58px!important;height:58px!important;min-width:58px!important}main .wdn-v42-logo,.card .wdn-v42-logo,section .wdn-v42-logo,article .wdn-v42-logo{width:108px!important;height:108px!important}}
    </style>`;
    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    // Server-side replacement: no inline JavaScript and no CSP dependency.
    html=html.replace(/>\s*WDN\s*</gi,`>${LOGO_TAG}<`);

    // Replace explicit legacy club-logo images everywhere.
    html=html.replace(/<img\b[^>]*(?:alt|src|class)=["'][^"']*(?:ود\s*نفيع|wdn|club[-_ ]?logo|crest)[^"']*["'][^>]*>/gi,LOGO_TAG);

    // On the public membership page the existing images are only club branding;
    // replace them all so the broken/question-mark image cannot survive.
    if(isPublicMembership){
      html=html.replace(/<img\b[^>]*>/gi,LOGO_TAG);
    }

    const h=new Headers(response.headers);
    h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v42-server-logo');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
