import { getActor } from './auth.js';
import app from './worker-global-v61.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(m==='GET'&&p==='/news') return publicNews(env.DB);
    if(m==='GET'&&p==='/team') return publicTeam(env.DB);
    if(m==='GET'&&p==='/board') return publicBoard(env.DB);
    if(m==='GET'&&p==='/achievements') return publicAchievements(env.DB);

    if(p.startsWith('/club-admin/content')&&env.DB){
      const admin=await adminSession(req,env.DB); if(!admin)return red('/login');
      if(p==='/club-admin/content'&&m==='GET') return contentHub(env.DB);
      if(p==='/club-admin/content/news'&&m==='POST') return addNews(req,env.DB,admin);
      if(p==='/club-admin/content/team'&&m==='POST') return addTeam(req,env.DB,admin);
      if(p==='/club-admin/content/board'&&m==='POST') return addBoard(req,env.DB,admin);
      if(p==='/club-admin/content/achievement'&&m==='POST') return addAchievement(req,env.DB,admin);
      const x=p.match(/^\/club-admin\/content\/(news|team|board|achievement)\/(\d+)\/delete$/);
      if(x&&m==='POST') return del(env.DB,admin,x[1],Number(x[2]));
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(['/','/about','/activities','/contact'].includes(p)){
        html=html.replace('</nav>','<a href="/news">الأخبار</a><a href="/team">الفريق</a><a href="/board">الإدارة</a><a href="/achievements">الإنجازات</a></nav>');
      }
      if(p==='/club-admin'){
        const block='<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928">إدارة الموقع العام</h2><p>الأخبار، الفريق، مجلس الإدارة والإنجازات من لوحة واحدة.</p><a href="/club-admin/content" style="display:block;text-align:center;padding:12px;border-radius:12px;background:#d5a928;color:#061a43;text-decoration:none;font-weight:900">فتح إدارة المحتوى</a></section>';
        html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v62-public-cms');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT,category TEXT DEFAULT 'عام',is_published INTEGER NOT NULL DEFAULT 1,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_team(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,role TEXT,number TEXT,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_board(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,position TEXT NOT NULL,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_achievements(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,achievement_date TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
  const cols=new Set((await db.prepare('PRAGMA table_info(club_news)').all()).results.map(x=>x.name));
  if(!cols.has('is_published')) {
    await db.prepare('ALTER TABLE club_news ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0').run();
    if(cols.has('status')) await db.prepare("UPDATE club_news SET is_published=1 WHERE status IN ('published','منشور')").run();
  }
  for(const [col,kind] of [['category',"TEXT DEFAULT 'عام'"],['created_by','TEXT'],['status',"TEXT DEFAULT 'draft'"]]) {
    if(!cols.has(col)) await db.prepare(`ALTER TABLE club_news ADD COLUMN ${col} ${kind}`).run();
  }

}
async function adminSession(req,db){return getActor(req,db)}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function audit(db,a,action,type,id,details=''){try{await db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`).bind(a?.username||'admin',action,type,String(id||''),details).run()}catch(_){}}

async function publicNews(db){const rows=db?await many(db,`SELECT * FROM club_news WHERE is_published=1 ORDER BY id DESC LIMIT 50`):[];return pub('الأخبار',`<section class="hero"><h1>أخبار نادي ود نفيع</h1><p>آخر أخبار النادي وإعلاناته الرسمية.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><span>${esc(x.category||'عام')}</span><h2>${esc(x.title)}</h2><p>${esc(x.body||'')}</p><small>${esc(x.created_at||'')}</small></article>`).join(''):'<article><h2>قريبًا</h2><p>سيتم نشر أخبار النادي هنا.</p></article>'}</section>`)}
async function publicTeam(db){const rows=db?await many(db,`SELECT * FROM club_team ORDER BY sort_order ASC,id ASC`):[];return pub('الفريق',`<section class="hero"><h1>فريق نادي ود نفيع</h1><p>اللاعبون والجهاز الفني.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><h2>${esc(x.name)}</h2><b>${esc(x.role||'لاعب')}</b><p>${x.number?'الرقم: '+esc(x.number):''}</p><small>${esc(x.note||'')}</small></article>`).join(''):'<article><p>سيتم تحديث قائمة الفريق قريبًا.</p></article>'}</section>`)}
async function publicBoard(db){const rows=db?await many(db,`SELECT * FROM club_board ORDER BY sort_order ASC,id ASC`):[];return pub('مجلس الإدارة',`<section class="hero"><h1>مجلس إدارة نادي ود نفيع</h1><p>الإدارة المعتمدة للنادي.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><h2>${esc(x.name)}</h2><b>${esc(x.position)}</b><p>${esc(x.note||'')}</p></article>`).join(''):'<article><p>سيتم تحديث بيانات مجلس الإدارة قريبًا.</p></article>'}</section>`)}
async function publicAchievements(db){const rows=db?await many(db,`SELECT * FROM club_achievements ORDER BY COALESCE(achievement_date,'') DESC,id DESC`):[];return pub('الإنجازات',`<section class="hero"><h1>إنجازات وتاريخ النادي</h1><p>محطات نفتخر بها منذ تأسيس النادي.</p></section><section class="grid">${rows.length?rows.map(x=>`<article><span>${esc(x.achievement_date||'')}</span><h2>${esc(x.title)}</h2><p>${esc(x.details||'')}</p></article>`).join(''):'<article><p>نعمل على توثيق إنجازات النادي وتاريخه.</p></article>'}</section>`)}

async function contentHub(db){
  const [news,team,board,ach]=await Promise.all([many(db,'SELECT * FROM club_news ORDER BY id DESC LIMIT 20'),many(db,'SELECT * FROM club_team ORDER BY sort_order,id'),many(db,'SELECT * FROM club_board ORDER BY sort_order,id'),many(db,'SELECT * FROM club_achievements ORDER BY id DESC LIMIT 20')]);
  const body=`${form('خبر جديد','/club-admin/content/news',[['title','عنوان الخبر'],['category','التصنيف'],['body','نص الخبر']])}${list('الأخبار',news,'news',x=>x.title)}${form('إضافة لاعب/جهاز فني','/club-admin/content/team',[['name','الاسم'],['role','الصفة'],['number','الرقم'],['note','ملاحظة'],['sort_order','الترتيب']])}${list('الفريق',team,'team',x=>x.name+' — '+(x.role||''))}${form('إضافة عضو مجلس إدارة','/club-admin/content/board',[['name','الاسم'],['position','المنصب'],['note','ملاحظة'],['sort_order','الترتيب']])}${list('مجلس الإدارة',board,'board',x=>x.name+' — '+x.position)}${form('إضافة إنجاز','/club-admin/content/achievement',[['title','عنوان الإنجاز'],['achievement_date','التاريخ'],['details','التفاصيل']])}${list('الإنجازات',ach,'achievement',x=>x.title)}`;
  return adminPage('إدارة محتوى الموقع',body);
}
function form(title,action,fields){return `<section class="panel"><h2>${title}</h2><form method="post" action="${action}">${fields.map(([n,p])=>n==='body'||n==='details'?`<textarea name="${n}" placeholder="${p}"></textarea>`:`<input name="${n}" placeholder="${p}">`).join('')}<button>حفظ</button></form></section>`}
function list(title,rows,type,label){return `<section class="panel"><h2>${title}</h2>${rows.length?rows.map(x=>`<article><span>${esc(label(x))}</span><form method="post" action="/club-admin/content/${type}/${x.id}/delete"><button class="danger">حذف</button></form></article>`).join(''):'<p>لا توجد بيانات بعد.</p>'}</section>`}
async function addNews(req,db,a){const f=await req.formData(),title=String(f.get('title')||'').trim();if(title){const r=await db.prepare(`INSERT INTO club_news(title,body,category,created_by) VALUES(?,?,?,?)`).bind(title,String(f.get('body')||''),String(f.get('category')||'عام'),a.username||'admin').run();await audit(db,a,'create','news',r.meta?.last_row_id,title)}return red('/club-admin/content')}
async function addTeam(req,db,a){const f=await req.formData(),name=String(f.get('name')||'').trim();if(name){const r=await db.prepare(`INSERT INTO club_team(name,role,number,note,sort_order) VALUES(?,?,?,?,?)`).bind(name,String(f.get('role')||''),String(f.get('number')||''),String(f.get('note')||''),Number(f.get('sort_order')||0)).run();await audit(db,a,'create','team',r.meta?.last_row_id,name)}return red('/club-admin/content')}
async function addBoard(req,db,a){const f=await req.formData(),name=String(f.get('name')||'').trim(),pos=String(f.get('position')||'').trim();if(name&&pos){const r=await db.prepare(`INSERT INTO club_board(name,position,note,sort_order) VALUES(?,?,?,?)`).bind(name,pos,String(f.get('note')||''),Number(f.get('sort_order')||0)).run();await audit(db,a,'create','board',r.meta?.last_row_id,name)}return red('/club-admin/content')}
async function addAchievement(req,db,a){const f=await req.formData(),title=String(f.get('title')||'').trim();if(title){const r=await db.prepare(`INSERT INTO club_achievements(title,achievement_date,details) VALUES(?,?,?)`).bind(title,String(f.get('achievement_date')||''),String(f.get('details')||'')).run();await audit(db,a,'create','achievement',r.meta?.last_row_id,title)}return red('/club-admin/content')}
async function del(db,a,type,id){const map={news:'club_news',team:'club_team',board:'club_board',achievement:'club_achievements'};if(map[type]){await db.prepare(`DELETE FROM ${map[type]} WHERE id=?`).bind(id).run();await audit(db,a,'delete',type,id,'')}return red('/club-admin/content')}

function pub(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${publicCss()}</style></head><body><header><a href="/"><img src="${LOGO}"><b>نادي ود نفيع</b></a><nav><a href="/">الرئيسية</a><a href="/news">الأخبار</a><a href="/team">الفريق</a><a href="/board">الإدارة</a><a href="/achievements">الإنجازات</a><a href="/membership">العضوية</a></nav></header><main>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=120'}})}
function adminPage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${adminCss()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${title}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function publicCss(){return `*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{background:#061a43;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 4%;gap:16px;position:sticky;top:0}header>a{display:flex;align-items:center;gap:9px;text-decoration:none;color:#f1c43d}header img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:12px;padding:3px}nav{display:flex;gap:8px;flex-wrap:wrap}nav a{color:#fff;text-decoration:none;padding:8px}main{width:min(1100px,94%);margin:28px auto}.hero{background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;padding:38px;border-radius:28px}.hero h1{color:#f1c43d}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}.grid article{background:#fff;border:1px solid #d8e1f2;border-radius:20px;padding:20px;box-shadow:0 8px 30px #071b4220}.grid h2{color:#0a347c}.grid span{color:#a57900;font-weight:800}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}`}
function adminCss(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(1000px,94%);margin:24px auto}.panel{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px;margin:16px 0}.panel form{display:grid;gap:10px}.panel input,.panel textarea{padding:12px;border-radius:10px;border:1px solid #ffffff33}.panel textarea{min-height:110px}.panel button{background:#d5a928;color:#061a43;border:0;padding:11px;border-radius:10px;font-weight:900}.panel article{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #ffffff20}.danger{background:#fff!important;color:#8b1111!important}`}
function red(x){return new Response(null,{status:303,headers:{Location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
