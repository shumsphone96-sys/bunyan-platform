import app from './worker-global-v32.js';
import { LOGO_V38_B64 } from './logo-v38.js';

const LOGO=`data:image/jpeg;base64,${LOGO_V38_B64}`;

export default {
  async fetch(req,env,ctx){
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(!ct.includes('text/html')) return response;

    let html=await response.text();
    const css=`<style id="wdn-v38-logo">
      .wdn-v38-logo{display:block!important;object-fit:contain!important;background:#fff!important;border:0!important;box-shadow:none!important;border-radius:14px!important}
      .wdn-v38-header{width:74px!important;height:74px!important;min-width:74px!important}
      .wdn-v38-card{width:126px!important;height:126px!important;margin:0 auto 16px!important}
      @media(max-width:430px){.wdn-v38-header{width:68px!important;height:68px!important;min-width:68px!important}.wdn-v38-card{width:116px!important;height:116px!important}}
    </style>`;
    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    // Replace simple WDN badge structures before sending HTML.
    html=html.replace(/<([a-z0-9]+)([^>]*)>\s*(?:<[^>]+>\s*)?WDN(?:\s*<\/[^>]+>)?\s*<\/\1>/gi,
      `<img class="wdn-v38-logo wdn-v38-header" src="${LOGO}" alt="شعار نادي ود نفيع">`);

    const script=`<script id="wdn-v38-force-logo">(()=>{const src=${JSON.stringify(LOGO)};
      const mk=(cls)=>{const i=document.createElement('img');i.src=src;i.alt='شعار نادي ود نفيع';i.className='wdn-v38-logo '+cls;return i};
      function swap(el,cls){if(!el||el.dataset?.wdn38)return;const i=mk(cls);i.dataset.wdn38='1';el.replaceWith(i)}
      function run(){
        // 1) Header badge beside club title: replace WDN text or the first compact visual beside the title.
        document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&/^\s*WDN\s*$/.test(el.textContent||''))swap(el,'wdn-v38-header')});
        document.querySelectorAll('header,nav,.header,.topbar,.brand,[class*=brand]').forEach(area=>{
          const t=area.innerText||''; if(!/نادي\s*ود\s*نفيع/.test(t))return;
          const candidates=[...area.querySelectorAll('img,svg,[class*=logo],[class*=badge],[class*=crest]')];
          for(const el of candidates){if(el.matches?.('.wdn-v38-logo'))continue;const r=el.getBoundingClientRect();if(r.width>20&&r.width<180&&r.height>20&&r.height<180){swap(el,'wdn-v38-header');break}}
        });
        // 2) Logo inside membership request card.
        document.querySelectorAll('section,article,div').forEach(area=>{
          const t=area.innerText||''; if(!/طلب\s*عضوية\s*نادي\s*ود\s*نفيع/.test(t))return;
          const imgs=[...area.querySelectorAll('img,svg,[class*=logo],[class*=badge],[class*=crest]')].filter(x=>!x.matches?.('.wdn-v38-logo'));
          if(imgs.length){const el=imgs[0];const r=el.getBoundingClientRect();if(r.width<240&&r.height<240)swap(el,'wdn-v38-card')}
        });
        // 3) Any legacy club logo image identified by alt/src/name hints.
        document.querySelectorAll('img').forEach(img=>{
          if(img.classList.contains('wdn-v38-logo')||img.dataset.wdn38)return;
          const a=(img.alt||'')+' '+(img.getAttribute('src')||'')+' '+(img.className||'');
          if(/ود\s*نفيع|wdn|club[-_ ]?logo|crest/i.test(a)){
            const r=img.getBoundingClientRect(); const cls=r.width>90||r.height>90?'wdn-v38-card':'wdn-v38-header';
            img.src=src;img.alt='شعار نادي ود نفيع';img.className='wdn-v38-logo '+cls;img.dataset.wdn38='1';
          }
        });
      }
      run();document.addEventListener('DOMContentLoaded',run);setTimeout(run,300);setTimeout(run,1200);
      new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true});
    })();</script>`;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);
    h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v38-exact-upload-logo');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
