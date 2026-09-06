import app from './worker-global-v8.js';

const C='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const G='#d5a928',B='#0a347c',D='#061a43';

export default {async fetch(req,env,ctx){
  if(env.DB) await init(env.DB);
  const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method;
  if(p.startsWith('/club-admin')){
    const a=env.DB?await admin(req,env.DB):null;
    if(!a) return red('/login');
    if(p==='/club-admin') return dash(env.DB,a);
    if(p==='/club-admin/players') return m==='POST'?addPlayer(req,env.DB,a):players(env.DB,a);
    if(p==='/club-admin/assets') return m==='POST'?addAsset(req,env.DB,a):assets(env.DB,a);
    if(p==='/club-admin/documents') return m==='POST'?addDoc(req,env.DB,a):docs(env.DB,a);
    if(p==='/club-admin/activities') return m==='POST'?addActivity(req,env.DB,a):activities(env.DB,a);
    if(p==='/club-admin/finance') return m==='POST'?addFinance(req,env.DB,a):finance(env.DB,a);
    if(p==='/club-admin/news') return m==='POST'?addNews(req,env.DB,a):news(env.DB,a);
    if(p==='/club-admin/audit') return audit(env.DB,a);
  }
  let r=await app.fetch(req,env,ctx);
  if(m==='GET'&&r.headers.get('content-type')?.includes('text/html')){
    let t=await r.text();
    if(p==='/'||p==='/applications'||p==='/members'||p==='/reports'){
      t=t.replace('</style>',`.wdn-center{display:inline-block;margin:8px 0 16px;background:${G};color:${D};padding:11px 15px;border-radius:12px;text-decoration:none;font-weight:900}</style>`);
      t=t.replace(/<main[^>]*>/,x=>x+`<a class="wdn-center" href="/club-admin">مركز إدارة النادي</a>`);
    }
    return new Response(t,{status:r.status,headers:copy(r.headers)});
  }
  return r;
}};

async function init(db){for(const q of [
`CREATE TABLE IF NOT EXISTS club_players(id INTEGER PRIMARY KEY AUTOINCREMENT,full_name TEXT,position TEXT,phone TEXT,status TEXT DEFAULT 'active',notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_assets(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,category TEXT,quantity REAL DEFAULT 1,condition TEXT,location TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_documents(id INTEGER PRIMARY KEY AUTOINCREMENT,doc_no TEXT,title TEXT,doc_type TEXT,doc_date TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_activities(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,activity_type TEXT,event_date TEXT,location TEXT,status TEXT DEFAULT 'planned',notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_finance(id INTEGER PRIMARY KEY AUTOINCREMENT,entry_type TEXT,category TEXT,amount REAL,reference_no TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,body TEXT,status TEXT DEFAULT 'draft',created_at TEXT DEFAULT CURRENT_TIMESTAMP)`]){try{await db.prepare(q).run()}catch(_){}}}
async function admin(req,db){let c=req.headers.get('Cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;return db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(decodeURIComponent(x[1])).first()}
async function log(db,a,action,target='club'){try{await db.prepare(`INSERT INTO audit_log(admin_id,username,role,action,target_type,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(a.id,a.username,a.role,action,target).run()}catch(_){}}

async function dash(db,a){let [pl,as,dc,ac,fi,nw]=await Promise.all([count(db,'club_players'),count(db,'club_assets'),count(db,'club_documents'),count(db,'club_activities'),sum(db),count(db,'club_news')]);return H(page('مركز إدارة النادي',`<section class="hero"><h1>مركز إدارة نادي ود نفيع</h1><p>إدارة النادي من مكان واحد: رياضة، أصول، وثائق، نشاط، مال، إعلام، ورقابة.</p></section><div class="stats">${st('اللاعبون',pl)}${st('الأصول',as)}${st('الوثائق',dc)}${st('الأنشطة',ac)}${st('صافي الحركة المالية',money(fi))}${st('الأخبار',nw)}</div><div class="grid">${tile('/club-admin/players','اللاعبون والجهاز الفني','سجل الفريق والبيانات الأساسية')}${tile('/club-admin/assets','أصول النادي','العهد والمعدات والممتلكات')}${tile('/club-admin/documents','الوثائق','القرارات والمحاضر والخطابات')}${tile('/club-admin/activities','الأنشطة','الرياضي والثقافي والاجتماعي')}${tile('/club-admin/finance','المالية','إيرادات ومصروفات ومستندات')}${tile('/club-admin/news','الإعلام والأخبار','أرشيف الأخبار والمنشورات')}${tile('/club-admin/audit','سجل التدقيق','من فعل ماذا ومتى')}</div>`))}

async function players(db,a){let r=await db.prepare('SELECT * FROM club_players ORDER BY id DESC LIMIT 500').all();return H(page('اللاعبون والجهاز الفني',form('/club-admin/players',[['الاسم الكامل','full_name',1],['المركز/الصفة','position'],['الهاتف','phone'],['ملاحظات','notes']],'إضافة للسجل')+cards(r.results,x=>`<b>${e(x.full_name)}</b><span>${e(x.position||'—')}</span><small>${e(x.phone||'')}</small>`)))}
async function addPlayer(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_players(full_name,position,phone,notes) VALUES(?,?,?,?)').bind(v(f,'full_name'),v(f,'position'),v(f,'phone'),v(f,'notes')).run();await log(db,a,'add_player','player');return red('/club-admin/players')}

async function assets(db,a){let r=await db.prepare('SELECT * FROM club_assets ORDER BY id DESC LIMIT 500').all();return H(page('أصول النادي',form('/club-admin/assets',[['اسم الأصل','name',1],['الفئة','category'],['الكمية','quantity'],['الحالة','condition'],['الموقع','location'],['ملاحظات','notes']],'إضافة أصل')+cards(r.results,x=>`<b>${e(x.name)}</b><span>${e(x.category||'—')} · الكمية ${e(x.quantity)}</span><small>${e(x.condition||'')}</small>`)))}
async function addAsset(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_assets(name,category,quantity,condition,location,notes) VALUES(?,?,?,?,?,?)').bind(v(f,'name'),v(f,'category'),Number(v(f,'quantity')||1),v(f,'condition'),v(f,'location'),v(f,'notes')).run();await log(db,a,'add_asset','asset');return red('/club-admin/assets')}

async function docs(db,a){let r=await db.prepare('SELECT * FROM club_documents ORDER BY id DESC LIMIT 500').all();return H(page('الوثائق الرسمية',form('/club-admin/documents',[['رقم المستند','doc_no'],['العنوان','title',1],['النوع','doc_type'],['التاريخ','doc_date'],['ملاحظات','notes']],'حفظ المستند')+cards(r.results,x=>`<b>${e(x.title)}</b><span>${e(x.doc_type||'—')} · ${e(x.doc_no||'بدون رقم')}</span><small>${e(x.doc_date||'')}</small>`)))}
async function addDoc(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_documents(doc_no,title,doc_type,doc_date,notes) VALUES(?,?,?,?,?)').bind(v(f,'doc_no'),v(f,'title'),v(f,'doc_type'),v(f,'doc_date'),v(f,'notes')).run();await log(db,a,'add_document','document');return red('/club-admin/documents')}

async function activities(db,a){let r=await db.prepare('SELECT * FROM club_activities ORDER BY id DESC LIMIT 500').all();return H(page('الأنشطة والفعاليات',form('/club-admin/activities',[['اسم النشاط','title',1],['النوع','activity_type'],['التاريخ','event_date'],['المكان','location'],['ملاحظات','notes']],'إضافة نشاط')+cards(r.results,x=>`<b>${e(x.title)}</b><span>${e(x.activity_type||'—')} · ${e(x.event_date||'')}</span><small>${e(x.location||'')}</small>`)))}
async function addActivity(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_activities(title,activity_type,event_date,location,notes) VALUES(?,?,?,?,?)').bind(v(f,'title'),v(f,'activity_type'),v(f,'event_date'),v(f,'location'),v(f,'notes')).run();await log(db,a,'add_activity','activity');return red('/club-admin/activities')}

async function finance(db,a){let r=await db.prepare('SELECT * FROM club_finance ORDER BY id DESC LIMIT 500').all();return H(page('المالية',`<div class="two">${form('/club-admin/finance',[['نوع الحركة (إيراد/مصروف)','entry_type',1],['البند','category',1],['المبلغ','amount',1],['رقم المستند','reference_no'],['ملاحظات','notes']],'حفظ الحركة')}</div>`+cards(r.results,x=>`<b>${e(x.entry_type)} — ${money(x.amount)}</b><span>${e(x.category)}</span><small>${e(x.reference_no||'')}</small>`)))}
async function addFinance(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_finance(entry_type,category,amount,reference_no,notes) VALUES(?,?,?,?,?)').bind(v(f,'entry_type'),v(f,'category'),Number(v(f,'amount')||0),v(f,'reference_no'),v(f,'notes')).run();await log(db,a,'add_finance','finance');return red('/club-admin/finance')}

async function news(db,a){let r=await db.prepare('SELECT * FROM club_news ORDER BY id DESC LIMIT 300').all();return H(page('الإعلام والأخبار',`<form class="form" method="post" action="/club-admin/news"><label>العنوان<input name="title" required></label><label>النص<textarea name="body" rows="6" required></textarea></label><label>الحالة<input name="status" value="draft" placeholder="مسودة / منشور"></label><button>حفظ الخبر</button></form>`+cards(r.results,x=>`<b>${e(x.title)}</b><span>${e(x.status)}</span><small>${e(x.body).slice(0,120)}</small>`)))}
async function addNews(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_news(title,body,status) VALUES(?,?,?)').bind(v(f,'title'),v(f,'body'),v(f,'status')||'draft').run();await log(db,a,'add_news','news');return red('/club-admin/news')}

async function audit(db,a){let r;try{r=await db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500').all()}catch(_){r={results:[]}}return H(page('سجل التدقيق',cards(r.results,x=>`<b>${e(x.username||'النظام')} · ${e(x.action)}</b><span>${e(x.target_type||'')}</span><small>${e(x.created_at||'')}</small>`)))}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)} · ${C}</title><style>${css()}</style></head><body><header><b>${C}</b><nav><a href="/club-admin">المركز</a><a href="/applications">العضوية</a><a href="/members">الأعضاء</a><a href="/reports">التقارير</a><a href="/">الرئيسية</a></nav></header><main><div class="title"><h1>${e(t)}</h1></div>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function form(action,fields,button){return `<form class="form" method="post" action="${action}">${fields.map(([l,n,r])=>`<label>${l}<input name="${n}" ${r?'required':''}></label>`).join('')}<button>${button}</button></form>`}
function cards(a,fn){return `<div class="list">${a.length?a.map(x=>`<article>${fn(x)}</article>`).join(''):'<article>لا توجد بيانات حتى الآن.</article>'}</div>`}
function tile(h,t,d){return `<a class="tile" href="${h}"><h2>${t}</h2><p>${d}</p></a>`}
function st(t,n){return `<div class="stat"><b>${e(n)}</b><span>${t}</span></div>`}
async function count(db,t){let x=await db.prepare(`SELECT COUNT(*) n FROM ${t}`).first();return Number(x?.n||0)}
async function sum(db){let x=await db.prepare(`SELECT COALESCE(SUM(CASE WHEN lower(entry_type) LIKE '%إيراد%' OR lower(entry_type)='income' THEN amount ELSE -amount END),0) n FROM club_finance`).first();return Number(x?.n||0)}
function money(n){return new Intl.NumberFormat('ar-SD',{maximumFractionDigits:2}).format(Number(n||0))}
function v(f,k){return String(f.get(k)||'').trim()}
function e(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function H(x){return new Response(x,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'}})}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function copy(h){let n=new Headers(h);n.set('x-content-type-options','nosniff');n.set('x-frame-options','DENY');return n}
function css(){return `:root{--b:${B};--d:${D};--g:${G}}*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,var(--d),var(--b));color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{position:sticky;top:0;z-index:5;background:#061a43f2;border-bottom:1px solid #d5a92855;padding:14px 4%;display:flex;gap:18px;align-items:center;flex-wrap:wrap}header b{color:var(--g)}nav{display:flex;gap:12px;flex-wrap:wrap}nav a{color:#fff;text-decoration:none;font-weight:700}main{width:min(1180px,94%);margin:auto;padding:28px 0}.hero,.form,.tile,.stat,article{background:#08275f;border:1px solid #d5a92866;border-radius:20px}.hero{padding:24px;margin-bottom:18px}.hero h1,.title h1{color:var(--g)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tile{display:block;padding:20px;text-decoration:none;color:#fff}.tile h2{color:var(--g);margin-top:0}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:18px 0}.stat{padding:16px;text-align:center}.stat b{display:block;color:var(--g);font-size:24px}.stat span{font-size:13px;opacity:.85}.form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:18px;margin-bottom:16px}.form label{display:grid;gap:6px;font-weight:700}.form input,.form textarea{width:100%;padding:12px;border-radius:12px;border:1px solid #d5a92888;background:#061a43;color:#fff;font:inherit}.form button{background:var(--g);color:var(--d);border:0;border-radius:12px;padding:13px 16px;font-weight:900}.list{display:grid;gap:10px}article{padding:16px;display:grid;gap:5px}article b{color:var(--g)}article small{opacity:.75}footer{text-align:center;padding:28px;opacity:.75}@media(max-width:850px){.grid{grid-template-columns:1fr 1fr}.stats{grid-template-columns:1fr 1fr 1fr}}@media(max-width:600px){.grid,.form{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}header{position:static}.title h1{font-size:26px}}`}
