import { getActor } from './auth.js';
import app from './worker-global-v62.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(m==='GET'&&p==='/projects') return publicProjects(env.DB);
    if(m==='GET'&&p==='/events') return publicEvents(env.DB);
    if(m==='GET'&&p==='/sponsors') return publicSponsors(env.DB);
    if(m==='GET'&&p==='/gallery') return publicGallery(env.DB);

    if(p.startsWith('/club-admin/public')&&env.DB){
      const admin=await adminSession(req,env.DB); if(!admin)return red('/login');
      if(p==='/club-admin/public'&&m==='GET') return hub(env.DB);
      if(p==='/club-admin/public/project'&&m==='POST') return addProject(req,env.DB,admin);
      if(p==='/club-admin/public/event'&&m==='POST') return addEvent(req,env.DB,admin);
      if(p==='/club-admin/public/sponsor'&&m==='POST') return addSponsor(req,env.DB,admin);
      if(p==='/club-admin/public/gallery'&&m==='POST') return addGallery(req,env.DB,admin);
      const x=p.match(/^\/club-admin\/public\/(project|event|sponsor|gallery)\/(\d+)\/delete$/);
      if(x&&m==='POST') return del(env.DB,admin,x[1],Number(x[2]));
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(['/','/about','/activities','/contact','/news','/team','/board','/achievements'].includes(p)){
        html=html.replace('</nav>','<a href="/projects">المشروعات</a><a href="/events">الفعاليات</a><a href="/sponsors">الداعمون</a><a href="/gallery">الصور</a></nav>');
      }
      if(p==='/club-admin'){
        const block='<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928">إدارة الواجهة العامة المتقدمة</h2><p>المشروعات، الفعاليات، الداعمون ومعرض الصور.</p><a href="/club-admin/public" style="display:block;text-align:center;padding:12px;border-radius:12px;background:#d5a928;color:#061a43;text-decoration:none;font-weight:900">فتح الإدارة العامة</a></section>';
        html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v63-public-experience');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_projects(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,summary TEXT,status TEXT DEFAULT 'قيد التنفيذ',target TEXT,progress INTEGER DEFAULT 0,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_events(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,event_date TEXT,location TEXT,details TEXT,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_sponsors(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,kind TEXT DEFAULT 'داعم',url TEXT,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_gallery(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,image_url TEXT NOT NULL,caption TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}
async function adminSession(req,db){return getActor(req,db)}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function audit(db,a,action,type,id,details=''){try{await db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`).bind(a?.username||'admin',action,type,String(id||''),details).run()}catch(_){}}

async function publicProjects(db){const rows=db?await many(db,`SELECT * FROM club_projects WHERE is_published=1 ORDER BY id DESC`):[];return pub('المشروعات والمبادرات',`<section class="hero"><h1>مشروعات ومبادرات نادي ود نفيع</h1><p>ما نعمل عليه لخدمة النادي والمجتمع.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><span>${esc(x.status||'')}</span><h2>${esc(x.title)}</h2><p>${esc(x.summary||'')}</p><small>${x.progress?`نسبة الإنجاز: ${esc(x.progress)}%`:''}</small></article>`).join(''):'<article><p>سيتم نشر المشروعات والمبادرات قريبًا.</p></article>'}</section>`)}
async function publicEvents(db){const rows=db?await many(db,`SELECT * FROM club_events WHERE is_published=1 ORDER BY COALESCE(event_date,'') DESC,id DESC`):[];return pub('الفعاليات',`<section class="hero"><h1>فعاليات النادي</h1><p>المناسبات والبرامج الرياضية والثقافية والاجتماعية.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><span>${esc(x.event_date||'')}</span><h2>${esc(x.title)}</h2><p>${esc(x.details||'')}</p><small>${esc(x.location||'')}</small></article>`).join(''):'<article><p>لا توجد فعاليات منشورة حاليًا.</p></article>'}</section>`)}
async function publicSponsors(db){const rows=db?await many(db,`SELECT * FROM club_sponsors ORDER BY sort_order,id`):[];return pub('الداعمون والرعاة',`<section class="hero"><h1>الداعمون والرعاة</h1><p>شكرًا لكل من يقف مع النادي ومشروعاته.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><h2>${esc(x.name)}</h2><b>${esc(x.kind||'داعم')}</b><p>${esc(x.note||'')}</p>${x.url?`<a href="${escAttr(x.url)}" target="_blank" rel="noopener">زيارة الرابط</a>`:''}</article>`).join(''):'<article><p>سيتم تحديث قائمة الداعمين قريبًا.</p></article>'}</section>`)}
async function publicGallery(db){const rows=db?await many(db,`SELECT * FROM club_gallery ORDER BY sort_order,id DESC`):[];return pub('معرض الصور',`<section class="hero"><h1>معرض صور النادي</h1><p>لحظات من تاريخ وأنشطة نادي ود نفيع.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><img src="${escAttr(x.image_url)}" alt="${escAttr(x.title)}" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:14px"><h2>${esc(x.title)}</h2><p>${esc(x.caption||'')}</p></article>`).join(''):'<article><p>سيتم إضافة الصور قريبًا.</p></article>'}</section>`)}

async function hub(db){const [pr,ev,sp,ga]=await Promise.all([many(db,'SELECT * FROM club_projects ORDER BY id DESC LIMIT 30'),many(db,'SELECT * FROM club_events ORDER BY id DESC LIMIT 30'),many(db,'SELECT * FROM club_sponsors ORDER BY sort_order,id LIMIT 50'),many(db,'SELECT * FROM club_gallery ORDER BY id DESC LIMIT 50')]);const body=`${form('مشروع/مبادرة','/club-admin/public/project',[['title','العنوان'],['summary','الملخص'],['status','الحالة'],['target','الهدف'],['progress','نسبة الإنجاز']])}${list('المشروعات',pr,'project',x=>x.title)}${form('فعالية','/club-admin/public/event',[['title','العنوان'],['event_date','التاريخ'],['location','المكان'],['details','التفاصيل']])}${list('الفعاليات',ev,'event',x=>x.title)}${form('داعم/راعٍ','/club-admin/public/sponsor',[['name','الاسم'],['kind','النوع'],['url','الرابط'],['note','ملاحظة'],['sort_order','الترتيب']])}${list('الداعمون',sp,'sponsor',x=>x.name)}${form('صورة','/club-admin/public/gallery',[['title','العنوان'],['image_url','رابط الصورة'],['caption','الوصف'],['sort_order','الترتيب']])}${list('معرض الصور',ga,'gallery',x=>x.title)}`;return adminPage('إدارة الواجهة العامة',body)}
function form(title,action,fields){return `<section class="panel"><h2>${title}</h2><form method="post" action="${action}">${fields.map(([n,p])=>n==='summary'||n==='details'||n==='caption'||n==='note'?`<textarea name="${n}" placeholder="${p}"></textarea>`:`<input name="${n}" placeholder="${p}">`).join('')}<button>حفظ</button></form></section>`}
function list(title,rows,type,label){return `<section class="panel"><h2>${title}</h2>${rows.length?rows.map(x=>`<article><span>${esc(label(x))}</span><form method="post" action="/club-admin/public/${type}/${x.id}/delete"><button class="danger">حذف</button></form></article>`).join(''):'<p>لا توجد بيانات بعد.</p>'}</section>`}
async function addProject(req,db,a){const f=await req.formData(),title=String(f.get('title')||'').trim();if(title){const r=await db.prepare(`INSERT INTO club_projects(title,summary,status,target,progress) VALUES(?,?,?,?,?)`).bind(title,String(f.get('summary')||''),String(f.get('status')||'قيد التنفيذ'),String(f.get('target')||''),Math.max(0,Math.min(100,Number(f.get('progress')||0)))).run();await audit(db,a,'create','project',r.meta?.last_row_id,title)}return red('/club-admin/public')}
async function addEvent(req,db,a){const f=await req.formData(),title=String(f.get('title')||'').trim();if(title){const r=await db.prepare(`INSERT INTO club_events(title,event_date,location,details) VALUES(?,?,?,?)`).bind(title,String(f.get('event_date')||''),String(f.get('location')||''),String(f.get('details')||'')).run();await audit(db,a,'create','event',r.meta?.last_row_id,title)}return red('/club-admin/public')}
async function addSponsor(req,db,a){const f=await req.formData(),name=String(f.get('name')||'').trim();if(name){const r=await db.prepare(`INSERT INTO club_sponsors(name,kind,url,note,sort_order) VALUES(?,?,?,?,?)`).bind(name,String(f.get('kind')||'داعم'),String(f.get('url')||''),String(f.get('note')||''),Number(f.get('sort_order')||0)).run();await audit(db,a,'create','sponsor',r.meta?.last_row_id,name)}return red('/club-admin/public')}
async function addGallery(req,db,a){const f=await req.formData(),title=String(f.get('title')||'').trim(),url=String(f.get('image_url')||'').trim();if(title&&url){const r=await db.prepare(`INSERT INTO club_gallery(title,image_url,caption,sort_order) VALUES(?,?,?,?)`).bind(title,url,String(f.get('caption')||''),Number(f.get('sort_order')||0)).run();await audit(db,a,'create','gallery',r.meta?.last_row_id,title)}return red('/club-admin/public')}
async function del(db,a,type,id){const map={project:'club_projects',event:'club_events',sponsor:'club_sponsors',gallery:'club_gallery'};if(map[type]){await db.prepare(`DELETE FROM ${map[type]} WHERE id=?`).bind(id).run();await audit(db,a,'delete',type,id,'')}return red('/club-admin/public')}

function pub(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${publicCss()}</style></head><body><header><a href="/"><img src="${LOGO}"><b>نادي ود نفيع</b></a><nav><a href="/">الرئيسية</a><a href="/news">الأخبار</a><a href="/team">الفريق</a><a href="/board">الإدارة</a><a href="/projects">المشروعات</a><a href="/events">الفعاليات</a><a href="/gallery">الصور</a><a href="/membership">العضوية</a></nav></header><main>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=120','x-content-type-options':'nosniff'}})}
function adminPage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${adminCss()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function publicCss(){return `*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{background:#061a43;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 4%;gap:16px;position:sticky;top:0;z-index:10}header>a{display:flex;align-items:center;gap:9px;text-decoration:none;color:#f1c43d}header img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:12px;padding:3px}nav{display:flex;gap:8px;flex-wrap:wrap}nav a{color:#fff;text-decoration:none;padding:8px}main{width:min(1100px,94%);margin:28px auto}.hero{background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;padding:38px;border-radius:24px;margin-bottom:20px}.hero h1{color:#f1c43d}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.grid article{background:#fff;border:1px solid #dbe4f5;border-radius:18px;padding:18px;box-shadow:0 10px 30px #0a347c10}.grid span,.grid b{color:#0a347c}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}`}
function adminCss(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;padding:15px 5%;border-bottom:1px solid #d5a92866}header a{color:#fff}main{width:min(1000px,94%);margin:24px auto}h1,h2{color:#d5a928}.panel{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px;margin:16px 0}.panel form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.panel input,.panel textarea,.panel button{padding:11px;border-radius:11px;border:1px solid #ffffff33}.panel textarea{min-height:100px}.panel button{background:#d5a928;color:#061a43;font-weight:900;border:0}.panel article{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #ffffff20;padding:10px 0}.panel article form{display:block}.danger{background:#7a1c1c!important;color:#fff!important}@media(max-width:700px){.panel form{grid-template-columns:1fr}}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escAttr(v){return esc(v).replace(/`/g,'&#96;')}
