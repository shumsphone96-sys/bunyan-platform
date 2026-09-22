import app from './worker-global-v68.js';
import {normalizeRole,classifyAdminPath,isAllowed} from './role-policy.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB && p.startsWith('/club-admin')){
      const user=await sessionUser(req,env.DB);
      if(user){
        const role=roleKey(user.role);
        const area=classify(p);
        if(!allowed(user.role,area,m)){
          await audit(env.DB,user,'access_denied',p,m);
          return denied();
        }
        if(m!=='GET'&&m!=='HEAD') await audit(env.DB,user,'sensitive_request',p,m);
      }
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

function classify(p){
  if(/^\/club-admin\/(finance|payments|receipts|expenses|income|memberships)(\/|$|\?)/.test(p))return'finance';
  if(/^\/club-admin\/(constitution|workqueue|applications|membership|members|documents|minutes|decisions)(\/|$|\?)/.test(p))return'secretary';
  if(/^\/club-admin\/(system-check|data-quality|service-level|users|settings|security-audit|backup)(\/|$|\?)/.test(p))return'owner';
  return'common';
}
function allowed(role,area){if(role==='owner')return true;if(area==='common')return true;if(role==='finance')return area==='finance';if(role==='secretary')return area==='secretary';return false}
function roleKey(r){r=String(r||'').toLowerCase();if(['treasurer','finance','amin_mal'].includes(r))return'finance';if(['secretary','secretariat','scretary'].includes(r))return'secretary';if(['owner','superadmin','admin'].includes(r))return'owner';return'limited'}
async function sessionUser(req,db){const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);try{const u=await db.prepare(`SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(u)return u}catch(_){}try{const a=await db.prepare(`SELECT a.id,a.username,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}return null}
async function audit(db,u,action,path,method){try{await db.prepare(`CREATE TABLE IF NOT EXISTS club_security_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,target TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();await db.prepare(`INSERT INTO club_security_audit(actor,action,target,details) VALUES(?,?,?,?)`).bind(String(u.username||u.id),action,path,method).run()}catch(_){}}
function denied(){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غير مصرح</title></head><body style="font-family:system-ui;background:#f5f8ff;color:#10203d"><main style="width:min(650px,92%);margin:60px auto;background:#fff;padding:24px;border-radius:18px"><h1>هذه الوحدة خارج صلاحيات حسابك</h1><p>تم تسجيل محاولة الوصول في سجل الأمان. استخدم مساحة عملك أو راجع مدير النظام إذا كانت الصلاحية مطلوبة لعملك.</p><a href="/club-admin/my-workspace">العودة إلى مساحة عملي</a></main></body></html>`,{status:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
