import app from './worker-global-v24.js';

const META_VERSION='v22.0';
const TEMPLATE_LANGUAGE='ar';
const TEMPLATES=[
  {
    name:'wdn_application_received',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، تم استلام طلب عضويتك رقم {{2}} في نادي ود نفيع الرياضي الثقافي الاجتماعي بنجاح.',
    example:[['خالد بابكر','WDN-REQ-00003']]
  },
  {
    name:'wdn_review_started',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، بدأت إدارة نادي ود نفيع الرياضي الثقافي الاجتماعي مراجعة طلب العضوية رقم {{2}}.',
    example:[['خالد بابكر','WDN-REQ-00003']]
  },
  {
    name:'wdn_needs_info',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، طلب العضوية رقم {{2}} يحتاج إلى استكمال بيانات. المطلوب: {{3}}',
    example:[['خالد بابكر','WDN-REQ-00003','إرفاق صورة شخصية واضحة']]
  },
  {
    name:'wdn_ready_for_approval',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، تمت مراجعة طلب العضوية رقم {{2}} وأصبح جاهزاً للاعتماد النهائي.',
    example:[['خالد بابكر','WDN-REQ-00003']]
  },
  {
    name:'wdn_membership_approved',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، تم اعتماد عضويتك في نادي ود نفيع الرياضي الثقافي الاجتماعي. رقم العضوية: {{2}}. نرحب بك في النادي.',
    example:[['خالد بابكر','WDN-00025']]
  },
  {
    name:'wdn_application_rejected',
    category:'UTILITY',
    language:TEMPLATE_LANGUAGE,
    body:'مرحباً {{1}}، تم تحديث طلب العضوية رقم {{2}} إلى غير معتمد. ملاحظة الإدارة: {{3}}',
    example:[['خالد بابكر','WDN-REQ-00003','يرجى مراجعة إدارة النادي']]
  }
];

export default {
  async fetch(req, env, ctx) {
    const url=new URL(req.url);
    const path=url.pathname.replace(/\/$/,'')||'/';

    if(path==='/club-admin/whatsapp-templates'){
      if(!hasAdminCookie(req)) return new Response(null,{status:303,headers:{Location:'/login'}});
      if(req.method==='POST') return createTemplates(req,env);
      return templatesPage(env,url.searchParams.get('ok'),url.searchParams.get('error'));
    }

    const response=await app.fetch(req,env,ctx);
    if(path==='/club-admin/notifications' && req.method==='GET' && response.headers.get('content-type')?.includes('text/html')){
      let body=await response.text();
      body=body.replace('مركز الإشعارات · V24','مركز الإشعارات · V25');
      body=body.replace('</main>',`<div style="width:min(820px,92%);margin:0 auto 34px"><a href="/club-admin/whatsapp-templates" style="display:block;text-align:center;background:#fff;color:#061a43;text-decoration:none;padding:13px 16px;border-radius:14px;font-weight:900">إدارة قوالب واتساب الرسمية</a></div></main>`);
      const headers=new Headers(response.headers);
      headers.delete('content-length');
      headers.set('x-wadnofei-ui','v25-whatsapp-templates');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  }
};

function hasAdminCookie(req){
  return /(?:^|;\s*)sid=/.test(req.headers.get('cookie')||'');
}

async function listTemplates(env){
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_BUSINESS_ACCOUNT_ID) return {ok:false,error:'بيانات حساب واتساب غير مكتملة'};
  try{
    const fields='id,name,status,category,language';
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=${encodeURIComponent(fields)}&limit=200`,{headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const e=data?.error||{};
      return {ok:false,error:[e.message,e.error_user_title,e.error_user_msg].filter(Boolean).join(' — ')||`Meta HTTP ${r.status}`};
    }
    return {ok:true,data:data.data||[]};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}

async function createTemplates(req,env){
  if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_BUSINESS_ACCOUNT_ID) return redirectError('بيانات حساب واتساب غير مكتملة');
  const current=await listTemplates(env);
  if(!current.ok) return redirectError(current.error);
  const existing=new Set((current.data||[]).map(x=>`${x.name}:${x.language}`));
  const results=[];

  for(const t of TEMPLATES){
    if(existing.has(`${t.name}:${t.language}`)){
      results.push(`${t.name}: موجود`);
      continue;
    }
    try{
      const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,{
        method:'POST',
        headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
        body:JSON.stringify({
          name:t.name,
          language:t.language,
          category:t.category,
          components:[{
            type:'BODY',
            text:t.body,
            example:{body_text:t.example}
          }]
        })
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        const e=data?.error||{};
        results.push(`${t.name}: فشل — ${[e.message,e.error_user_title,e.error_user_msg].filter(Boolean).join(' — ')||`HTTP ${r.status}`}`);
      }else{
        results.push(`${t.name}: تم الإرسال للمراجعة`);
      }
    }catch(e){results.push(`${t.name}: فشل — ${String(e?.message||e)}`)}
  }

  return new Response(null,{status:303,headers:{Location:'/club-admin/whatsapp-templates?ok='+encodeURIComponent(results.join('\n'))}});
}

async function templatesPage(env,ok,error){
  const listed=await listTemplates(env);
  const map=new Map((listed.data||[]).map(x=>[`${x.name}:${x.language}`,x]));
  const cards=TEMPLATES.map(t=>{
    const x=map.get(`${t.name}:${t.language}`);
    const status=x?.status||'غير موجود';
    const cls=status==='APPROVED'?'approved':status==='REJECTED'?'rejected':status==='PENDING'?'pending':'';
    return `<article><div><b>${esc(t.name)}</b><span class="status ${cls}">${esc(status)}</span></div><p>${esc(t.body)}</p><small>الفئة: ${esc(t.category)} · اللغة: ${esc(t.language)}</small></article>`;
  }).join('');

  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>قوالب واتساب</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(920px,92%);margin:32px auto}.box{background:#08265dcc;border:1px solid #d5a92888;border-radius:24px;padding:20px}h1{color:#d5a928;margin-top:0}.note,.ok,.err{padding:13px;border-radius:12px;white-space:pre-wrap;line-height:1.8}.note{background:#ffffff12}.ok{background:#0e6a38}.err{background:#7a2430}.list{display:grid;gap:12px;margin:16px 0}article{background:#061a4388;border:1px solid #d5a92844;border-radius:16px;padding:14px}article>div{display:flex;justify-content:space-between;gap:10px}article b{color:#ffd65b}.status{padding:5px 9px;border-radius:999px;background:#ffffff18}.approved{color:#7CFF9B}.pending{color:#ffd65b}.rejected{color:#ff9b9b}p{line-height:1.8}button,a{display:block;width:100%;border:0;border-radius:12px;padding:13px 16px;font-weight:900;text-align:center;text-decoration:none;margin-top:10px}.send{background:#25D366;color:#06233f}.back{background:#d5a928;color:#061a43}</style></head><body><main><div class="box"><h1>قوالب واتساب الرسمية</h1><div class="note">النظام مجهز لاستخدام هذه القوالب تلقائياً لإشعارات العضوية. يجب أن تصبح حالة القالب APPROVED قبل الإرسال خارج نافذة 24 ساعة.</div>${ok?`<div class="ok">${esc(ok)}</div>`:''}${error?`<div class="err">${esc(error)}</div>`:''}${!listed.ok?`<div class="err">${esc(listed.error)}</div>`:''}<div class="list">${cards}</div><form method="post"><button class="send">إنشاء القوالب الناقصة وإرسالها إلى Meta للمراجعة</button></form><a class="back" href="/club-admin/notifications">العودة لمركز الإشعارات</a></div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

function redirectError(msg){return new Response(null,{status:303,headers:{Location:'/club-admin/whatsapp-templates?error='+encodeURIComponent(msg)}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
