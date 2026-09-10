import app from './worker-global-v32.js';
import { LOGO_V38_B64 } from './logo-v38.js';

const LOGO_PATH='/assets/wdn-logo-v40.jpg';

function logoResponse(){
  const raw=atob(LOGO_V38_B64);
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
    const src=`${LOGO_PATH}?v=40`;

    const css=`<style id="wdn-v40-logo">
      .wdn-v40-logo{display:block!important;object-fit:contain!important;background:#fff!important;border:0!important;box-shadow:none!important;border-radius:14px!important}
      .wdn-v40-header{width:74px!important;height:74px!important;min-width:74px!important}
      .wdn-v40-card{width:126px!important;height:126px!important;margin:0 auto 16px!important}
      @media(max-width:430px){.wdn-v40-header{width:68px!important;height:68px!important;min-width:68px!important}.wdn-v40-card{width:116px!important;height:116px!important}}
    </style>`;
    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    const script=`<script id="wdn-v40-force-logo">(()=>{const src=${JSON.stringify(src)};
      const mk=(cls)=>{const i=document.createElement('img');i.src=src;i.alt='شعار نادي ود نفيع';i.className='wdn-v40-logo '+cls;return i};
      function swap(el,cls){if(!el||el.dataset?.wdn40)return;const i=mk(cls);i.dataset.wdn40='1';el.replaceWith(i)}
      function run(){
        document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&/^\\s*WDN\\s*$/.test(el.textContent||''))swap(el,'wdn-v40-header')});
        document.querySelectorAll('header,nav,.header,.topbar,.brand,[class*=brand]').forEach(area=>{
          const t=area.innerText||'';if(!/نادي\\s*ود\\s*نفيع/.test(t))return;
          const c=[...area.querySelectorAll('img,svg,[class*=logo],[class*=badge],[class*=crest]')];
          for(const el of c){if(el.matches?.('.wdn-v40-logo'))continue;const r=el.getBoundingClientRect();if(r.width>20&&r.width<180&&r.height>20&&r.height<180){swap(el,'wdn-v40-header');break}}
        });
        document.querySelectorAll('section,article,div').forEach(area=>{
          const t=area.innerText||'';if(!/طلب\\s*عضوية\\s*نادي\\s*ود\\s*نفيع/.test(t))return;
          const c=[...area.querySelectorAll('img,svg,[class*=logo],[class*=badge],[class*=crest]')].filter(x=>!x.matches?.('.wdn-v40-logo'));
          if(c.length){const el=c[0],r=el.getBoundingClientRect();if(r.width<240&&r.height<240)swap(el,'wdn-v40-card')}
        });
        document.querySelectorAll('img').forEach(img=>{
          if(img.classList.contains('wdn-v40-logo')||img.dataset.wdn40)return;
          const a=(img.alt||'')+' '+(img.getAttribute('src')||'')+' '+(img.className||'');
          if(/ود\\s*نفيع|wdn|club[-_ ]?logo|crest/i.test(a)){
            const r=img.getBoundingClientRect();img.src=src;img.alt='شعار نادي ود نفيع';img.className='wdn-v40-logo '+(r.width>90||r.height>90?'wdn-v40-card':'wdn-v40-header');img.dataset.wdn40='1';
          }
        });
      }
      run();document.addEventListener('DOMContentLoaded',run);setTimeout(run,250);setTimeout(run,900);
      new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true});
    })();</script>`;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v40-exact-logo');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
