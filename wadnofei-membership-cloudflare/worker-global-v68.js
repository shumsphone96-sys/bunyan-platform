import app from './worker-global-v67.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(p==='/forgot-account'&&m==='GET') return recoveryPage();
    if(p==='/forgot-account'&&m==='POST'&&env.DB) return requestRecovery(req,env.DB);

    if(p.startsWith('/club-admin')&&env.DB){
      const user=await sessionUser(req,env.DB);
      if(user){
        if(p==='/club-admin/my-workspace'&&m==='GET') return workspace(env.DB,user);
        if(p==='/club-admin/security'&&m==='GET') return securityPage(user);
      }
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(p==='/login'&&!html.includes('/forgot-account')) html=html.replace('</form>','</form><p style="text-align:center"><a href="/forgot-account">نسيت اسم المستخدم أو كلمة المرور؟</a></p>');
      if(p==='/club-admin'&&!html.includes('/club-admin/my-workspace')){
        const user=await sessionUser(req,env.DB);
        if(user){const block=`<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928">مساحة عملي</h2><p>${esc(roleLabel(user.role))} — وصول حسب الصلاحية المسجلة، مع سجل تدقيق للعمليات.</p><a href="/club-admin/my-workspace" style="display:block;text-align:center;padding:12px;border-radius:12px;background:#d5a928;color:#061a43;text-decoration:none;font-weight:900">فتح مساحة العمل</a></section>`;html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;}
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v68-role-security');return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){const qs=[
 `CREATE TABLE IF NOT EXISTS club_account_recovery(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,username_hint TEXT,contact TEXT,token_hash TEXT,expires_at TEXT,status TEXT NOT NULL DEFAULT 'pending',requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT)`,
 `CREATE INDEX IF NOT EXISTS idx_recovery_status ON club_account_recovery(status,expires_at)`,
 `CREATE TABLE IF NOT EXISTS club_security_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,target TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
];for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}
async function sessionUser(req,db){const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);try{const u=await db.prepare(`SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(u)return u}catch(_){}try{const a=await db.prepare(`SELECT a.id,a.username,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}return null}
function roleKey(r){r=String(r||'').toLowerCase();if(['treasurer','finance','amin_mal'].includes(r))return'finance';if(['secretary','secretariat','scretary'].includes(r))return'secretary';if(['owner','superadmin','admin'].includes(r))return'owner';return'limited'}
function roleLabel(r){const k=roleKey(r);return k==='finance'?'أمين المال':k==='secretary'?'السكرتير':k==='owner'?'مالك/مدير النظام':'مستخدم بصلاحيات محددة'}
async function workspace(db,u){const k=roleKey(u.role);let cards='';if(k==='finance'||k==='owner')cards+=card('المالية','مراجعة المدفوعات والإيصالات والموقف المالي.','/club-admin/finance')+card('العضويات والتجديد','متابعة الاشتراكات والحالة المالية للأعضاء.','/club-admin/memberships');if(k==='secretary'||k==='owner')cards+=card('طلبات العضوية','مراجعة الطلبات والإجراءات والسجل.','/applications')+card('قائمة العمل','المعاملات التي تحتاج إجراء ومتابعة.','/club-admin/workqueue')+card('النظام الأساسي','إدارة مشروع النظام الأساسي ووثيقته.','/club-admin/constitution');if(k==='owner')cards+=card('فحص النظام','الصحة وجودة البيانات والرقابة.','/club-admin/system-check');if(!cards)cards=card('حسابك','الحساب فعال، ولا توجد وحدات إضافية ممنوحة لهذه الصلاحية.','/club-admin/security');return adminPage('مساحة عملي',`<section class="who"><b>${esc(u.username)}</b><span>${esc(roleLabel(u.role))}</span></section><div class="grid">${cards}</div><p class="hint">ظهور الرابط لا يمنح الصلاحية وحده؛ كل عملية حساسة يجب أن تتحقق من الدور في الخادم.</p>`)}
function card(t,d,h){return `<a class="card" href="${h}"><h2>${t}</h2><p>${d}</p><b>فتح ←</b></a>`}
function securityPage(u){return adminPage('الأمان والحساب',`<section class="panel"><h2>الحساب</h2><p>اسم المستخدم: <b>${esc(u.username)}</b></p><p>الدور: <b>${esc(roleLabel(u.role))}</b></p><p>تغيير كلمة المرور يتم من أداة تغيير كلمة المرور الحالية. وإذا تعذر الدخول استخدم مسار الاستعادة.</p></section>`)}
function recoveryPage(msg=''){return publicPage('استعادة الحساب',`<section class="panel"><h1>استعادة اسم المستخدم أو كلمة المرور</h1><p>أدخل اسم المستخدم إن كنت تتذكره، ووسيلة الاتصال المسجلة بالحساب. لن نعرض ما إذا كان الحساب موجودًا أو لا.</p>${msg?`<div class="msg">${esc(msg)}</div>`:''}<form method="post"><input name="username" placeholder="اسم المستخدم — اختياري"><input name="contact" required placeholder="الهاتف أو البريد المسجل"><button>إرسال طلب الاستعادة</button></form><small>لأمان النادي، الاستعادة لا تعرض كلمة المرور القديمة ولا تعيدها. يتم إنشاء طلب استعادة مسجل ومؤقت ثم التحقق منه قبل تعيين بيانات دخول جديدة.</small></section>`)}
async function requestRecovery(req,db){const f=await req.formData(),username=String(f.get('username')||'').trim(),contact=String(f.get('contact')||'').trim().slice(0,160);if(contact){let uid=null;try{if(username){const u=await db.prepare(`SELECT id FROM users WHERE lower(username)=lower(?) LIMIT 1`).bind(username).first();uid=u?.id||null}}catch(_){}try{await db.prepare(`INSERT INTO club_account_recovery(user_id,username_hint,contact,expires_at,status) VALUES(?,?,?,datetime('now','+30 minutes'),'pending')`).bind(uid,username,contact).run();await db.prepare(`INSERT INTO club_security_audit(actor,action,target,details) VALUES('public','recovery_requested',?,'account recovery request')`).bind(username||'unknown').run()}catch(_){}}return recoveryPage('إذا كانت البيانات مطابقة لحساب مسجل، سيُستكمل طلب الاستعادة عبر القناة المعتمدة. لا نكشف بيانات الحساب من هذه الصفحة.')}
function publicPage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ${CLUB}</title><style>${css()}</style></head><body><main>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}})}
function adminPage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ${CLUB}</title><style>${css()}</style></head><body><main><p><a href="/club-admin">← مركز الإدارة</a></p><h1>${title}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.7}main{width:min(900px,94%);margin:30px auto}.panel,.who,.card{background:#fff;border:1px solid #dbe4f4;border-radius:18px;padding:18px;box-shadow:0 10px 28px #12325d10}.panel form{display:grid;gap:10px}.panel input{padding:13px;border:1px solid #cbd6e7;border-radius:11px;font-size:16px}.panel button{border:0;border-radius:11px;background:#f1c43d;color:#061a43;padding:13px;font-weight:900}.msg{padding:11px;border-radius:10px;background:#eef6ff;margin:10px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.card{text-decoration:none;color:#10203d}.card h2{color:#061a43;margin-top:0}.card>b,.who span{color:#a87e0b}.who{display:flex;justify-content:space-between;gap:12px}.hint{color:#63758d}@media(max-width:650px){.grid{grid-template-columns:1fr}.who{display:block}}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
