import app from './worker-global-v33.js';
import { LOGO_B64 } from './logo.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url), p=u.pathname.replace(/\/$/,'')||'/', m=req.method.toUpperCase();
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    const isPublic=m==='GET'&&(p==='/'||p==='/membership'||p==='/membership/join'||p==='/join');
    if(isPublic&&ct.includes('text/html')){
      let html=await response.text();
      // Ensure exactly one prominent official crest at the very top of the public site.
      html=html.replace(/<div id="wdn-official-logo-top"[\s\S]*?<\/div>/gi,'');
      const css=`<style id="wdn-v34-brand">
      #wdn-v34-top{background:linear-gradient(180deg,#061a43 0%,#082b69 100%);border-bottom:1px solid #d5a92866;padding:14px 12px 10px;text-align:center}
      #wdn-v34-top img{display:block;width:190px;max-width:52vw;height:auto;margin:0 auto;background:#fff;border-radius:22px;box-shadow:0 10px 30px #0007}
      #wdn-v34-top .name{margin-top:8px;color:#fff;font-weight:900;font-size:20px;line-height:1.45}
      #wdn-v34-top .since{color:#e2b735;font-weight:800;font-size:14px;margin-top:2px}
      @media(max-width:430px){#wdn-v34-top img{width:170px;max-width:48vw}#wdn-v34-top .name{font-size:18px}}
      </style>`;
      const brand=`<section id="wdn-v34-top" aria-label="هوية نادي ود نفيع"><img src="data:image/jpeg;base64,${LOGO_B64}" alt="شعار نادي ود نفيع"><div class="name">نادي ود نفيع الرياضي الثقافي الاجتماعي</div><div class="since">تأسس عام 1964</div></section>`;
      html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;
      html=html.replace(/<body([^>]*)>/i,`<body$1>${brand}`);
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');h.set('x-wadnofei-ui','v34-official-top');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
