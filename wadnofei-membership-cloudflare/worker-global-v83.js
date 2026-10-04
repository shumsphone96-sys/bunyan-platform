import app from './worker-global-v82.js';
import {ensureCore} from './core-schema.js';

const ORIGIN='https://members.shamsphone.net';
const RELEASE='v83-production-hardening';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';
const releaseSchemaReady=new WeakMap();

const PUBLIC_ROUTES=[
  '/','/about','/activities','/news','/team','/board','/achievements','/projects',
  '/events','/sponsors','/gallery','/history','/identity','/constitution','/membership','/contact'
];

async function ensureReleaseSchema(db){
  if(!releaseSchemaReady.has(db)){
    releaseSchemaReady.set(db,(async()=>{
      await ensureCore(db);
      const duplicate=await db.prepare(
        "SELECT application_id,COUNT(*) c FROM members WHERE application_id IS NOT NULL GROUP BY application_id HAVING COUNT(*)>1 LIMIT 1"
      ).first();
      if(duplicate)throw new Error('DUPLICATE_APPLICATION_MEMBERS');
      await db.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS wdn_one_member_per_application ON members(application_id) WHERE application_id IS NOT NULL"
      ).run();
      const indexes=(await db.prepare("PRAGMA index_list(members)").all()).results.map(x=>x.name);
      if(!indexes.includes('wdn_one_member_per_application'))throw new Error('MEMBERSHIP_CONSTRAINT_MISSING');
      return true;
    })().catch(error=>{releaseSchemaReady.delete(db);throw error}));
  }
  return releaseSchemaReady.get(db);
}

async function releaseHealth(db,env){
  let schemaReady=false;
  let schemaError='';
  try{schemaReady=await ensureReleaseSchema(db)}catch(error){schemaError=String(error?.message||'SCHEMA_NOT_READY')}
  return {
    ok:schemaReady,
    app:'wadnofei-membership',
    release:RELEASE,
    schema_ready:schemaReady,
    schema_error:schemaReady?'':schemaError,
    whatsapp_send_ready:!!(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID),
    whatsapp_receipt_signature_ready:!!(env.WHATSAPP_APP_SECRET||env.META_APP_SECRET),
    runtime_bootstrap:env.RUNTIME_SCHEMA_BOOTSTRAP||'on'
  };
}

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
      if(!env.DB)return response(JSON.stringify({ok:false,app:'wadnofei-membership',release:RELEASE,schema_ready:false,schema_error:'DB_UNAVAILABLE'}),'application/json; charset=utf-8',503,'no-store');
      const health=await releaseHealth(env.DB,env);
      return response(JSON.stringify(health),'application/json; charset=utf-8',health.ok?200:503,'no-store');
    }

    const res=await app.fetch(req,env,ctx);
    const headers=new Headers(res.headers);
    headers.set('x-wadnofei-release',RELEASE);
    headers.set('x-wadnofei-runtime',env.RUNTIME_SCHEMA_BOOTSTRAP==='off'?'fast-schema':'bootstrap');
    if(url.protocol==='https:')headers.set('strict-transport-security','max-age=31536000; includeSubDomains');
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
  },
  async scheduled(event,env,ctx){
    if(env.DB){
      const task=ensureReleaseSchema(env.DB).catch(error=>console.error('WDN_RELEASE_SCHEMA',error?.message||'error'));
      if(ctx&&ctx.waitUntil)ctx.waitUntil(task); else await task;
    }
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};
