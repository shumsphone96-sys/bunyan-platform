import app from './worker-global-v32.js';
import { LOGO_V41_B64 } from './logo-v41.js';

const LOGO_PATH='/assets/wdn-logo-v41.jpg';

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
    const src=LOGO_PATH+'?v=41';

    const css=`<style id="wdn-v41-logo">
      .wdn-v41-logo{display:block!important;object-fit:contain!important;background:#fff!important;border:0!important;box-shadow:none!important;border-radius:14px!important}
      .wdn-v41-header{width:74px!important;height:74px!important;min-width:74px!important}
      .wdn-v41-card{width:126px!important;height:126px!important;margin:0 auto 16px!important}
      @media(max-width:430px){.wdn-v41-header{width:68px!important;height:68px!important;min-width:68px!important}.wdn-v41-card{width:116px!important;height:116px!important}}
    </style>`;
    html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;

    const script=`<script id="wdn-v41-force-logo">(()=>{
      const src=${JSON.stringify(src)};
      const makeLogo=(cls)=>{const i=document.createElement('img');i.src=src;i.alt='شعار نادي ود نفيع';i.className='wdn-v41-logo '+cls;return i};
      const swap=(el,cls)=>{if(!el||el.classList?.contains('wdn-v41-logo'))return;el.replaceWith(makeLogo(cls))};
      function run(){
        document.querySelectorAll('*').forEach(el=>{
          if(el.children.length===0 && (el.textContent||'').trim()==='WDN') swap(el,'wdn-v41-header');
        });

        document.querySelectorAll('header,nav,.header,.topbar,.brand,[class*=brand]').forEach(area=>{
          if(!(area.innerText||'').includes('نادي ود نفيع')) return;
          const old=area.querySelector('img:not(.wdn-v41-logo),svg,[class*=logo]:not(.wdn-v41-logo),[class*=badge],[class*=crest]');
          if(old) swap(old,'wdn-v41-header');
        });

        document.querySelectorAll('h1,h2,h3,strong,b').forEach(title=>{
          if(!(title.textContent||'').includes('طلب عضوية نادي ود نفيع')) return;
          let box=title.parentElement;
          for(let n=0;n<4&&box;n++,box=box.parentElement){
            const old=box.querySelector('img:not(.wdn-v41-logo),svg,[class*=logo]:not(.wdn-v41-logo),[class*=badge],[class*=crest]');
            if(old){swap(old,'wdn-v41-card');break;}
          }
        });

        document.querySelectorAll('img:not(.wdn-v41-logo)').forEach(img=>{
          const hint=((img.alt||'')+' '+(img.getAttribute('src')||'')+' '+(img.className||'')).toLowerCase();
          if(hint.includes('ود نفيع')||hint.includes('wdn')||hint.includes('club-logo')||hint.includes('club_logo')||hint.includes('crest')){
            const r=img.getBoundingClientRect();
            img.src=src;img.alt='شعار نادي ود نفيع';img.className='wdn-v41-logo '+((r.width>90||r.height>90)?'wdn-v41-card':'wdn-v41-header');
          }
        });
      }
      run();
      document.addEventListener('DOMContentLoaded',run);
      setTimeout(run,200);setTimeout(run,700);setTimeout(run,1500);
      new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true});
    })();</script>`;
    html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;

    const h=new Headers(response.headers);
    h.delete('content-length');
    h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');
    h.set('x-wadnofei-ui','v41-exact-logo-fixed-selectors');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
