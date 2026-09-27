import app from './worker-global-v78.js';
import {header,footer,sharedCss,siteCss,esc} from './site-ui.js';
import {normalizeRole} from './role-policy.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const META_VERSION='v22.0';
const RESET_COOKIE='wdn_staff_reset';
const ROLE_LABELS={president:'المدير/المشرف العام',secretary:'السكرتير',finance_manager:'أمين المال',owner:'المدير/المشرف العام'};

export default {
 async fetch(req,env,ctx){
  const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

  if(p==='/staff-login'){
   if(m==='GET'){
    try{await app.fetch(new Request(req.url,{method:'GET',headers:req.headers}),env,ctx)}catch(_){}
    return loginPage(env.DB,safeNext(u.searchParams.get('next')||'/club-admin'),u.searchParams.get('reset')?'تم تعيين كلمة المرور. يمكنك الدخول الآن.':'','');
   }
   if(m==='POST'&&env.DB)return doLogin(req,env.DB);
  }

  if(p==='/staff-recover'&&m==='GET'){
   try{await app.fetch(new Request(req.url,{method:'GET',headers:req.headers}),env,ctx)}catch(_){}
   return recoverStart(env,'');
  }
  if(p==='/staff-recover/request'&&m==='POST'&&env.DB)return requestOtp(req,env);
  if(p==='/staff-recover/verify'&&m==='POST'&&env.DB)return verifyOtp(req,env.DB);
  if(p==='/staff-recover/password'&&m==='GET'&&env.DB)return passwordPage(req,env.DB,'');
  if(p==='/staff-recover/password'&&m==='POST'&&env.DB)return saveRecoveredPassword(req,env.DB);

  if((p==='/club-admin/access/passwords'||p==='/club-admin/security-center/recovery-contacts')&&env.DB){
   const actor=await sessionUser(req,env.DB);
   if(!actor)return red('/staff-login?next='+encodeURIComponent(p));
   if(normalizeRole(actor.role)!=='owner')return denied('تهيئة حسابات المسؤولين متاحة للمدير فقط.');
   if(m==='GET')return accountSetupPage(env.DB,u.searchParams.get('ok')||'',u.searchParams.get('error')||'');
   if(m==='POST')return saveAccountSetup(req,env.DB,actor,p);
  }

  const r=await app.fetch(req,env,ctx);
  return r;
 },
 async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

async function doLogin(req,db){
 const f=await req.formData();
 const identifier=String(f.get('identifier')||f.get('username')||'').trim();
 const password=String(f.get('password')||'');
 const next=safeNext(String(f.get('next')||'/club-admin'));
 const user=await findUserByIdentifier(db,identifier);
 if(!user||!isPasswordReady(user)||!(await verifyPassword(password,user.password_salt,user.password_hash))){
  return loginPage(db,next,'','بيانات الدخول غير صحيحة، أو الحساب لم يُفعّل بعد. استخدم «تفعيل أو استعادة الحساب».');
 }
 const token=randomHex(32),expires=new Date(Date.now()+12*60*60*1000).toISOString();
 try{await db.prepare("DELETE FROM club_staff_sessions WHERE expires_at<=datetime('now')").run()}catch(_){}
 await db.prepare("INSERT INTO club_staff_sessions(token,user_id,expires_at) VALUES(?,?,?)").bind(token,user.id,expires).run();
 await audit(db,user.username,'login','staff_user',user.id,'v79 identifier login');
 return new Response(null,{status:303,headers:{
  Location:next,
  'cache-control':'no-store',
  'Set-Cookie':'club_sid='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200'
 }});
}

async function findUserByIdentifier(db,raw){
 const identifier=String(raw||'').trim();
 if(!identifier)return null;
 if(identifier.includes('@')||digits(identifier).length>=8){
  const normalized=normalizeContact(identifier),hash=await sha256(normalized);
  try{
   const x=await db.prepare("SELECT u.* FROM club_staff_recovery_methods r JOIN club_staff_users u ON u.id=r.user_id WHERE r.contact_hash=? AND r.is_active=1 AND u.is_active=1 LIMIT 1").bind(hash).first();
   if(x)return x;
  }catch(_){}
  try{
   const x=await db.prepare("SELECT * FROM club_staff_users WHERE recovery_contact_hash=? AND is_active=1 LIMIT 1").bind(hash).first();
   if(x)return x;
  }catch(_){}
 }
 try{return await db.prepare("SELECT * FROM club_staff_users WHERE lower(username)=lower(?) AND is_active=1 LIMIT 1").bind(identifier).first()}catch(_){return null}
}

function isPasswordReady(user){
 return !!user && String(user.password_hash||'')!=='00' && String(user.password_salt||'')!=='00' && String(user.password_hash||'').length>20;
}

async function requestOtp(req,env){
 if(!sameOrigin(req))return recoverStart(env,'تعذر قبول الطلب. أعد فتح الصفحة وحاول مرة أخرى.');
 await ensureRecoverySchema(env.DB);
 const f=await req.formData();
 const identifier=String(f.get('identifier')||'').trim();
 const contact=normalizeContact(String(f.get('contact')||''));
 const channel=String(f.get('channel')||'');
 const caps=capabilities(env);
 if(!['whatsapp','email','sms'].includes(channel)||!caps[channel])return recoverStart(env,'قناة الإرسال المختارة غير مهيأة حالياً.');
 if(!validContactForChannel(contact,channel))return recoverStart(env,'أدخل وسيلة استعادة صحيحة تناسب القناة المختارة.');

 const contactHash=await sha256(contact);
 const recent=await scalar(env.DB,"SELECT COUNT(*) c FROM club_staff_otp WHERE contact_hash=? AND requested_at>datetime('now','-15 minutes')",[contactHash]);
 if(recent>=3)return recoverStart(env,'تم طلب رموز كثيرة خلال وقت قصير. انتظر 15 دقيقة ثم حاول مرة أخرى.');

 const user=await findRecoveryUser(env.DB,identifier,contactHash);
 const code=otpCode();
 const salt=randomHex(16),codeHash=await otpHash(code,salt);
 const expires=new Date(Date.now()+10*60*1000).toISOString();
 const inserted=await env.DB.prepare("INSERT INTO club_staff_otp(user_id,channel,contact_hash,code_hash,code_salt,expires_at) VALUES(?,?,?,?,?,?)")
  .bind(user?user.id:null,channel,contactHash,codeHash,salt,expires).run();
 const id=Number(inserted.meta?.last_row_id||0);

 let delivery={ok:false,id:''};
 if(user){
  delivery=await deliverOtp(env,channel,contact,code);
  if(delivery.ok){
   try{await env.DB.prepare("UPDATE club_staff_otp SET provider_message_id=? WHERE id=?").bind(String(delivery.id||''),id).run()}catch(_){}
   await audit(env.DB,'public','otp_sent','staff_user',user.id,channel);
  }else{
   try{await env.DB.prepare("UPDATE club_staff_otp SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()}catch(_){}
   await audit(env.DB,'public','otp_send_failed','staff_user',user.id,channel);
   return recoverVerify(id,'إذا كانت البيانات مطابقة وتمكن مزود الإرسال من قبول الطلب فسيصل الرمز. إذا لم يصل، اطلب رمزاً جديداً أو جرّب قناة أخرى.');
  }
 }
 return recoverVerify(id,'إذا كانت البيانات مطابقة لحساب مسجل فقد أُرسل رمز مكوّن من 6 أرقام. الرمز صالح لمدة 10 دقائق.');
}

async function findRecoveryUser(db,identifier,contactHash){
 let user=null;
 try{
  user=await db.prepare("SELECT u.* FROM club_staff_recovery_methods r JOIN club_staff_users u ON u.id=r.user_id WHERE r.contact_hash=? AND r.is_active=1 AND u.is_active=1 LIMIT 1").bind(contactHash).first();
 }catch(_){}
 if(!user){
  try{user=await db.prepare("SELECT * FROM club_staff_users WHERE recovery_contact_hash=? AND is_active=1 LIMIT 1").bind(contactHash).first()}catch(_){}
 }
 if(!user)return null;
 if(identifier){
  const idUser=await findUserByIdentifier(db,identifier);
  if(!idUser||Number(idUser.id)!==Number(user.id))return null;
 }
 return user;
}

async function verifyOtp(req,db){
 if(!sameOrigin(req))return recoverStart({},'طلب غير صالح.');
 await ensureRecoverySchema(db);
 const f=await req.formData(),id=Number(f.get('request_id')||0),code=digits(String(f.get('code')||'')).slice(0,6);
 const row=await one(db,"SELECT * FROM club_staff_otp WHERE id=? AND consumed_at IS NULL AND expires_at>datetime('now')",[id]);
 if(!row||row.attempts>=5||code.length!==6)return recoverVerify(id,'الرمز غير صحيح أو منتهي. اطلب رمزاً جديداً.');
 const ok=await verifyOtpHash(code,row.code_salt,row.code_hash);
 if(!ok){
  try{await db.prepare("UPDATE club_staff_otp SET attempts=attempts+1 WHERE id=?").bind(id).run()}catch(_){}
  return recoverVerify(id,'الرمز غير صحيح أو منتهي. حاول مرة أخرى.');
 }
 if(!row.user_id)return recoverVerify(id,'الرمز غير صحيح أو منتهي. اطلب رمزاً جديداً.');
 const token=randomHex(32),hash=await sha256(token),expires=new Date(Date.now()+15*60*1000).toISOString();
 await db.prepare("UPDATE club_staff_otp SET reset_hash=?,reset_expires_at=?,attempts=attempts+1 WHERE id=?").bind(hash,expires,id).run();
 await audit(db,'public','otp_verified','staff_user',row.user_id,'password reset');
 return new Response(null,{status:303,headers:{
  Location:'/staff-recover/password',
  'cache-control':'no-store',
  'Set-Cookie':RESET_COOKIE+'='+token+'; Path=/staff-recover; HttpOnly; Secure; SameSite=Strict; Max-Age=900'
 }});
}

async function passwordPage(req,db,msg){
 const state=await resetState(req,db);
 if(!state)return red('/staff-recover');
 const user=await one(db,"SELECT id,username,full_name,role FROM club_staff_users WHERE id=? AND is_active=1",[state.user_id]);
 if(!user)return red('/staff-recover');
 const body='<section class="auth-hero"><span>ACCOUNT RECOVERY</span><h1>تعيين كلمة مرور جديدة</h1><p>'+esc(user.full_name||'حساب المسؤول')+' · '+esc(ROLE_LABELS[user.role]||user.role||'')+'</p></section>'+
  (msg?'<div class="auth-msg bad">'+esc(msg)+'</div>':'')+
  '<section class="auth-card"><form method="post" action="/staff-recover/password">'+
  '<label>اسم الدخول <small>اختياري — يمكنك الدخول بالهاتف أو البريد أيضاً.</small><input name="new_username" autocomplete="username" placeholder="اسم دخول جديد بالإنجليزية"></label>'+
  '<label>كلمة المرور الجديدة<input type="password" name="password" minlength="10" autocomplete="new-password" required></label>'+
  '<label>تأكيد كلمة المرور<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>'+
  '<button>حفظ وتفعيل الحساب</button></form></section>';
 return authPage('تعيين كلمة المرور',body,'/staff-recover/password');
}

async function saveRecoveredPassword(req,db){
 if(!sameOrigin(req))return passwordPage(req,db,'طلب غير صالح.');
 const state=await resetState(req,db);
 if(!state)return red('/staff-recover');
 const f=await req.formData(),password=String(f.get('password')||''),confirm=String(f.get('confirm')||''),newUsername=String(f.get('new_username')||'').trim();
 if(password.length<10||password!==confirm)return passwordPage(req,db,'كلمة المرور لا تقل عن 10 أحرف ويجب أن يتطابق التأكيد.');
 if(newUsername&&!/^[A-Za-z0-9._-]{3,40}$/.test(newUsername))return passwordPage(req,db,'اسم الدخول الاختياري يجب أن يكون 3–40 حرفاً إنجليزياً أو رقماً، ويمكن استخدام . _ -');
 if(newUsername){
  const dupe=await one(db,"SELECT id FROM club_staff_users WHERE lower(username)=lower(?) AND id<>?",[newUsername,state.user_id]);
  if(dupe)return passwordPage(req,db,'اسم الدخول مستخدم بالفعل. اختر اسماً آخر أو اتركه فارغاً.');
 }
 const hp=await hashPassword(password);
 if(newUsername){
  await db.prepare("UPDATE club_staff_users SET username=?,password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
   .bind(newUsername,hp.hash,hp.salt,state.user_id).run();
 }else{
  await db.prepare("UPDATE club_staff_users SET password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
   .bind(hp.hash,hp.salt,state.user_id).run();
 }
 try{await db.prepare("DELETE FROM club_staff_sessions WHERE user_id=?").bind(state.user_id).run()}catch(_){}
 await db.prepare("UPDATE club_staff_otp SET consumed_at=CURRENT_TIMESTAMP,reset_hash=NULL,reset_expires_at=NULL WHERE id=?").bind(state.id).run();
 await audit(db,'public','password_reset_completed','staff_user',state.user_id,'all sessions revoked');
 return new Response(null,{status:303,headers:{
  Location:'/staff-login?reset=1',
  'cache-control':'no-store',
  'Set-Cookie':RESET_COOKIE+'=; Path=/staff-recover; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
 }});
}

async function resetState(req,db){
 const token=cookie(req,RESET_COOKIE);if(!token)return null;
 const hash=await sha256(token);
 return one(db,"SELECT id,user_id FROM club_staff_otp WHERE reset_hash=? AND reset_expires_at>datetime('now') AND consumed_at IS NULL LIMIT 1",[hash]);
}

async function accountSetupPage(db,ok,error){
 let users=[];
 try{users=(await db.prepare("SELECT id,username,full_name,role,password_hash,password_salt,password_changed_at,recovery_contact_hint FROM club_staff_users WHERE is_active=1 ORDER BY CASE role WHEN 'president' THEN 1 WHEN 'secretary' THEN 2 WHEN 'finance_manager' THEN 3 ELSE 9 END,id").all()).results||[]}catch(_){}
 let methods=[];
 try{methods=(await db.prepare("SELECT user_id,kind,contact_hint FROM club_staff_recovery_methods WHERE is_active=1").all()).results||[]}catch(_){}
 const byUser=new Map();
 for(const x of methods){if(!byUser.has(x.user_id))byUser.set(x.user_id,{});byUser.get(x.user_id)[x.kind]=x.contact_hint}
 const cards=users.map(function(u){
  const m=byUser.get(u.id)||{},ready=isPasswordReady(u);
  return '<section class="account-card"><div class="account-head"><div><h2>'+esc(u.full_name||u.username)+'</h2><p>'+esc(ROLE_LABELS[u.role]||u.role)+'</p></div><span class="'+(ready?'ready':'pending')+'">'+(ready?'مفعّل':'غير مفعّل')+'</span></div>'+
   '<form method="post">'+
   '<input type="hidden" name="user_id" value="'+Number(u.id)+'">'+
   '<label>اسم الدخول<input name="username" value="'+esc(u.username||'')+'" autocomplete="off"></label>'+
   '<label>هاتف الاستعادة <small>الحالي: '+esc(m.phone||((u.recovery_contact_hint||'').startsWith('••••')?u.recovery_contact_hint:'غير مربوط'))+'</small><input name="phone" inputmode="tel" autocomplete="tel" placeholder="مثال: 0912... أو 249912..."></label>'+
   '<label>بريد الاستعادة <small>الحالي: '+esc(m.email||((u.recovery_contact_hint||'').includes('@')?u.recovery_contact_hint:'غير مربوط'))+'</small><input name="email" type="email" autocomplete="email" placeholder="name@example.com"></label>'+
   '<label>كلمة مرور أولية <small>اختياري — يمكن لصاحب الحساب تفعيل نفسه بالرمز.</small><input name="password" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<button>حفظ إعداد هذا الحساب</button></form></section>';
 }).join('');
 const body='<section class="auth-hero"><span>STAFF ACCOUNT SETUP</span><h1>تهيئة حسابات المسؤولين</h1><p>هنا تُحدد بيانات الدخول ووسائل الاستعادة فعلياً. الأسماء القديمة president / secretary / finance كانت مجرد معرفات داخلية أنشأها النظام تلقائياً وليست بيانات اخترتموها.</p></section>'+
  (ok?'<div class="auth-msg good">تم حفظ إعداد الحساب.</div>':'')+
  (error?'<div class="auth-msg bad">'+esc(errorText(error))+'</div>':'')+
  '<div class="accounts">'+cards+'</div><p class="auth-note">لا تُخزن أرقام الهاتف أو البريد كنص واضح داخل جدول الحسابات؛ تُحفظ بصمتها مع تلميح مختصر، والرموز المؤقتة تنتهي تلقائياً.</p>';
 return authPage('تهيئة الحسابات',body,'/staff-login');
}

async function saveAccountSetup(req,db,actor,path){
 if(!sameOrigin(req))return red(path+'?error=origin');
 await ensureRecoverySchema(db);
 const f=await req.formData(),id=Number(f.get('user_id')||0),username=String(f.get('username')||'').trim(),phoneRaw=String(f.get('phone')||'').trim(),emailRaw=String(f.get('email')||'').trim(),password=String(f.get('password')||'');
 const target=await one(db,"SELECT * FROM club_staff_users WHERE id=? AND is_active=1",[id]);
 if(!target)return red(path+'?error=user');
 if(username){
  if(!/^[A-Za-z0-9._-]{3,40}$/.test(username))return red(path+'?error=username');
  const d=await one(db,"SELECT id FROM club_staff_users WHERE lower(username)=lower(?) AND id<>?",[username,id]);
  if(d)return red(path+'?error=duplicate');
  await db.prepare("UPDATE club_staff_users SET username=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(username,id).run();
 }
 if(phoneRaw){
  const phone=normalizePhone(phoneRaw);
  if(phone.length<10)return red(path+'?error=phone');
  const hash=await sha256(phone),hint='•••• '+phone.slice(-4);
  const d=await one(db,"SELECT user_id FROM club_staff_recovery_methods WHERE contact_hash=? AND user_id<>? AND is_active=1",[hash,id]);
  if(d)return red(path+'?error=contact');
  await upsertRecoveryMethod(db,id,'phone',hash,hint);
  await db.prepare("UPDATE club_staff_users SET recovery_contact_hash=?,recovery_contact_hint=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,hint,id).run();
 }
 if(emailRaw){
  const email=normalizeEmail(emailRaw);
  if(!validEmail(email))return red(path+'?error=email');
  const hash=await sha256(email),hint=emailHint(email);
  const d=await one(db,"SELECT user_id FROM club_staff_recovery_methods WHERE contact_hash=? AND user_id<>? AND is_active=1",[hash,id]);
  if(d)return red(path+'?error=contact');
  await upsertRecoveryMethod(db,id,'email',hash,hint);
  if(!phoneRaw)await db.prepare("UPDATE club_staff_users SET recovery_contact_hash=?,recovery_contact_hint=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,hint,id).run();
 }
 if(password){
  if(password.length<10)return red(path+'?error=short');
  const hp=await hashPassword(password);
  await db.prepare("UPDATE club_staff_users SET password_hash=?,password_salt=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hp.hash,hp.salt,id).run();
  try{await db.prepare("DELETE FROM club_staff_sessions WHERE user_id=?").bind(id).run()}catch(_){}
 }
 await audit(db,String(actor.username||'owner'),'staff_account_setup','staff_user',id,'username/contact/password setup');
 return red(path+'?ok=1');
}

async function upsertRecoveryMethod(db,userId,kind,hash,hint){
 const row=await one(db,"SELECT id FROM club_staff_recovery_methods WHERE user_id=? AND kind=?",[userId,kind]);
 if(row){
  await db.prepare("UPDATE club_staff_recovery_methods SET contact_hash=?,contact_hint=?,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,hint,row.id).run();
 }else{
  await db.prepare("INSERT INTO club_staff_recovery_methods(user_id,kind,contact_hash,contact_hint,is_active) VALUES(?,?,?,?,1)").bind(userId,kind,hash,hint).run();
 }
}

async function ensureRecoverySchema(db){
 const sqls=[
  "CREATE TABLE IF NOT EXISTS club_staff_recovery_methods(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,kind TEXT NOT NULL,contact_hash TEXT NOT NULL UNIQUE,contact_hint TEXT,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,kind))",
  "CREATE INDEX IF NOT EXISTS idx_staff_recovery_method_user ON club_staff_recovery_methods(user_id,is_active)",
  "CREATE TABLE IF NOT EXISTS club_staff_otp(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,channel TEXT NOT NULL,contact_hash TEXT NOT NULL,code_hash TEXT NOT NULL,code_salt TEXT NOT NULL,requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,consumed_at TEXT,provider_message_id TEXT,reset_hash TEXT,reset_expires_at TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_staff_otp_contact_time ON club_staff_otp(contact_hash,requested_at)",
  "CREATE INDEX IF NOT EXISTS idx_staff_otp_reset ON club_staff_otp(reset_hash,reset_expires_at)"
 ];
 for(const q of sqls)try{await db.prepare(q).run()}catch(_){}
}

function capabilities(env){
 return {
  whatsapp:!!(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID),
  email:!!(env.BREVO_API_KEY&&(env.BREVO_SENDER_EMAIL||env.BREVO_FROM_EMAIL)),
  sms:!!(env.BREVO_API_KEY&&env.BREVO_SMS_SENDER)
 };
}

async function deliverOtp(env,channel,contact,code){
 if(channel==='whatsapp')return sendWhatsAppOtp(env,contact,code);
 if(channel==='email')return sendEmailOtp(env,contact,code);
 if(channel==='sms')return sendSmsOtp(env,contact,code);
 return {ok:false,id:''};
}

async function sendWhatsAppOtp(env,to,code){
 try{
  const template=String(env.WHATSAPP_OTP_TEMPLATE||'wdn_membership_update');
  const params=template==='wdn_membership_update'
   ?[{type:'text',text:code},{type:'text',text:'رمز أمان حساب الإدارة - صالح 10 دقائق'}]
   :[{type:'text',text:code}];
  const r=await fetch('https://graph.facebook.com/'+String(env.WHATSAPP_GRAPH_VERSION||META_VERSION)+'/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{
   method:'POST',
   headers:{authorization:'Bearer '+env.WHATSAPP_TOKEN,'content-type':'application/json'},
   body:JSON.stringify({messaging_product:'whatsapp',to:digits(to),type:'template',template:{name:template,language:{code:String(env.WHATSAPP_OTP_LANGUAGE||'ar')},components:[{type:'body',parameters:params}]}})
  });
  const d=await r.json().catch(function(){return {}});
  return {ok:!!(r.ok&&d?.messages?.[0]?.id),id:d?.messages?.[0]?.id||''};
 }catch(_){return {ok:false,id:''}}
}

async function sendEmailOtp(env,to,code){
 try{
  const sender=String(env.BREVO_SENDER_EMAIL||env.BREVO_FROM_EMAIL||'');
  if(!sender)return {ok:false,id:''};
  const r=await fetch('https://api.brevo.com/v3/smtp/email',{
   method:'POST',
   headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({
    sender:{email:sender,name:String(env.BREVO_SENDER_NAME||'نادي ود نفيع')},
    to:[{email:to}],
    subject:'رمز تفعيل أو استعادة حساب نادي ود نفيع',
    textContent:'رمز التحقق: '+code+' — صالح لمدة 10 دقائق. لا تشارك الرمز مع أي شخص.',
    htmlContent:'<div dir="rtl"><h2>نادي ود نفيع</h2><p>رمز التحقق:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px">'+code+'</p><p>صالح لمدة 10 دقائق. لا تشارك الرمز مع أي شخص.</p></div>'
   })
  });
  const d=await r.json().catch(function(){return {}});
  return {ok:r.ok,id:String(d.messageId||'')};
 }catch(_){return {ok:false,id:''}}
}

async function sendSmsOtp(env,to,code){
 try{
  const r=await fetch('https://api.brevo.com/v3/transactionalSMS/send',{
   method:'POST',
   headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({sender:String(env.BREVO_SMS_SENDER),recipient:digits(to),content:'رمز نادي ود نفيع: '+code+'. صالح 10 دقائق. لا تشاركه.',type:'transactional',unicodeEnabled:true,tag:'staff-account-otp'})
  });
  const d=await r.json().catch(function(){return {}});
  return {ok:r.ok,id:String(d.messageId||'')};
 }catch(_){return {ok:false,id:''}}
}

function loginPage(db,next,success,error){
 const body='<section class="auth-hero"><span>STAFF ACCESS</span><h1>دخول المسؤولين</h1><p>استخدم اسم الدخول الذي اخترته، أو الهاتف/البريد المسجل بعد تفعيل الحساب.</p></section>'+
  (success?'<div class="auth-msg good">'+esc(success)+'</div>':'')+
  (error?'<div class="auth-msg bad">'+esc(error)+'</div>':'')+
  '<section class="auth-card"><form method="post" action="/staff-login">'+
  '<input type="hidden" name="next" value="'+esc(next)+'">'+
  '<label>اسم الدخول أو الهاتف أو البريد<input name="identifier" autocomplete="username" required></label>'+
  '<label>كلمة المرور<input type="password" name="password" autocomplete="current-password" required></label>'+
  '<button>دخول</button></form>'+
  '<div class="auth-links"><a href="/staff-recover">تفعيل أو استعادة الحساب</a></div>'+
  '<p class="auth-note">لا توجد كلمة مرور مشتركة. الحسابات التي لم تُفعّل بعد لا تقبل أي كلمة مرور حتى تتم التهيئة أو التحقق بالرمز.</p></section>';
 return authPage('دخول المسؤولين',body,'/staff-login');
}

function recoverStart(env,msg){
 const caps=capabilities(env||{});
 const option=function(value,title,desc,ready){
  return '<label class="channel '+(ready?'':'disabled')+'"><input type="radio" name="channel" value="'+value+'" '+(ready?'':'disabled')+' required><b>'+title+'</b><span>'+desc+'</span><small>'+(ready?'جاهز للإرسال':'يحتاج إعداد مزود الإرسال')+'</small></label>';
 };
 const body='<section class="auth-hero"><span>SECURE RECOVERY</span><h1>تفعيل أو استعادة الحساب</h1><p>أدخل وسيلة الاستعادة المسجلة واختر أين تريد استلام رمز التحقق.</p></section>'+
  (msg?'<div class="auth-msg bad">'+esc(msg)+'</div>':'')+
  '<section class="auth-card"><form method="post" action="/staff-recover/request">'+
  '<label>اسم الدخول <small>اختياري إذا كنت لا تتذكره.</small><input name="identifier" autocomplete="username"></label>'+
  '<label>الهاتف أو البريد المسجل<input name="contact" autocomplete="email tel" required></label>'+
  '<div class="channels">'+
  option('whatsapp','واتساب','رمز مؤقت إلى رقم واتساب المسجل.',caps.whatsapp)+
  option('email','البريد الإلكتروني','رمز مؤقت إلى البريد المسجل.',caps.email)+
  option('sms','رسالة SMS','OTP إلى رقم الهاتف المسجل.',caps.sms)+
  '</div><button>إرسال رمز التحقق</button></form>'+
  '<p class="auth-note">إذا لم تكن وسيلة الاستعادة مربوطة بالحساب، يجب ربطها مرة واحدة من «تهيئة حسابات المسؤولين» بواسطة المدير.</p>'+
  '<div class="auth-links"><a href="/staff-login">العودة للدخول</a></div></section>';
 return authPage('استعادة الحساب',body,'/staff-recover');
}

function recoverVerify(id,msg){
 const body='<section class="auth-hero"><span>ONE-TIME CODE</span><h1>أدخل رمز التحقق</h1><p>الرمز 6 أرقام وصالح لمدة 10 دقائق فقط.</p></section>'+
  '<div class="auth-msg good">'+esc(msg)+'</div>'+
  '<section class="auth-card"><form method="post" action="/staff-recover/verify"><input type="hidden" name="request_id" value="'+Number(id||0)+'">'+
  '<label>رمز التحقق<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9٠-٩]{6}" maxlength="6" required></label>'+
  '<button>تحقق</button></form><div class="auth-links"><a href="/staff-recover">طلب رمز جديد</a></div></section>';
 return authPage('رمز التحقق',body,'/staff-recover');
}

function authPage(title,body,current,status){
 const css=[
  '.auth-wrap{width:min(760px,calc(100% - 28px));margin:30px auto 56px}',
  '.auth-hero{background:#102d56;color:#fff;border-radius:18px;padding:28px;margin-bottom:16px}.auth-hero span{color:#e8ba38;font-size:12px;font-weight:800}.auth-hero h1{color:#e8ba38;font-size:clamp(30px,6vw,48px);margin:5px 0 10px}.auth-hero p{color:#d8e1ed;margin:0}',
  '.auth-card,.account-card{background:#0d336d;color:#fff;border:1px solid #b89542;border-radius:18px;padding:24px;margin:14px 0}.auth-card form,.account-card form{display:grid;gap:14px}',
  '.auth-card label,.account-card label{font-weight:700}.auth-card label small,.account-card label small{display:block;font-weight:400;color:#ced8e7;margin:2px 0 6px}',
  '.auth-card input,.account-card input{width:100%;min-height:52px;border:1px solid #d5dce7;border-radius:12px;padding:11px 14px;font:inherit;background:#fff;color:#102746}',
  '.auth-card button,.account-card button{min-height:52px;border:0;border-radius:12px;background:#e0ad22;color:#102746;font:inherit;font-weight:900;cursor:pointer}',
  '.auth-msg{padding:14px 17px;border-radius:13px;margin:12px 0}.auth-msg.good{background:#e7f7ed;color:#145b30;border:1px solid #9dd7af}.auth-msg.bad{background:#fff0f1;color:#8d2330;border:1px solid #e99aa4}',
  '.auth-links{display:flex;justify-content:center;gap:18px;margin-top:16px}.auth-links a{color:#fff;font-weight:800}.auth-note{color:#d3deec;font-size:14px;margin-top:18px}',
  '.channels{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.channel{position:relative;display:block;border:1px solid #ffffff2c;border-radius:13px;padding:14px;background:#ffffff09;cursor:pointer}.channel input{width:auto;min-height:auto;margin:0 0 8px}.channel b,.channel span,.channel small{display:block}.channel b{color:#f0c856}.channel span{font-size:13px;font-weight:400;color:#d6e0ed;margin:4px 0}.channel small{font-size:11px;color:#9de0b4}.channel.disabled{opacity:.45;cursor:not-allowed}.channel.disabled small{color:#f2b1b6}',
  '.accounts{display:grid;grid-template-columns:1fr;gap:14px}.account-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.account-head h2{color:#e8ba38;margin:0}.account-head p{color:#d3deec;margin:3px 0}.account-head span{padding:6px 10px;border-radius:999px;font-size:12px}.account-head .ready{background:#dff6e7;color:#175c31}.account-head .pending{background:#fff1d3;color:#795813}',
  '@media(max-width:620px){.channels{grid-template-columns:1fr}.auth-card,.account-card{padding:18px}.auth-wrap{margin-top:20px}}'
 ].join('');
 return new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#102746"><title>'+esc(title)+' · '+CLUB+'</title><style>'+siteCss+sharedCss+css+'</style></head><body>'+header(current||'/staff-login')+'<main id="wdn-main" tabindex="-1"><div class="auth-wrap">'+body+'</div></main>'+footer()+'</body></html>',{status:status||200,headers:securityHeaders()});
}

function securityHeaders(){
 return {
  'content-type':'text/html; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self'; img-src 'self' https:; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'",
  'x-wadnofei-auth':'v79-otp-recovery'
 };
}

function denied(msg){return authPage('غير مصرح','<section class="auth-hero"><h1>غير مصرح</h1><p>'+esc(msg)+'</p></section>','/staff-login',403)}
function red(x){return new Response(null,{status:303,headers:{Location:x,'cache-control':'no-store'}})}
function safeNext(x){x=String(x||'');return x.startsWith('/')&&!x.startsWith('//')?x:'/club-admin'}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
function cookie(req,name){const c=req.headers.get('cookie')||'',m=c.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
function digits(x){const ar='٠١٢٣٤٥٦٧٨٩';return String(x||'').replace(/[٠-٩]/g,function(c){return String(ar.indexOf(c))}).replace(/\D/g,'')}
function normalizePhone(x){let d=digits(x);if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0')&&d.length>=9&&d.length<=10)d='249'+d.slice(1);return d}
function normalizeEmail(x){return String(x||'').trim().toLowerCase()}
function normalizeContact(x){return String(x||'').includes('@')?normalizeEmail(x):normalizePhone(x)}
function validEmail(x){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x||''))}
function emailHint(x){const p=String(x||'').split('@');if(p.length!==2)return 'بريد مسجل';const a=p[0];return (a.slice(0,2)||'*')+'***@'+p[1]}
function validContactForChannel(contact,channel){return channel==='email'?validEmail(contact):digits(contact).length>=10}
function otpCode(){const a=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;return String(a).padStart(6,'0')}
function randomHex(n){return toHex(crypto.getRandomValues(new Uint8Array(n)))}
function toHex(a){return [...a].map(function(b){return b.toString(16).padStart(2,'0')}).join('')}
function fromHex(s){if(!/^[0-9a-f]+$/i.test(s)||s.length%2)throw new Error('hex');const a=new Uint8Array(s.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(s.slice(i*2,i*2+2),16);return a}
async function sha256(x){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(x||'')));return toHex(new Uint8Array(b))}
async function hashPassword(p){const sb=crypto.getRandomValues(new Uint8Array(16)),salt=toHex(sb),hash=await pbkdf2(p,sb,150000);return {salt,hash}}
async function verifyPassword(p,salt,expected){try{return timingSafe(await pbkdf2(p,fromHex(salt),150000),String(expected||''))}catch(_){return false}}
async function otpHash(code,salt){return pbkdf2(code,fromHex(salt),50000)}
async function verifyOtpHash(code,salt,expected){try{return timingSafe(await otpHash(code,salt),String(expected||''))}catch(_){return false}}
async function pbkdf2(value,salt,iterations){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(value)),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},k,256);return toHex(new Uint8Array(bits))}
function timingSafe(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function one(db,q,b){try{return await db.prepare(q).bind(...(b||[])).first()}catch(_){return null}}
async function scalar(db,q,b){const x=await one(db,q,b);return Number(x?.c||0)}
async function sessionUser(req,db){
 const cs=cookie(req,'club_sid');
 if(cs)try{const s=await db.prepare("SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions x JOIN club_staff_users u ON u.id=x.user_id WHERE x.token=? AND x.expires_at>datetime('now') AND u.is_active=1").bind(cs).first();if(s)return s}catch(_){}
 const sid=cookie(req,'sid');if(!sid)return null;
 try{const a=await db.prepare("SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')").bind(sid).first();if(a)return a}catch(_){}
 return null;
}
async function audit(db,actor,action,type,id,details){try{await db.prepare("INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)").bind(String(actor||''),action,type,String(id||''),String(details||'')).run()}catch(_){}}
function errorText(x){
 const m={origin:'طلب غير صالح.',user:'الحساب غير موجود.',username:'اسم الدخول غير صالح.',duplicate:'اسم الدخول مستخدم.',phone:'رقم الهاتف غير صالح.',email:'البريد غير صالح.',contact:'وسيلة الاستعادة مرتبطة بحساب آخر.',short:'كلمة المرور يجب ألا تقل عن 10 أحرف.'};
 return m[x]||'تعذر حفظ الإعداد.';
}
