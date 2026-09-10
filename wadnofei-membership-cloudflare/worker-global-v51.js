import app from './worker-global-v50.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(p==='/club-admin/readiness'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      try{await selfHeal(env.DB)}catch(_){ }
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

async function adminGate(req,env,ctx){
  try{
    const u=new URL(req.url);u.pathname='/club-admin';u.search='';
    const probe=await app.fetch(new Request(u.toString(),req),env,ctx);
    if(probe.status>=300&&probe.status<400)return new Response(null,{status:303,headers:{location:probe.headers.get('location')||'/login'}});
  }catch(_){return new Response(null,{status:303,headers:{location:'/login'}})}
  return null;
}

async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return (r.results||[]).map(x=>x.name)}catch(_){return []}}

async function selfHeal(db){
  if(!db)return;
  const mc=await cols(db,'members');
  for(const [n,t] of [['member_no','TEXT'],['qr_token','TEXT'],['full_name','TEXT'],['status','TEXT'],['membership_expires_at','TEXT']]){
    if(!mc.includes(n)){try{await db.prepare(`ALTER TABLE members ADD COLUMN ${n} ${t}`).run()}catch(_){}}
  }
  const rows=(await db.prepare(`SELECT * FROM members ORDER BY id`).all()).results||[];
  for(const m of rows){
    const sets=[],vals=[];
    if(!String(m.member_no||m.membership_no||'').trim()){
      sets.push('member_no=?');vals.push('WDN-'+String(Number(m.id)||0).padStart(5,'0'));
    }
    if(!String(m.qr_token||'').trim()){
      sets.push('qr_token=?');vals.push(crypto.randomUUID().replace(/-/g,''));
    }
    if(!String(m.full_name||'').trim()&&String(m.name||'').trim()){
      sets.push('full_name=?');vals.push(String(m.name).trim());
    }
    if(!String(m.status||'').trim()){
      sets.push('status=?');vals.push('active');
    }
    if(sets.length){vals.push(m.id);await db.prepare(`UPDATE members SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}
  }
  try{await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_qr_unique_v51 ON members(qr_token) WHERE qr_token IS NOT NULL').run()}catch(_){}
}
