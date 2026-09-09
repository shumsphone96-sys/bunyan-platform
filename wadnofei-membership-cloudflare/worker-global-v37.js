import app from './worker-global-v32.js';
import { LOGO_B64 } from './logo.js';

const LOGO=`data:image/jpeg;base64,${LOGO_B64}`;

export default {
  async fetch(req,env,ctx){
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(!ct.includes('text/html')) return response;

    let html=await response.text();
    const css=`<style id="wdn-v37-logo">
      .wdn-logo-clean{display:block!important;object-fit:contain!important;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}
      .wdn-logo-header{width:74px!important;height:74px!important;min-width:74px!important}
      .wdn-logo-card{width:130px!important;height:130px!important;margin:0 auto 16px!important}
      @media(max-width:430px){.wdn-logo-header{width:68px!important;height:68px!important;min-width:68px!important}.wdn-logo-card{width:118px!important;height:118px!important}}
    </style>`;

    // Replace the visible WDN badge server-side before the page is sent.
    html=html.replace(/<([a-z0-9]+)([^>]*)>\s*WDN\s*<\/\1>/gi,`<img class="wdn-logo-clean wdn-logo-header" src="${LOGO}" alt="شعار نادي ود نفيع">`);

    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    // Replace every legacy club-logo image in its existing position; do not add new logo blocks.
    const script=`<script id="wdn-v37-logo-fix">(()=>{const src=${JSON.stringify(LOGO)};
      function replaceNode(el,cls){const im=document.createElement('img');im.src=src;im.alt='شعار نادي ود نفيع';im.className='wdn-logo-clean '+cls;el.replaceWith(im);}
      function run(){
        document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&el.textContent.trim()==='WDN')replaceNode(el,'wdn-logo-header')});
        document.querySelectorAll('img').forEach(img=>{
          if(img.src===src||img.classList.contains('wdn-logo-clean'))return;
          const alt=(img.alt||'').toLowerCase(), s=(img.getAttribute('src')||'').toLowerCase();
          const txt=(img.closest('section,article,header,nav,div')?.innerText||'');
          const headerArea=!!img.closest('header,nav')||/نادي\s*ود\s*نفيع/.test(txt)&&img.getBoundingClientRect().top<430;
          const memberCard=/طلب\s*عضوية\s*نادي\s*ود\s*نفيع/.test(txt);
          const logoHint=/شعار|logo|crest|wdn|club/.test(alt+' '+s);
          const smallish=(img.naturalWidth||img.width||0)<=700&&(img.naturalHeight||img.height||0)<=700;
          if(headerArea&&(logoHint||smallish)){img.src=src;img.alt='شعار نادي ود نفيع';img.className='wdn-logo-clean wdn-logo-header';}
          else if(memberCard&&(logoHint||smallish)){img.src=src;img.alt='شعار نادي ود نفيع';img.className='wdn-logo-clean wdn-logo-card';}
        });
      }
      run();document.addEventListener('DOMContentLoaded',run);new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
    })();</script>`;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');h.set('x-wadnofei-ui','v37-logo-in-place');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
