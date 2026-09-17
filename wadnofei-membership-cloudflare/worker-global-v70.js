import app from './worker-global-v69.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
export default {
 async fetch(req,env,ctx){
  const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
  if(env.DB&&p.startsWith('/club-admin')){
   const user=await sessionUser(req,env.DB);
   if(!user)return app.fetch(req,env,ctx);
   const role=roleKey(user.role);
   if(p==='/club-admin/security-audit'&&m==='GET'){
    if(role!=='owner')return denied();
    return auditPage(env.DB);
   }
   if(p==='/club-admin'&&role==='owner'){
    const r=await app.fetch(req,env,ctx),ct=r.headers.get('content-type')||'';
    if(ct.includes('text/html')){let h=await r.text();if(!h.includes('/club-admin/security-audit')){const b='<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928">الأمان والتدقيق</h2><p>راجع محاولات الوصول والعمليات الحساسة وطلبات استعادة الحساب.</p><a href="/club-admin/security-audit" style="display:block;text-align:center;padding:12px;border-radius:12px;background:#d5a928;color:#061a43;text-decoration:none;font-weight:900">فتح سجل الأمان</a></section>';h=h.includes('</main>')?h.replace('</main>',b+'</main>'):h+b}const hd=new Headers(r.headers);hd.delete('content-length');hd.set('cache-control','no-store');return new Response(h,{status:r.status,statusText:r.statusText,headers:hd})}
   }
  }
  return app.fetch(req,env,ctx);
 },
 async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};
async function auditPage(db){let logs=[],rec=[];try{logs=(await db.prepare(`SELECT actor,action,target,details,created_at FROM club_security_audit ORDER BY id DESC LIMIT 150`).all()).results||[]}catch(_){}try{rec=(await db.prepare(`SELECT username_hint,status,requested_at,expires_at,completed_at FROM club_account_recovery ORDER BY id DESC LIMIT 80`).all()).results||[]}catch(_){}const body=`<div class="stats"><div><b>${logs.length}</b><span>أحدث أحداث الأمان</span></div><div><b>${rec.filter(x=>x.status==='pending').length}</b><span>طلبات استعادة معلقة</span></div></div><section><h2>سجل الأمان</h2>${logs.length?logs.map(x=>`<article><b>${esc(x.action)}</b><span>${esc(x.actor)} · ${esc(x.target)}</span><small>${esc(x.created_at)} · ${esc(x.details)}</small></article>`).join(''):'<p>لا توجد أحداث مسجلة.</p>'}</section><section><h2>استعادة الحسابات</h2>${rec.length?rec.map(x=>`<article><b>${esc(x.username_hint||'حساب غير محدد')}</b><span>${esc(x.status)}</span><small>طلب: ${esc(x.requested_at)} · انتهاء: ${esc(x.expires_at)}</small></article>`).join(''):'<p>لا توجد طلبات استعادة.</p>'}</section>`;return H('سجل الأمان والتدقيق',body)}
async function sessionUser(req,db){const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);try{const u=await db.prepare(`SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(u)return u}catch(_){}try{return await db.prepare(`SELECT a.id,a.username,'owner' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}}
function roleKey(r){r=String(r||'').toLowerCase();if(['treasurer','finance','amin_mal'].includes(r))return'finance';if(['secretary','secretariat','scretary'].includes(r))return'secretary';if(['owner','superadmin','admin'].includes(r))return'owner';return'limited'}
function H(t,b){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t} · ${CLUB}</title><style>body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui;line-height:1.7}main{width:min(1000px,94%);margin:28px auto}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.stats div,section{background:#fff;border:1px solid #dbe4f4;border-radius:18px;padding:17px;margin:14px 0}.stats b{display:block;font-size:30px;color:#a87e0b}.stats span,article span,article small{display:block;color:#667991}article{padding:11px 0;border-bottom:1px solid #e7edf6}article:last-child{border:0}h1,h2{color:#061a43}a{color:#0a347c}</style></head><body><main><p><a href="/club-admin">← مركز الإدارة</a></p><h1>${t}</h1>${b}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function denied(){return new Response('غير مصرح',{status:403,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
