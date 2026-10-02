import app from './worker-global-v82.js';

const ORIGIN='https://members.shamsphone.net';
const RELEASE='v83-production-hardening';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';
const PUBLIC_ROUTES=[
  '/','/about','/activities','/news','/team','/board','/achievements','/projects',
  '/events','/sponsors','/gallery','/history','/identity','/constitution','/membership','/contact'
];

function response(body,type,status=200,cache='public, max-age=3600'){
  return new Response(body,{status,headers:{
    'content-type':type,
    'cache-control':cache,
    'x-content-type-options':'nosniff',
    'x-wadnofei-release':RELEASE
  }});
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const p=url.pathname.replace(/\/$/,'')||'/';
    const m=req.method.toUpperCase();

    if(m==='GET'&&p==='/robots.txt'){
      return response([
        'User-agent: *','Allow: /','Disallow: /club-admin','Disallow: /staff-login',
        'Disallow: /staff-recover','Disallow: /membership/track','Disallow: /membership/payment',
        'Disallow: /member-card','Disallow: /verify','Disallow: /webhooks',
        'Sitemap: '+ORIGIN+'/sitemap.xml',''
      ].join('\n'),'text/plain; charset=utf-8');
    }
    if(m==='GET'&&p==='/sitemap.xml'){
      const urls=PUBLIC_ROUTES.map(path=>'<url><loc>'+ORIGIN+path+'</loc></url>').join('');
      return response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>','application/xml; charset=utf-8');
    }
    if(m==='GET'&&p==='/manifest.webmanifest'){
      return response(JSON.stringify({
        name:'نادي ود نفيع الرياضي الثقافي الاجتماعي',
        short_name:'نادي ود نفيع',
        id:'/',start_url:'/',scope:'/',display:'standalone',
        background_color:'#f7f9fc',theme_color:'#102746',lang:'ar',dir:'rtl',
        icons:[{src:LOGO,type:'image/jpeg',purpose:'any'}]
      }),'application/manifest+json; charset=utf-8');
    }
    if(m==='GET'&&p==='/health'){
      return response(JSON.stringify({ok:true,app:'wadnofei-membership',release:RELEASE}),'application/json; charset=utf-8',200,'no-store');
    }

    const res=await app.fetch(req,env,ctx);
    const headers=new Headers(res.headers);
    headers.set('x-wadnofei-release',RELEASE);
    if(url.protocol==='https:')headers.set('strict-transport-security','max-age=31536000; includeSubDomains');
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};
