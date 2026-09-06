import app from './worker-global-v14.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const G='#d5a928',B='#0a347c',D='#061a43';
const APPLY_PATHS=new Set(['/apply','/application','/applications/new','/register','/membership/apply']);

export default {async fetch(req,env,ctx){
  const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method;
  if(env.DB) await init(env.DB);

  if(p.startsWith('/club-admin/notifications')){
    const a=env.DB?await admin(req,env.DB):null;
    if(!a) return red('/login');
    if(p==='/club-admin/notifications'&&m==='GET') return notifications(env.DB,env);
    if(p==='/club-admin/notifications/test'&&m==='POST') return testNotification(req,env,a);
    if(p==='/club-admin/notifications/retry'&&m==='POST') return retryNotification(req,env,a);
  }

  if(p==='/api/payment-callback'&&m==='POST') return paymentCallback(req,env);

  // Capture a public membership submission without changing the existing registration flow.
  if(m==='POST'&&APPLY_PATHS.has(p)){
    let meta=null,clone=null;
    try{clone=req.clone();meta=await extractApplicant(clone)}catch(_){}
    const response=await app.fetch(req,env,ctx);
    if(meta&&env.DB&&response.status>=200&&response.status<400){
      ctx.waitUntil(onApplication(env,meta).catch(()=>{}));
    }
    return response;
  }

  let r=await app.fetch(req,env,ctx);
  const ct=r.headers.get('content-type')||'';
  if(req.method==='GET'&&ct.includes('text/html')){
    let t=await r.text();
    if(p==='/club-admin'){
      let pending=0,failed=0,paid=0;
      try{pending=Number((await env.DB.prepare(`SELECT COUNT(*) n FROM club_notifications WHERE status IN ('queued','pending')`).first())?.n||0)}catch(_){}
      try{failed=Number((await env.DB.prepare(`SELECT COUNT(*) n FROM club_notifications WHERE status='failed'`).first())?.n||0)}catch(_){}
      try{paid=Number((await env.DB.prepare(`SELECT COUNT(*) n FROM club_payment_events WHERE status='paid'`).first())?.n||0)}catch(_){}
      const box=`<section class="v15box"><div class="v15head"><div><span>الأتمتة والاتصال</span><h2>مركز إشعارات العضوية والدفع</h2></div><a href="/club-admin/notifications" class="v15go">فتح المركز</a></div><div class="v15stats"><div><b>${pending}</b><span>رسائل في الانتظار</span></div><div><b>${failed}</b><span>رسائل تحتاج مراجعة</span></div><div><b>${paid}</b><span>دفعات مؤكدة آليًا</span></div></div><p>واتساب أولاً، وSMS احتياطي عند توفر بيانات المزود. كل إرسال وتأكيد دفع يُحفظ في سجل مستقل.</p></section>`;
      t=t.replace('</main>',box+'</main>');
    }
    const css=`<style>.v15box{margin:24px 0;padding:20px;border:1px solid ${G}99;border-radius:24px;background:linear-gradient(145deg,#071d49ee,#0b3d8bee)}.v15head{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.v15head span{color:#9ebcff;font-weight:900}.v15head h2{margin:4px 0;color:${G}}.v15go{background:${G};color:${D}!important;text-decoration:none;padding:11px 14px;border-radius:12px;font-weight:900}.v15stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.v15stats div{background:#ffffff0b;border:1px solid #d5a92855;border-radius:16px;padding:15px;text-align:center}.v15stats b{display:block;color:#ffd65b;font-size:1.55rem}.notify-ok{border-right:5px solid #51cf66!important}.notify-fail{border-right:5px solid #ff6b6b!important}.notify-wait{border-right:5px solid #ffd166!important}@media(max-width:700px){.v15stats{grid-template-columns:1fr}}</style>`;
    t=t.replace('</head>',css+'</head>');
    const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v15');
    return new Response(t,{status:r.status,statusText:r.statusText,headers:h});
  }
  return r;
}};

async function init(db){for(const q of [
`CREATE TABLE IF NOT EXISTS club_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,application_ref TEXT,member_name TEXT,phone TEXT,channel TEXT NOT NULL,event_type TEXT NOT NULL,message TEXT NOT NULL,status TEXT DEFAULT 'queued',provider_message_id TEXT,error TEXT,attempts INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,sent_at TEXT)`,
`CREATE TABLE IF NOT EXISTS club_payment_events(id INTEGER PRIMARY KEY AUTOINCREMENT,application_ref TEXT,member_name TEXT,phone TEXT,provider TEXT,transaction_ref TEXT,amount REAL DEFAULT 0,status TEXT DEFAULT 'pending',payload TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,confirmed_at TEXT)`,
`CREATE TABLE IF NOT EXISTS club_notification_settings(id INTEGER PRIMARY KEY CHECK(id=1),whatsapp_enabled INTEGER DEFAULT 1,sms_enabled INTEGER DEFAULT 1,sms_fallback INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)` ,
`INSERT OR IGNORE INTO club_notification_settings(id,whatsapp_enabled,sms_enabled,sms_fallback) VALUES(1,1,1,1)`
]){try{await db.prepare(q).run()}catch(_){}}}

async function onApplication(env,meta){
  const ref=meta.ref||('REQ-'+Date.now().toString(36).toUpperCase());
  const msg=`مرحباً ${meta.name||''}، تم استلام طلب عضويتك في ${CLUB}. رقم الطلب: ${ref}. سنرسل لك إشعاراً عند مراجعة الطلب وتأكيد السداد. شكراً لك.`;
  await queueAndSend(env,{application_ref:ref,member_name:meta.name,phone:meta.phone,event_type:'application_received',message:msg});
}

async function paymentCallback(req,env){
  if(!env.DB) return J({ok:false,error:'database_unavailable'},503);
  let body={};try{body=await req.json()}catch(_){try{body=Object.fromEntries(await req.formData())}catch(__){}}
  const secret=env.PAYMENT_WEBHOOK_SECRET||'';
  if(secret){const got=req.headers.get('x-webhook-secret')||'';if(got!==secret)return J({ok:false,error:'unauthorized'},401)}
  const status=String(body.status||body.payment_status||'').toLowerCase();
  const paid=['paid','success','successful','completed','تم','ناجح'].includes(status);
  const ref=String(body.application_ref||body.order_id||body.reference||'');
  const phone=normPhone(body.phone||body.mobile||'');
  const name=String(body.member_name||body.name||'').trim();
  const tx=String(body.transaction_ref||body.transaction_id||body.txn||'');
  const provider=String(body.provider||body.method||'bank').trim();
  const amount=Number(body.amount||0);
  await env.DB.prepare(`INSERT INTO club_payment_events(application_ref,member_name,phone,provider,transaction_ref,amount,status,payload,confirmed_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(ref,name,phone,provider,tx,amount,paid?'paid':status||'pending',JSON.stringify(body),paid?new Date().toISOString():null).run();
  if(paid&&phone){
    const msg=`تم تأكيد سداد رسوم عضويتك في ${CLUB}${amount?` بمبلغ ${money(amount)} جنيه`:''}. رقم الطلب: ${ref||'—'}${tx?`، رقم العملية: ${tx}`:''}. الطلب الآن جاهز لاستكمال الاعتماد.`;
    await queueAndSend(env,{application_ref:ref,member_name:name,phone,event_type:'payment_confirmed',message:msg});
  }
  return J({ok:true,paid});
}

async function queueAndSend(env,n){
  const phone=normPhone(n.phone);if(!phone)return null;
  const id=await insertNotification(env.DB,{...n,phone,channel:'whatsapp'});
  let wa=await sendWhatsApp(env,phone,n.message);
  await finishNotification(env.DB,id,wa);
  if(!wa.ok&&String(env.SMS_FALLBACK_ENABLED||'1')!=='0'){
    const sid=await insertNotification(env.DB,{...n,phone,channel:'sms'});
    const sms=await sendSms(env,phone,n.message);
    await finishNotification(env.DB,sid,sms);
    return sms;
  }
  return wa;
}

async function insertNotification(db,n){let r=await db.prepare(`INSERT INTO club_notifications(application_ref,member_name,phone,channel,event_type,message,status,attempts) VALUES(?,?,?,?,?,?,'queued',1) RETURNING id`).bind(n.application_ref||'',n.member_name||'',n.phone,n.channel,n.event_type,n.message).first();return r?.id}
async function finishNotification(db,id,r){if(!id)return;await db.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=? WHERE id=?`).bind(r.ok?'sent':'failed',r.id||'',r.error||'',r.ok?new Date().toISOString():null,id).run()}

async function sendWhatsApp(env,phone,message){
  const token=env.WHATSAPP_TOKEN||'',numberId=env.WHATSAPP_PHONE_NUMBER_ID||'';
  if(!token||!numberId)return {ok:false,error:'WhatsApp غير مربوط بعد'};
  try{let res=await fetch(`https://graph.facebook.com/v22.0/${numberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'text',text:{body:message,preview_url:false}})});let j=await res.json();if(!res.ok)return {ok:false,error:JSON.stringify(j).slice(0,500)};return {ok:true,id:j?.messages?.[0]?.id||''}}catch(e){return {ok:false,error:String(e)}}
}

async function sendSms(env,phone,message){
  const sid=env.TWILIO_ACCOUNT_SID||'',token=env.TWILIO_AUTH_TOKEN||'',from=env.TWILIO_FROM||'';
  if(!sid||!token||!from)return {ok:false,error:'SMS غير مربوط بعد'};
  try{const body=new URLSearchParams({To:'+'+phone,From:from,Body:message});let res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+btoa(`${sid}:${token}`),'Content-Type':'application/x-www-form-urlencoded'},body});let j=await res.json();if(!res.ok)return {ok:false,error:JSON.stringify(j).slice(0,500)};return {ok:true,id:j.sid||''}}catch(e){return {ok:false,error:String(e)}}
}

async function notifications(db,env){
  let rows=await safeAll(db,'SELECT * FROM club_notifications ORDER BY id DESC LIMIT 300');
  const wa=!!(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID),sms=!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM);
  const body=`<div class="summary"><b>واتساب: ${wa?'✅ مربوط':'⚠️ يحتاج مفاتيح الربط'} · SMS: ${sms?'✅ مربوط':'⚠️ يحتاج مفاتيح الربط'}</b></div><form class="form" method="post" action="/club-admin/notifications/test"><label>الاسم<input name="name" required></label><label>رقم الهاتف<input name="phone" placeholder="249..." required></label><label>رسالة اختبار<input name="message" value="رسالة اختبار من نادي ود نفيع" required></label><button>إرسال اختبار</button></form><div class="list">${rows.length?rows.map(x=>`<article class="${x.status==='sent'?'notify-ok':x.status==='failed'?'notify-fail':'notify-wait'}"><b>${e(x.member_name||'عضو')} · ${e(x.channel)} · ${e(x.event_type)}</b><span>${e(x.phone)} · ${e(x.status)}</span><small>${e(x.message)}${x.error?`<br>سبب: ${e(x.error)}`:''}</small>${x.status==='failed'?`<form method="post" action="/club-admin/notifications/retry"><input type="hidden" name="id" value="${x.id}"><button class="mini-btn">إعادة المحاولة</button></form>`:''}</article>`).join(''):'<article>لا توجد رسائل مسجلة بعد.</article>'}</div>`;
  return H(page('إشعارات العضوية والدفع',body));
}

async function testNotification(req,env,a){let f=await req.formData(),phone=normPhone(v(f,'phone')),name=v(f,'name'),message=v(f,'message');await queueAndSend(env,{application_ref:'TEST',member_name:name,phone,event_type:'test',message});await log(env.DB,a,'test_notification','notification');return red('/club-admin/notifications')}
async function retryNotification(req,env,a){let f=await req.formData(),id=Number(v(f,'id')||0);let n=id?await env.DB.prepare('SELECT * FROM club_notifications WHERE id=?').bind(id).first():null;if(n){let r=n.channel==='sms'?await sendSms(env,n.phone,n.message):await sendWhatsApp(env,n.phone,n.message);await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,attempts=attempts+1,sent_at=? WHERE id=?`).bind(r.ok?'sent':'failed',r.id||'',r.error||'',r.ok?new Date().toISOString():null,id).run();await log(env.DB,a,'retry_notification','notification')}return red('/club-admin/notifications')}

async function extractApplicant(req){let f=await req.formData();let o=Object.fromEntries([...f.entries()].filter(([,v])=>typeof v==='string'));let name=pick(o,['full_name','name','member_name','fullname','applicant_name','الاسم']);let phone=pick(o,['phone','mobile','whatsapp','telephone','tel','رقم_الهاتف','الهاتف']);let ref=pick(o,['application_ref','request_no','application_no','ref','reference']);return {name:String(name||'').trim(),phone:normPhone(phone),ref:String(ref||'').trim()}}
function pick(o,keys){for(const k of keys)if(o[k])return o[k];return ''}
function normPhone(x){let s=String(x||'').replace(/\D/g,'');if(s.startsWith('00'))s=s.slice(2);if(s.startsWith('0')&&s.length===10)s='249'+s.slice(1);if(s.length===9)s='249'+s;return s}

async function admin(req,db){let c=req.headers.get('Cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;return db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(decodeURIComponent(x[1])).first()}
async function log(db,a,action,target){try{await db.prepare(`INSERT INTO audit_log(admin_id,username,role,action,target_type,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(a.id,a.username,a.role,action,target).run()}catch(_){}}
async function safeAll(db,q){try{return (await db.prepare(q).all()).results||[]}catch(_){return []}}
function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${D}"><title>${e(t)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><nav><a href="/club-admin">المركز</a><a href="/applications">العضوية</a><a href="/members">الأعضاء</a><a href="/reports">التقارير</a></nav></header><main><h1>${e(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,${D},${B});color:white;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{background:#061a43f2;border-bottom:1px solid #d5a92866;padding:14px 4%;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}header b,h1,h2{color:${G}}nav{display:flex;gap:10px;flex-wrap:wrap}a{color:white}main{width:min(1000px,92%);margin:28px auto}.summary{background:#08265dcc;border:1px solid #d5a92866;padding:14px 16px;border-radius:16px;margin-bottom:14px;color:#ffe08a}.form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;background:#08265dcc;border:1px solid #d5a92866;padding:18px;border-radius:20px}.form label{display:flex;flex-direction:column;gap:7px;color:#f8dfa0;font-weight:800}.form input{padding:12px;border-radius:12px;border:1px solid #d5a92888;background:#fff;color:#111}.form button,.mini-btn{grid-column:1/-1;padding:11px;border:0;border-radius:10px;background:${G};color:${D};font-weight:900}.list{display:grid;gap:12px;margin-top:18px}.list article{background:#0b3478;border:1px solid #d5a92866;border-radius:16px;padding:15px;display:grid;gap:6px}.list b{color:#ffd65b}.list small{opacity:.9;line-height:1.7}footer{text-align:center;padding:28px;color:#e8d49b}@media(max-width:700px){.form{grid-template-columns:1fr}}`}
function v(f,k){return String(f.get(k)||'').trim()}function e(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function H(x){return new Response(x,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'}})}function red(x){return new Response(null,{status:303,headers:{Location:x}})}function J(x,s=200){return new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}function money(n){return new Intl.NumberFormat('ar-SD',{maximumFractionDigits:2}).format(Number(n||0))}
