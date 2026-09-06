import app from './worker-global-v6.js';

const ROLE_LABELS={owner:'مدير النظام',reviewer:'مراجع العضوية',approver:'معتمد العضوية'};

export default{
  async fetch(req,env,ctx){
    if(env.DB) await ensureV7(env.DB);
    const url=new URL(req.url);
    const path=url.pathname.replace(/\/$/,'')||'/';

    if(path==='/governance'){
      const admin=env.DB?await currentAdmin(req,env.DB):null;
      if(!admin) return redirect('/login');
      return html(governancePage(admin));
    }

    const stage=path.match(/^\/applications\/(\d+)\/stage\/(received|review|needs-info|ready|approve|reject)$/);
    if(stage&&req.method==='POST'&&env.DB){
      const admin=await currentAdmin(req,env.DB);
      if(!admin) return redirect('/login');
      const action=stage[2];
      if(!allowed(admin.role,action)) return html(denied(admin,action),403);
      const res=await app.fetch(req,env,ctx);
      if(res.status<400){
        try{await env.DB.prepare('INSERT INTO audit_log(admin_id,username,role,action,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)').bind(admin.id,admin.username,admin.role||'owner',action,'application',Number(stage[1])).run()}catch(_){}
      }
      return res;
    }

    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&res.headers.get('content-type')?.includes('text/html')){
      let body=await res.text();
      if(path==='/'||path==='/applications'){
        const admin=env.DB?await currentAdmin(req,env.DB):null;
        if(admin){
          const badge=`<div class="wdn-rolebar"><b>${ROLE_LABELS[admin.role]||'مدير النظام'}</b><span>الصلاحية الحالية: ${esc(admin.role||'owner')}</span><a href="/governance">حوكمة النظام</a></div>`;
          body=body.replace(/<main[^>]*>/,m=>m+badge);
          body=body.replace('</style>',`.wdn-rolebar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;border:1px solid #d5a92888;border-radius:16px;background:#08275f}.wdn-rolebar b{color:#d5a928}.wdn-rolebar span{opacity:.85}.wdn-rolebar a{margin-inline-start:auto;color:#d5a928;font-weight:800;text-decoration:none}@media(max-width:640px){.wdn-rolebar a{margin-inline-start:0;width:100%}}</style>`);
        }
      }
      return new Response(body,{status:res.status,headers:cloneHeaders(res.headers)});
    }
    return res;
  }
};

async function ensureV7(db){
  try{await db.prepare("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'owner'").run()}catch(_){}
  try{await db.prepare("UPDATE admins SET role='owner' WHERE role IS NULL OR role='' ").run()}catch(_){}
  try{await db.prepare(`CREATE TABLE IF NOT EXISTS audit_log(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    username TEXT,
    role TEXT,
    action TEXT,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run()}catch(_){}
}

async function currentAdmin(req,db){
  const cookie=req.headers.get('Cookie')||'';
  const m=cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if(!m)return null;
  return db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(decodeURIComponent(m[1])).first();
}

function allowed(role,action){
  role=role||'owner';
  if(role==='owner')return true;
  if(role==='reviewer')return ['received','review','needs-info','ready'].includes(action);
  if(role==='approver')return ['approve','reject'].includes(action);
  return false;
}

function governancePage(admin){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>حوكمة نظام نادي ود نفيع</title><style>${css()}</style></head><body><main><div class="hero"><div class="wdn">WDN</div><h1>حوكمة نظام نادي ود نفيع</h1><p>نظام الصلاحيات المعتمد لإدارة العضوية باحتراف ومنع تضارب المهام.</p></div><div class="cards"><section><h2>مدير النظام</h2><p>صلاحية شاملة لإدارة النظام والطوارئ والإشراف العام.</p><b>حسابك الحالي: ${esc(admin.username)}</b></section><section><h2>مراجع العضوية</h2><p>يراجع البيانات، يطلب الاستكمال، ويجهز الطلب للاعتماد. لا يصدر العضوية النهائية.</p></section><section><h2>معتمد العضوية</h2><p>يتخذ قرار الاعتماد النهائي أو الرفض بعد اكتمال المراجعة.</p></section></div><div class="rule"><b>المسار الرسمي:</b><br>المتقدم يرسل الطلب ← المراجع يدقق ويستكمل ← المعتمد يصدر القرار ← النظام يسجل كل خطوة بالاسم والوقت.</div><a class="btn" href="/applications">العودة إلى طلبات العضوية</a></main></body></html>`}

function denied(admin,action){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css()}</style></head><body><main><div class="hero"><h1>هذه العملية خارج صلاحيتك</h1><p>دورك الحالي: ${ROLE_LABELS[admin.role]||esc(admin.role)}.</p></div><a class="btn" href="/applications">العودة</a></main></body></html>`}
function css(){return `:root{--b:#0a347c;--d:#061a43;--g:#d5a928}*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,var(--d),var(--b));color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}main{width:min(1000px,92%);margin:auto;padding:38px 0}.hero,.rule,section{background:#08275f;border:1px solid #d5a92877;border-radius:22px;padding:22px}.hero{text-align:center}.wdn{display:inline-grid;place-items:center;width:72px;height:72px;border-radius:50%;background:var(--g);color:var(--d);font-weight:1000;font-size:22px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0}.cards h2{color:var(--g);margin-top:0}.rule{line-height:2;margin-bottom:18px}.btn{display:inline-block;background:var(--g);color:var(--d);padding:13px 18px;border-radius:14px;text-decoration:none;font-weight:900}@media(max-width:760px){.cards{grid-template-columns:1fr}}`}
function html(body,status=200){return new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'}})}
function redirect(to){return new Response(null,{status:303,headers:{Location:to}})}
function esc(v){return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function cloneHeaders(h){const n=new Headers(h);n.set('x-content-type-options','nosniff');n.set('x-frame-options','DENY');return n}
