import app from './worker-global-v52.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/webhooks/whatsapp'){
      if(m==='GET') return verifyWebhook(u,env);
      if(m==='POST') return receiveWebhook(req,env);
    }

    if(p==='/club-admin/whatsapp-status'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      const base=await app.fetch(req,env,ctx);
      if(!base.headers.get('content-type')?.includes('text/html')) return base;
      let html=await base.text();
      const stats=await deliveryStats(env.DB);
      const box=`<section class="panel"><h2>تأكيد وصول الرسائل</h2><div class="grid"><div><b>${stats.sent}</b><span>أُرسلت إلى Meta</span></div><div><b>${stats.delivered}</b><span>وصلت للهاتف</span></div><div><b>${stats.read}</b><span>تمت قراءتها</span></div><div><b>${stats.failed}</b><span>تعذر تسليمها</span></div></div><p style="opacity:.85">مهم: كلمة <b>sent</b> تعني أن Meta قبلت الرسالة فقط. التأكيد الحقيقي هو <b>delivered = وصلت للهاتف</b>، و<b>read = فتحها المستلم</b> عندما تكون إيصالات القراءة متاحة.</p>${stats.webhookReady?'<div class="alert" style="border:1px solid #76e5a0">✅ النظام جاهز لاستقبال إيصالات التسليم من واتساب.</div>':'<div class="alert bad">⚠️ يلزم ربط Webhook في Meta حتى تظهر delivered و read تلقائيًا.</div>'}</section>`;
      html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
      const h=new Headers(base.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v53-whatsapp-delivery-receipts');
      return new Response(html,{status:base.status,statusText:base.statusText,headers:h});
    }

    return app.fetch(req,env,ctx);
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

function verifyWebhook(u,env){
  const mode=u.searchParams.get('hub.mode');
  const token=u.searchParams.get('hub.verify_token');
  const challenge=u.searchParams.get('hub.challenge')||'';
  const expected=env.WHATSAPP_VERIFY_TOKEN||env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if(mode==='subscribe'&&expected&&token===expected)return new Response(challenge,{status:200,headers:{'content-type':'text/plain'}});
  return new Response('Forbidden',{status:403});
}

async function ensure(db){
  if(!db)return;
  const qs=[
    `ALTER TABLE club_notifications ADD COLUMN delivered_at TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN read_at TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN provider_status TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN status_updated_at TEXT`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}

async function receiveWebhook(req,env){
  if(!env.DB)return new Response('OK');
  try{
    await ensure(env.DB);
    const body=await req.json();
    const statuses=[];
    for(const entry of body?.entry||[])for(const ch of entry?.changes||[])for(const s of ch?.value?.statuses||[])statuses.push(s);
    for(const s of statuses){
      const id=String(s.id||''); if(!id)continue;
      const st=String(s.status||'');
      const ts=s.timestamp?new Date(Number(s.timestamp)*1000).toISOString():new Date().toISOString();
      const err=(s.errors||[]).map(x=>[x.title,x.message,x.code].filter(Boolean).join(' / ')).join(' | ')||null;
      if(st==='delivered'){
        await env.DB.prepare(`UPDATE club_notifications SET provider_status='delivered',status='delivered',delivered_at=COALESCE(delivered_at,?),status_updated_at=?,error=NULL WHERE provider_message_id=?`).bind(ts,ts,id).run();
      }else if(st==='read'){
        await env.DB.prepare(`UPDATE club_notifications SET provider_status='read',status='read',delivered_at=COALESCE(delivered_at,?),read_at=COALESCE(read_at,?),status_updated_at=?,error=NULL WHERE provider_message_id=?`).bind(ts,ts,ts,id).run();
      }else if(st==='failed'){
        await env.DB.prepare(`UPDATE club_notifications SET provider_status='failed',status='failed',status_updated_at=?,error=COALESCE(?,error) WHERE provider_message_id=?`).bind(ts,err,id).run();
      }else if(st==='sent'){
        await env.DB.prepare(`UPDATE club_notifications SET provider_status='sent',status_updated_at=? WHERE provider_message_id=?`).bind(ts,id).run();
      }
    }
  }catch(_){ }
  return new Response('OK',{status:200});
}

async function deliveryStats(db){
  const out={sent:0,delivered:0,read:0,failed:0,webhookReady:true};
  if(!db){out.webhookReady=false;return out}
  try{
    await ensure(db);
    const r=await db.prepare(`SELECT status,COUNT(*) c FROM club_notifications GROUP BY status`).all();
    for(const x of r.results||[]){const k=String(x.status||'');if(k in out)out[k]=Number(x.c||0)}
  }catch(_){out.webhookReady=false}
  return out;
}
