import app from './worker-global-v29.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/club-admin/notifications/manual-pending'&&m==='GET'){
      if(!(await adminSession(req,env.DB))) return red('/login');
      return manualPendingPage(env);
    }

    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await response.text();
      if(p==='/club-admin/notifications/health') html=polishHealth(html);
      if(p==='/club-admin/notifications/history') html=polishHistory(html);
      if(p==='/club-admin/notifications') html=polishCenter(html);
      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v30-immediate-fallback');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  },
  async scheduled(event,env,ctx){
    if(app.scheduled) return app.scheduled(event,env,ctx);
  }
};

async function manualPendingPage(env){
  let rows=[];
  try{
    const r=await env.DB.prepare(`SELECT id,application_no,member_name,actual_recipient,target_phone,event_type,message,status,error,created_at FROM club_notifications WHERE status IN ('waiting_template','failed') ORDER BY id DESC LIMIT 50`).all();
    rows=r.results||[];
  }catch(_){}

  const cards=rows.length?rows.map(n=>{
    const phone=String(n.actual_recipient||n.target_phone||'').replace(/\D/g,'');
    const text=String(n.message||fallbackMessage(n)||'').trim();
    const href=`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`;
    return `<article><div class="top"><b>${esc(label(n.event_type))}</b><span>${esc(n.status==='waiting_template'?'بانتظار Meta':n.status)}</span></div><h3>${esc(n.member_name||'—')}</h3><p>${esc(n.application_no||'')}</p><small dir="ltr">+${esc(phone)}</small><p class="msg">${esc(text)}</p><a class="wa" href="${href}" target="_blank" rel="noopener">إرسال الآن عبر واتساب</a></article>`;
  }).join(''):'<article><h3>لا توجد إشعارات معلقة الآن ✅</h3></article>';

  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>الإرسال الفوري</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}main{width:min(860px,92%);margin:28px auto}.hero{background:#08265dcc;border:1px solid #d5a92888;border-radius:22px;padding:18px;margin-bottom:14px}.hero h1{margin:0 0 8px;color:#d5a928}.hero p{line-height:1.8;margin:0}.actions{display:grid;gap:10px;margin:14px 0}.actions form{margin:0}.actions button,.actions a{width:100%;display:block;border:0;border-radius:13px;padding:13px 15px;font-weight:900;text-align:center;text-decoration:none}.retry{background:#25D366;color:#06233f}.back{background:#d5a928;color:#061a43}.list{display:grid;gap:12px}article{background:#08265dcc;border:1px solid #d5a92855;border-radius:18px;padding:15px}.top{display:flex;justify-content:space-between;gap:10px}.top b{color:#ffd65b}.top span{color:#ffd65b;background:#ffffff12;padding:5px 9px;border-radius:999px}h3{margin:10px 0 4px}.msg{background:#0002;padding:10px;border-radius:10px;line-height:1.7}.wa{display:block;margin-top:10px;background:#25D366;color:#06233f;text-align:center;text-decoration:none;font-weight:900;padding:12px;border-radius:12px}</style></head><body><main><section class="hero"><h1>الإرسال الفوري الآن</h1><p>القوالب الرسمية تنتظر موافقة Meta. هذه الصفحة تعطيك طريقين الآن: إعادة محاولة الإرسال الرسمي فوراً، أو فتح واتساب برسالة جاهزة للعضو بدون انتظار.</p></section><div class="actions"><form method="post" action="/club-admin/notifications/retry-pending"><button class="retry">فحص واعادة الإرسال الرسمي الآن</button></form><a class="back" href="/club-admin/notifications/history">العودة للسجل</a></div><div class="list">${cards}</div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

function polishHealth(html){
  return html.replace('</body>',`<div style="width:min(760px,92%);margin:0 auto 28px;display:grid;gap:10px"><form method="post" action="/club-admin/notifications/retry-pending"><button style="width:100%;border:0;border-radius:12px;padding:13px;background:#25D366;color:#06233f;font-weight:900">فحص واعادة الإرسال الآن</button></form><a href="/club-admin/notifications/manual-pending" style="display:block;background:#fff;color:#061a43;text-align:center;text-decoration:none;font-weight:900;padding:13px;border-radius:12px">فتح الإرسال الفوري للرسائل المعلقة</a></div></body>`);
}
function polishHistory(html){
  return html.replace('<div class="list">',`<div style="display:grid;gap:10px;margin-bottom:16px"><a href="/club-admin/notifications/manual-pending" style="display:block;background:#25D366;color:#06233f;text-align:center;text-decoration:none;font-weight:900;padding:13px;border-radius:12px">إرسال الرسائل المعلقة الآن</a></div><div class="list">`);
}
function polishCenter(html){
  return html.replace('مركز الإشعارات · V29','مركز الإشعارات · V30').replace('</main>',`<div style="width:min(820px,92%);margin:0 auto 26px"><a href="/club-admin/notifications/manual-pending" style="display:block;text-align:center;background:#25D366;color:#06233f;text-decoration:none;padding:13px;border-radius:14px;font-weight:900">الإرسال الفوري للرسائل المعلقة</a></div></main>`);
}
function fallbackMessage(n){return `إشعار من نادي ود نفيع الرياضي الثقافي الاجتماعي\n${n.member_name||''}\nرقم الطلب: ${n.application_no||''}`}
function label(v){return ({application_received:'استلام طلب',review:'بدء المراجعة','needs-info':'طلب استكمال',ready:'جاهز للاعتماد',membership_approved:'اعتماد العضوية',application_rejected:'رفض الطلب'})[v]||v||'إشعار'}
async function adminSession(req,db){if(!db)return null;const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;const t=decodeURIComponent(x[1]);try{const a=await db.prepare(`SELECT a.id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){}try{return await db.prepare(`SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first()}catch(_){return null}}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
