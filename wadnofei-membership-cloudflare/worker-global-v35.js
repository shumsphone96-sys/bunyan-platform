import app from './worker-global-v34.js';
import { LOGO_B64 } from './logo.js';

const LOGO=`data:image/jpeg;base64,${LOGO_B64}`;

export default {
  async fetch(req,env,ctx){
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(!ct.includes('text/html')) return response;

    let html=await response.text();
    const css=`<style id="wdn-v35-logo">
      #wdn-v34-top .name,#wdn-v34-top .since{display:none!important}
      #wdn-v34-top{padding:14px 12px!important}
      #wdn-v34-top img{width:150px!important;max-width:38vw!important;border-radius:18px!important}
      .wdn-clean-logo{display:block;object-fit:contain;background:#fff;border-radius:18px}
    </style>`;
    const script=`<script id="wdn-v35-logo-script">(()=>{const src=${JSON.stringify(LOGO)};function fix(){document.querySelectorAll('img').forEach(i=>{const a=(i.alt||'');if(/شعار.*ود نفيع|ود نفيع.*شعار|wdn/i.test(a))i.src=src});document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&el.textContent.trim()==='WDN'){const im=document.createElement('img');im.src=src;im.alt='شعار نادي ود نفيع';im.className='wdn-clean-logo';im.style.width='78px';im.style.height='78px';el.replaceWith(im)}})}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fix):fix()})();</script>`;

    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);
    h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v35-clean-logo-everywhere');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
