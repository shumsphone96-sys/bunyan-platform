import app from './worker-global-v23.js';

const META_VERSION='v22.0';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/,'') || '/';

    if (path === '/club-admin/whatsapp-register') {
      if (!hasAdminCookie(req)) return new Response(null,{status:303,headers:{Location:'/login'}});
      if (req.method === 'POST') return registerPhone(req, env);
      return registerPage(env, url.searchParams.get('ok'), url.searchParams.get('error'));
    }

    if (path === '/club-admin/whatsapp-register/status') {
      if (!hasAdminCookie(req)) return new Response(null,{status:303,headers:{Location:'/login'}});
      return phoneStatus(env);
    }

    const response = await app.fetch(req, env, ctx);

    if (path === '/club-admin/notifications' && req.method === 'GET' && response.headers.get('content-type')?.includes('text/html')) {
      let body = await response.text();
      body = body.replace('مركز الإشعارات · V23','مركز الإشعارات · V24');
      body = body.replace('</main>', `<div style="width:min(820px,92%);margin:0 auto 34px"><a href="/club-admin/whatsapp-register" style="display:block;text-align:center;background:#25D366;color:#061a43;text-decoration:none;padding:13px 16px;border-radius:14px;font-weight:900">تسجيل رقم واتساب الإنتاجي</a></div></main>`);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.set('x-wadnofei-ui','v24-whatsapp-registration');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }

    return response;
  }
};

function hasAdminCookie(req){
  const c=req.headers.get('cookie')||'';
  return /(?:^|;\s*)sid=/.test(c);
}

async function registerPhone(req, env){
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return redirectError('بيانات واتساب غير مكتملة');
  let pin='';
  try{
    const form=await req.formData();
    pin=String(form.get('pin')||'').replace(/\D/g,'');
  }catch(_){ }
  if (!/^\d{6}$/.test(pin)) return redirectError('أدخل PIN التحقق بخطوتين المكوّن من 6 أرقام');
  try{
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/register`,{
      method:'POST',
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',pin})
    });
    const data=await r.json().catch(()=>({}));
    if (!r.ok) {
      const e=data?.error||{};
      const parts=[e.message,e.error_user_title,e.error_user_msg,e.code?`code ${e.code}`:'',e.error_subcode?`subcode ${e.error_subcode}`:''].filter(Boolean);
      return redirectError(parts.join(' — ') || `Meta HTTP ${r.status}`);
    }
    return new Response(null,{status:303,headers:{Location:'/club-admin/whatsapp-register?ok=1'}});
  }catch(e){
    return redirectError(String(e?.message||e));
  }
}

async function phoneStatus(env){
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return json({ok:false,error:'WhatsApp credentials incomplete'},500);
  try{
    const fields='id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,platform_type';
    const r=await fetch(`https://graph.facebook.com/${META_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=${encodeURIComponent(fields)}`,{
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`}
    });
    const data=await r.json().catch(()=>({}));
    return json({ok:r.ok,status:r.status,data},r.ok?200:r.status);
  }catch(e){return json({ok:false,error:String(e?.message||e)},500)}
}

function redirectError(msg){
  return new Response(null,{status:303,headers:{Location:'/club-admin/whatsapp-register?error='+encodeURIComponent(msg)}});
}

function registerPage(env,ok,error){
  const ready=!!(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID);
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>تسجيل واتساب الإنتاجي</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(720px,92%);margin:40px auto}.box{background:#08265dcc;border:1px solid #d5a92888;border-radius:24px;padding:22px}h1{color:#d5a928}.note{line-height:1.9;opacity:.92}.warn{background:#4b3b12;border:1px solid #d5a92888;padding:14px;border-radius:14px;line-height:1.8}.ok{background:#0e6a38;padding:14px;border-radius:14px}.err{background:#7a2430;padding:14px;border-radius:14px;line-height:1.7}.grid{display:grid;gap:12px;margin:18px 0}.tile{background:#061a4388;border:1px solid #d5a92844;border-radius:14px;padding:14px}.tile b{display:block;color:#ffd65b;margin-bottom:5px}input{width:100%;padding:14px;font-size:1.2rem;border-radius:12px;border:1px solid #ffffff44;text-align:center;letter-spacing:.25em}button,a{display:block;width:100%;border:0;border-radius:12px;padding:13px 16px;font-weight:900;text-align:center;text-decoration:none}.send{background:#25D366;color:#06233f;margin-top:12px}.diag{background:#123d76;color:#fff;margin-top:12px}.back{background:#d5a928;color:#061a43;margin-top:12px}</style></head><body><main><div class="box"><h1>تسجيل رقم واتساب الإنتاجي</h1>${ok?'<div class="ok">✅ تم تسجيل الرقم في WhatsApp Cloud API بنجاح. يمكنك الآن إعادة اختبار إشعار العضوية.</div>':''}${error?`<div class="err">⚠️ ${esc(error)}</div>`:''}<div class="grid"><div class="tile"><b>Phone Number ID</b>${ready?'موجود':'غير موجود'}</div><div class="tile"><b>رمز الوصول</b>${env.WHATSAPP_TOKEN?'موجود ومحمي':'غير موجود'}</div></div><div class="warn"><b>مهم:</b> بما أن هذا الرقم كان مستخدماً مسبقاً في WhatsApp Business، لا تختَر PIN جديداً عشوائياً. أدخل <b>PIN التحقق بخطوتين الحالي</b> الخاص بنفس رقم واتساب. إذا لم تكن تعرفه، غيّره/أعد تعيينه من إعدادات واتساب أولاً ثم استخدمه هنا.</div><form method="post"><input name="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" required><button class="send">تسجيل الرقم الآن</button></form><a class="diag" href="/club-admin/whatsapp-register/status">فحص حالة الرقم من Meta</a><a class="back" href="/club-admin/notifications">العودة لمركز الإشعارات</a></div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
