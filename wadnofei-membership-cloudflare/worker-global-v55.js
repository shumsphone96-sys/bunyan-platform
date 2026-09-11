import app from './worker-global-v54.js';

const META_VERSION='v22.0';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    // Override the old V21 quick-test button so it uses an approved template,
    // stores Meta's real message id, and can be updated by the V53 webhook.
    if(p==='/club-admin/notifications/quick-test'&&m==='POST'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return trackedQuickTest(env);
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

async function ensureDeliveryColumns(db){
  if(!db)return;
  const qs=[
    `ALTER TABLE club_notifications ADD COLUMN delivered_at TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN read_at TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN provider_status TEXT`,
    `ALTER TABLE club_notifications ADD COLUMN status_updated_at TEXT`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}

async function trackedQuickTest(env){
  const to=String(env.WHATSAPP_TEST_RECIPIENT||'249912930540').replace(/\D/g,'');
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!to){
    return new Response(null,{status:303,headers:{Location:'/club-admin/notifications?test_error=missing'}});
  }

  let result={ok:false,id:null,error:'Unknown error'};
  try{
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:'POST',
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({
        messaging_product:'whatsapp',
        to,
        type:'template',
        template:{
          name:'wdn_membership_update',
          language:{code:'ar'},
          components:[{type:'body',parameters:[
            {type:'text',text:'WDN-TEST'},
            {type:'text',text:'اختبار وصول واتساب من نظام نادي ود نفيع'}
          ]}]
        }
      })
    });
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d?.messages?.[0]?.id) result={ok:true,id:d.messages[0].id,error:null};
    else {
      const e=d?.error||{};
      result={ok:false,id:null,error:[e.message,e.error_user_title,e.error_user_msg,e.code?`code ${e.code}`:''].filter(Boolean).join(' — ')||`HTTP ${r.status}`};
    }
  }catch(e){result={ok:false,id:null,error:String(e?.message||e)}}

  if(env.DB){
    try{
      await ensureDeliveryColumns(env.DB);
      await env.DB.prepare(`INSERT INTO club_notifications
        (application_no,member_name,target_phone,actual_recipient,event_type,message,status,provider_message_id,error,sent_at,created_at,provider_status,status_updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`)
        .bind(
          'WDN-TEST','اختبار واتساب',to,to,'whatsapp_test',
          'اختبار وصول واتساب من نظام نادي ود نفيع',
          result.ok?'sent':'failed',result.id,result.error,
          result.ok?'sent':'failed',result.ok?'sent':'failed'
        ).run();
    }catch(_){ }
  }

  const q=result.ok?'tracked=1':'tracked_error=1';
  return new Response(null,{status:303,headers:{Location:`/club-admin/notifications/history?${q}`}});
}
