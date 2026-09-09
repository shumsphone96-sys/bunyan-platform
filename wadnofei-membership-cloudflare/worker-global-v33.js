import app from './worker-global-v32.js';
import { LOGO_B64 } from './logo.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    const isPublic=m==='GET'&&(p==='/'||p==='/membership'||p==='/membership/join'||p==='/join');

    if(isPublic&&ct.includes('text/html')){
      let html=await response.text();
      const css=`<style id="wdn-v33-top-logo">
        #wdn-official-logo-top{display:flex;justify-content:center;align-items:center;padding:16px 10px 10px;background:#061a43}
        #wdn-official-logo-top img{display:block;width:min(156px,42vw);height:auto;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.28)}
        @media(min-width:700px){#wdn-official-logo-top img{width:184px}}
      </style>`;
      const brand=`<div id="wdn-official-logo-top" aria-label="شعار نادي ود نفيع"><img src="data:image/jpeg;base64,${LOGO_B64}" alt="شعار نادي ود نفيع"></div>`;

      html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;
      if(!html.includes('id="wdn-official-logo-top"')){
        html=html.replace(/<body([^>]*)>/i,`<body$1>${brand}`);
      }

      const h=new Headers(response.headers);
      h.delete('content-length');
      h.set('cache-control','no-store, max-age=0');
      h.set('x-wadnofei-ui','v33-top-logo');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }

    return response;
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
