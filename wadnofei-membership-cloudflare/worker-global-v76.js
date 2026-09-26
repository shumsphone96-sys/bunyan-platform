import app from './worker-global-v75.js';
import {normalizeRole,classifyAdminPath,isAllowed} from './role-policy.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    const user=env.DB?await sessionUser(req,env.DB):null;

    if(user){
      const role=normalizeRole(user.role);

      if(p==='/club-admin'&&m==='GET'){
        return red('/club-admin/my-workspace');
      }

      if(p==='/club-admin/my-workspace'&&m==='GET'){
        return workspace(user,role);
      }

      if(p==='/applications'||p.startsWith('/applications/')){
        if(role!=='owner'&&role!=='secretary'){
          await audit(env.DB,user,'access_denied',p,m);
          return denied('هذه الوحدة من اختصاص السكرتارية.');
        }
      }

      if(p.startsWith('/club-admin')){
        const area=classifyAdminPath(p);
        if(!isAllowed(user.role,area,m)){
          await audit(env.DB,user,'access_denied',p,m);
          return denied(area==='finance'
            ?'هذه الوحدة من اختصاص أمين المال.'
            :area==='secretary'
              ?'هذه الوحدة من اختصاص السكرتارية.'
              :'هذه الوحدة للمدير والمراجعة العامة فقط.');
        }
      }
    }

    return app.fetch(req,env,ctx);
  },
  async scheduled(e,env,ctx){
    if(app.scheduled)return app.scheduled(e,env,ctx);
  }
};

async function sessionUser(req,db){
  const c=req.headers.get('cookie')||'';
  const cs=c.match(/(?:^|;\s*)club_sid=([^;]+)/);
  if(cs){
    const t=decodeURIComponent(cs[1]);
    try{
      const s=await db.prepare(
        "SELECT u.id,u.username,u.full_name,u.role FROM club_staff_sessions x JOIN club_staff_users u ON u.id=x.user_id WHERE x.token=? AND x.expires_at>datetime('now') AND u.is_active=1"
      ).bind(t).first();
      if(s)return s;
    }catch(_){}
  }

  const sm=c.match(/(?:^|;\s*)sid=([^;]+)/);
  if(!sm)return null;
  const t=decodeURIComponent(sm[1]);
  try{
    const a=await db.prepare(
      "SELECT a.id,a.username,a.username full_name,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')"
    ).bind(t).first();
    if(a)return a;
  }catch(_){}
  try{
    const u=await db.prepare(
      "SELECT u.id,u.username,u.username full_name,COALESCE(u.role,'limited') role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')"
    ).bind(t).first();
    if(u)return u;
  }catch(_){}
  return null;
}

function workspace(user,role){
  const name=esc(user.full_name||user.username||'المستخدم');
  const roleName=role==='owner'?'المدير — إشراف كامل':role==='secretary'?'السكرتير':role==='finance'?'أمين المال':'حساب محدود';
  let cards='';

  if(role==='secretary'||role==='owner'){
    cards+=card('طلبات العضوية','استلام الطلبات ومراجعتها واستكمال إجراءاتها.','/applications');
    cards+=card('مركز العضوية','متابعة رحلة العضوية والاعتماد والسجل.','/club-admin/membership-center');
    cards+=card('قائمة العمل','المعاملات والمتابعات الخاصة بالسكرتارية.','/club-admin/workqueue');
    cards+=card('النظام الأساسي','إدارة وثيقة النظام الأساسي ونسخها.','/club-admin/constitution');
    cards+=card('محتوى النادي','إدارة المحتوى والوثائق الإدارية.','/club-admin/content');
  }

  if(role==='finance'||role==='owner'){
    cards+=card('المالية','إدارة الإيرادات والمصروفات والموقف المالي.','/club-admin/finance');
    cards+=card('دفتر الأستاذ','متابعة القيود والحركة المالية.','/club-admin/ledger');
    cards+=card('العضويات والتجديد','متابعة الاشتراكات والحالة المالية للأعضاء.','/club-admin/memberships');
    cards+=card('التقارير المالية','تقارير ومخرجات الحسابات.','/club-admin/reports');
  }

  if(role==='owner'){
    cards+=card('غرفة القيادة','متابعة السكرتارية والمالية والعضوية من مكان واحد.','/club-admin/command-center');
    cards+=card('مركز الأمان','الحسابات والاستعادة وسجل العمليات.','/club-admin/security-center');
    cards+=card('المستخدمون والصلاحيات','إدارة حسابات المسؤولين وصلاحياتهم.','/club-admin/access');
    cards+=card('جاهزية النظام','فحص الجاهزية وجودة التشغيل قبل أي نشر.','/club-admin/release-readiness');
    cards+=card('جودة البيانات','مراجعة سلامة البيانات والمشاكل التشغيلية.','/club-admin/data-quality');
  }

  if(!cards)cards=card('حسابي','هذا الحساب لا يملك وحدات تشغيلية إضافية.','/club-admin/security');

  return page('مساحة عملي',`
    <section class="hero">
      <span>WAD NOFEI · ROLE WORKSPACE</span>
      <h1>${name}</h1>
      <p>${esc(roleName)}</p>
    </section>
    <section class="notice">
      <b>الصلاحيات مفصولة حسب الوظيفة.</b>
      <p>كل حساب يرى وينفذ مهامه فقط، بينما حساب المدير يراجع جميع الوحدات.</p>
    </section>
    <div class="grid">${cards}</div>
    <div class="foot"><a href="/staff-security">أمان حسابي</a><a href="/staff-logout">تسجيل الخروج</a></div>
  `);
}

function card(t,d,h){
  return `<a class="card" href="${h}"><h2>${esc(t)}</h2><p>${esc(d)}</p><b>فتح ←</b></a>`;
}

async function audit(db,u,action,path,method){
  try{
    await db.prepare(
      "INSERT INTO club_security_audit(actor,action,target,details) VALUES(?,?,?,?)"
    ).bind(String(u.username||u.id),action,path,method).run();
  }catch(_){}
}

function denied(msg){
  return page('غير مصرح',`
    <section class="hero"><h1>هذه الوحدة خارج صلاحيات حسابك</h1><p>${esc(msg)}</p></section>
    <section class="notice"><a href="/club-admin/my-workspace">العودة إلى مساحة عملي</a></section>
  `,403);
}

function red(x){return new Response(null,{status:303,headers:{Location:x,'cache-control':'no-store'}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function page(title,body,status=200){
  const css=`*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(155deg,#061a43,#0b347a);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(980px,94%);margin:28px auto}.hero,.notice,.card{border:1px solid #d5a92866;border-radius:20px;background:#08265ddd}.hero,.notice{padding:20px;margin:15px 0}.hero span,.hero h1,.card h2{color:#f5b329}.hero h1{margin:.2em 0}.hero p,.notice p{margin:.3em 0;opacity:.86}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{display:block;color:#fff;text-decoration:none;padding:18px;min-height:150px}.card h2{margin-top:0}.card p{opacity:.82}.card b{color:#f5b329}.foot{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.foot a,.notice a{display:inline-block;padding:12px 16px;border-radius:12px;background:#f5b329;color:#061a43;text-decoration:none;font-weight:900}@media(max-width:700px){.grid{grid-template-columns:1fr}}`;
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · نادي ود نفيع</title><style>${css}</style></head><body><main>${body}</main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-wadnofei-ui':'v76-strict-rbac'}});
}
