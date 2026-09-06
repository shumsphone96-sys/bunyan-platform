import app from './worker-global-v11.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const G='#d5a928',B='#0a347c',D='#061a43';

export default {async fetch(req,env,ctx){
  const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method;
  if(env.DB) await init(env.DB);

  if(p.startsWith('/club-admin/')){
    const a=env.DB?await admin(req,env.DB):null;
    if(!a) return red('/login');
    if(p==='/club-admin/meetings') return m==='POST'?addMeeting(req,env.DB,a):meetings(env.DB);
    if(p==='/club-admin/committees') return m==='POST'?addCommittee(req,env.DB,a):committees(env.DB);
    if(p==='/club-admin/tasks') return m==='POST'?addTask(req,env.DB,a):tasks(env.DB);
  }

  let r=await app.fetch(req,env,ctx);
  const ct=r.headers.get('content-type')||'';
  if(req.method==='GET'&&ct.includes('text/html')){
    let t=await r.text();
    if(p==='/club-admin'){
      const quick=`<section class="v12box"><h2>الإدارة التنفيذية</h2><div class="v12grid"><a href="/club-admin/meetings">🗓️ الاجتماعات والقرارات</a><a href="/club-admin/committees">👥 اللجان</a><a href="/club-admin/tasks">✅ المهام والتكليفات</a></div></section>`;
      t=t.replace('</main>',quick+'</main>');
    }
    const css=`<style>.v12box{margin:24px 0;padding:20px;border:1px solid ${G}77;border-radius:22px;background:#08265dcc}.v12box h2{margin:0 0 14px;color:${G}.v12grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.v12grid a{display:block;text-decoration:none;color:white;background:#0d3b86;border:1px solid #d5a92866;padding:16px;border-radius:16px;font-weight:800}.v12grid a:hover{background:#134899}@media(max-width:700px){.v12grid{grid-template-columns:1fr}}</style>`;
    t=t.replace('</head>',css+'</head>');
    const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v12');
    return new Response(t,{status:r.status,statusText:r.statusText,headers:h});
  }
  return r;
}};

async function init(db){for(const q of [
`CREATE TABLE IF NOT EXISTS club_meetings(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,meeting_date TEXT,location TEXT,agenda TEXT,decisions TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_committees(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,chair TEXT,members TEXT,responsibilities TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS club_tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,assigned_to TEXT,due_date TEXT,status TEXT DEFAULT 'open',notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`]){try{await db.prepare(q).run()}catch(_){}}}
async function admin(req,db){let c=req.headers.get('Cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;return db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(decodeURIComponent(x[1])).first()}
async function log(db,a,action,target){try{await db.prepare(`INSERT INTO audit_log(admin_id,username,role,action,target_type,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(a.id,a.username,a.role,action,target).run()}catch(_){}}

async function meetings(db){let r=await db.prepare('SELECT * FROM club_meetings ORDER BY id DESC LIMIT 300').all();return H(page('الاجتماعات والقرارات',form('/club-admin/meetings',[['عنوان الاجتماع','title',1],['التاريخ والوقت','meeting_date'],['المكان','location'],['جدول الأعمال','agenda'],['القرارات','decisions']],'حفظ الاجتماع')+cards(r.results,x=>`<b>${e(x.title)}</b><span>${e(x.meeting_date||'—')} · ${e(x.location||'')}</span><small>${e(x.decisions||x.agenda||'')}</small>`)))}
async function addMeeting(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_meetings(title,meeting_date,location,agenda,decisions) VALUES(?,?,?,?,?)').bind(v(f,'title'),v(f,'meeting_date'),v(f,'location'),v(f,'agenda'),v(f,'decisions')).run();await log(db,a,'add_meeting','meeting');return red('/club-admin/meetings')}

async function committees(db){let r=await db.prepare('SELECT * FROM club_committees ORDER BY id DESC LIMIT 300').all();return H(page('اللجان',form('/club-admin/committees',[['اسم اللجنة','name',1],['المسؤول','chair'],['الأعضاء','members'],['المهام والمسؤوليات','responsibilities']],'حفظ اللجنة')+cards(r.results,x=>`<b>${e(x.name)}</b><span>${e(x.chair||'—')}</span><small>${e(x.members||'')} ${e(x.responsibilities||'')}</small>`)))}
async function addCommittee(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_committees(name,chair,members,responsibilities) VALUES(?,?,?,?)').bind(v(f,'name'),v(f,'chair'),v(f,'members'),v(f,'responsibilities')).run();await log(db,a,'add_committee','committee');return red('/club-admin/committees')}

async function tasks(db){let r=await db.prepare('SELECT * FROM club_tasks ORDER BY CASE status WHEN "open" THEN 0 ELSE 1 END,id DESC LIMIT 500').all();return H(page('المهام والتكليفات',form('/club-admin/tasks',[['المهمة','title',1],['المكلف بها','assigned_to'],['تاريخ الاستحقاق','due_date'],['الحالة','status'],['ملاحظات','notes']],'حفظ المهمة')+cards(r.results,x=>`<b>${e(x.title)}</b><span>${e(x.assigned_to||'—')} · ${e(x.due_date||'')}</span><small>${e(x.status||'open')} · ${e(x.notes||'')}</small>`)))}
async function addTask(req,db,a){let f=await req.formData();await db.prepare('INSERT INTO club_tasks(title,assigned_to,due_date,status,notes) VALUES(?,?,?,?,?)').bind(v(f,'title'),v(f,'assigned_to'),v(f,'due_date'),v(f,'status')||'open',v(f,'notes')).run();await log(db,a,'add_task','task');return red('/club-admin/tasks')}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${D}"><title>${e(t)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><nav><a href="/club-admin">المركز</a><a href="/applications">العضوية</a><a href="/members">الأعضاء</a><a href="/reports">التقارير</a></nav></header><main><h1>${e(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function form(action,fields,button){return `<form class="form" method="post" action="${action}">${fields.map(([l,n,r])=>`<label>${l}<input name="${n}" ${r?'required':''}></label>`).join('')}<button>${button}</button></form>`}
function cards(a,fn){return `<div class="list">${a.length?a.map(x=>`<article>${fn(x)}</article>`).join(''):'<article>لا توجد بيانات حتى الآن.</article>'}</div>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,${D},${B});color:white;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{background:#061a43f2;border-bottom:1px solid #d5a92866;padding:14px 4%;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}header b,h1{color:${G}}nav{display:flex;gap:10px;flex-wrap:wrap}a{color:white}main{width:min(1000px,92%);margin:28px auto}.form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;background:#08265dcc;border:1px solid #d5a92866;padding:18px;border-radius:20px}.form label{display:flex;flex-direction:column;gap:7px;color:#f8dfa0;font-weight:800}.form input{padding:12px;border-radius:12px;border:1px solid #d5a92888;background:#fff;color:#111}.form button{grid-column:1/-1;padding:13px;border:0;border-radius:12px;background:${G};color:${D};font-weight:900}.list{display:grid;gap:12px;margin-top:18px}.list article{background:#0b3478;border:1px solid #d5a92866;border-radius:16px;padding:15px;display:grid;gap:6px}.list b{color:#ffd65b}.list small{opacity:.82}footer{text-align:center;padding:28px;color:#e8d49b}@media(max-width:700px){.form{grid-template-columns:1fr}}`}
function v(f,k){return String(f.get(k)||'').trim()}function e(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function H(x){return new Response(x,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'}})}function red(x){return new Response(null,{status:303,headers:{Location:x}})}
