import app from './worker-global-v53.js';

const META_VERSION='v22.0';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url), p=u.pathname.replace(/\/$/,'')||'/', m=req.method.toUpperCase();

    if(p==='/club-admin/whatsapp-live-test'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      if(m==='GET') return page(env);
      if(m==='POST') return sendTest(env);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET' && ct.includes('text/html') && p==='/club-admin/whatsapp-status'){
      let html=await r.text();
      const btn=`<div style="width:min(820px,92%);margin:16px auto"><a href="/club-admin/whatsapp-live-test" style="display:block;background:#25D366;color:#06233f;text-align:center;text-decoration:none;font-weight:900;padding:14px;border-radius:14px">اختبار وصول واتساب الحقيقي الآن</a></div>`;
      html=html.includes('</main>')?html.replace('</main>',btn+'</main>'):html+btn;
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v54-whatsapp-live-test');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
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

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function shell(body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>اختبار واتساب الحقيقي</title><style>*{box-sizing:border-box}body{margin:0;background:#061a43;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(760px,92%);margin:28px auto}.box{background:#0a347c;border:1px solid #d5a92888;border-radius:22px;padding:18px}h1,h2{color:#d5a928}button,a{display:block;width:100%;border:0;border-radius:14px;padding:14px;text-align:center;text-decoration:none;font-weight:900;margin-top:12px}.go{background:#25D366;color:#06233f}.back{background:#d5a928;color:#061a43}.ok{border:1px solid #65e891;background:#0d5b3a55;padding:12px;border-radius:14px}.bad{border:1px solid #ff7a7a;background:#7a111155;padding:12px;border-radius:14px}code{direction:ltr;display:block;overflow-wrap:anywhere;background:#0003;padding:10px;border-radius:10px;margin-top:8px}</style></head><body><main>${body}</main></body></html>`}

async function page(env){
  const to=String(env.WHATSAPP_TEST_RECIPIENT||'').replace(/\D/g,'');
  const body=`<section class="box"><h1>اختبار وصول واتساب الحقيقي</h1><p>هذا الاختبار يرسل قالب Meta المعتمد مباشرة، ويعرض رد Meta الحقيقي بدل رسالة نجاح عامة.</p><p>الرقم التجريبي: <b dir="ltr">+${esc(to||'غير مضبوط')}</b></p><form method="post"><button class="go">إرسال الاختبار الحقيقي الآن</button></form><a class="back" href="/club-admin/whatsapp-status">العودة لحالة واتساب</a></section>`;
  return new Response(shell(body),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

async function sendTest(env){
  const to=String(env.WHATSAPP_TEST_RECIPIENT||'').replace(/\D/g,'');
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!to){
    return new Response(shell(`<section class="box"><h1>الاختبار لم يبدأ</h1><div class="bad">إعداد WhatsApp ناقص: Token أو Phone Number ID أو رقم الاختبار.</div><a class="back" href="/club-admin/whatsapp-live-test">رجوع</a></section>`),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})
  }
  let status=0,data={};
  try{
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:'wdn_membership_update',language:{code:'ar'},components:[{type:'body',parameters:[{type:'text',text:'WDN-TEST'},{type:'text',text:'اختبار وصول واتساب'}]}]}})
    });
    status=r.status;data=await r.json().catch(()=>({}));
  }catch(e){data={error:{message:String(e?.message||e)}}}
  const id=data?.messages?.[0]?.id||'';
  const ok=!!id;
  const err=data?.error||{};
  if(ok && env.DB){
    try{
      await env.DB.prepare(`INSERT INTO club_notifications (application_no,member_name,target_phone,actual_recipient,event_type,message,status,provider_message_id,sent_at,created_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      .bind('WDN-TEST','اختبار واتساب','+'+to,'+'+to,'whatsapp_test','اختبار وصول واتساب الحقيقي','sent',id).run();
    }catch(_){ }
  }
  const body=`<section class="box"><h1>نتيجة الاختبار الحقيقي</h1>${ok?`<div class="ok">✅ Meta قبلت الرسالة وأعادت Message ID حقيقي.</div><h2>Message ID</h2><code>${esc(id)}</code><p>الآن افتح واتساب على الرقم +${esc(to)} ثم ارجع إلى صفحة حالة واتساب وحدّثها. الـWebhook سيحوّلها إلى delivered/read إذا وصلت.</p>`:`<div class="bad">❌ Meta لم تقبل الإرسال.</div><p>HTTP: <b>${esc(status||'—')}</b></p><code>${esc([err.message,err.error_user_title,err.error_user_msg,err.code&&('code '+err.code)].filter(Boolean).join(' — ')||JSON.stringify(data))}</code>`}<a class="back" href="/club-admin/whatsapp-status">فتح حالة واتساب</a><a class="back" href="/club-admin/whatsapp-live-test">إعادة الاختبار</a></section>`;
  return new Response(shell(body),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
