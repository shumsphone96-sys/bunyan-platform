import { adminGate as checkedAdminGate } from './auth.js';
import app from './worker-global-v50.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(p==='/club-admin/readiness'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      // Readiness must never repair or activate member records on GET.
      return app.fetch(req,env,ctx);
    }
    const r=await app.fetch(req,env,ctx);
    if(r.headers.get('content-type')?.includes('text/html')){
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v51-readiness-self-heal');
      return new Response(await r.text(),{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function adminGate(req,env,ctx){return checkedAdminGate(req,env)}

async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return (r.results||[]).map(x=>x.name)}catch(_){return []}}

// Repairs require a separate, explicit, audited operation.
