import {CLUB,LOGO,esc,page} from './site-ui.js';

export const PUBLIC_SCHEMA_SQL=[
 "CREATE TABLE IF NOT EXISTS club_news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT,category TEXT DEFAULT 'عام',is_published INTEGER NOT NULL DEFAULT 1,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_team(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,role TEXT,number TEXT,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_board(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,position TEXT NOT NULL,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_achievements(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,achievement_date TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_projects(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,summary TEXT,status TEXT DEFAULT 'قيد التنفيذ',target TEXT,progress INTEGER DEFAULT 0,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_events(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,event_date TEXT,location TEXT,details TEXT,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_sponsors(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,kind TEXT DEFAULT 'داعم',url TEXT,note TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
 "CREATE TABLE IF NOT EXISTS club_gallery(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,image_url TEXT NOT NULL,caption TEXT,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
];
const schemaReady=new WeakMap();
export async function ensurePublicSchema(db){
 if(!db)return;
 let pending=schemaReady.get(db);
 if(!pending){
  pending=(async()=>{for(const sql of PUBLIC_SCHEMA_SQL)await db.prepare(sql).run()})();
  schemaReady.set(db,pending);
 }
 try{await pending}catch(err){schemaReady.delete(db);throw err}
}
// Public routes only create missing public CMS tables. Existing legacy tables are read through compatibility queries; member/account tables are never touched here.
export const PUBLIC_PATHS=['/','/about','/activities','/contact','/news','/team','/board','/achievements','/projects','/events','/sponsors','/gallery','/history','/identity'];
export async function publicSite(req,env){
 const path=new URL(req.url).pathname.replace(/\/$/,'')||'/';
 if(req.method!=='GET'||!PUBLIC_PATHS.includes(path))return null;
 try{await ensurePublicSchema(env.DB)}catch{return page('الخدمة غير متاحة','تعذر تجهيز بيانات الموقع الآن. أعد المحاولة بعد قليل.','<div class="wdn-wrap"><div class="wdn-empty" role="alert"><h1>تعذر تجهيز الموقع</h1><p>أعد المحاولة بعد قليل.</p></div></div>',path,503)}
 if(path==='/')return home(env.DB);
 if(collections[path])return collection(path,env.DB);
 const [title,description,body]=staticPages[path];
 return page(title,description,heading(title,description)+'<div class="wdn-wrap">'+body+'</div>',path);
}
export function safeUrl(value){try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function heading(t,d){return '<section class="wdn-pagehead"><div class="wdn-breadcrumb"><a href="/">الرئيسية</a> / '+esc(t)+'</div><h1>'+esc(t)+'</h1><p>'+esc(d)+'</p></section>'}
function card(t,b,l=''){return '<article class="wdn-card">'+(l?'<span class="wdn-label">'+esc(l)+'</span>':'')+'<h3>'+esc(t)+'</h3><p>'+esc(b)+'</p></article>'}
function empty(message){return '<div class="wdn-empty"><p>'+esc(message)+'</p></div>'}
async function read(db,sql){
 if(!db)return {rows:[],failed:true,reason:'db-unbound'};
 try{const r=await db.prepare(sql).all();return {rows:r.results||[],failed:false,reason:''}}catch(err){
  const message=String(err?.message||err||'');
  let reason=/no such table/i.test(message)?'missing-table':/no such column/i.test(message)?'missing-column':'db-error';
  if(reason==='missing-column'){
   const match=message.match(/no such column:\s*(?:\w+\.)?([A-Za-z_][A-Za-z0-9_]*)/i);
   const column=match?.[1]||'';
   const allowed=new Set(['id','title','body','category','created_at','is_published','name','role','number','note','sort_order','position','details','achievement_date','summary','status','progress','event_date','location','kind','url','image_url','caption']);
   if(allowed.has(column))reason+='-'+column;
  }
  return {rows:[],failed:true,reason};
 }
}
async function readNews(db,limit=50){
 const n=Math.max(1,Math.min(50,Number(limit)||50));
 const modern=await read(db,`SELECT title,body,category,created_at FROM club_news WHERE is_published=1 ORDER BY id DESC LIMIT ${n}`);
 if(!modern.failed||!String(modern.reason).startsWith('missing-column-'))return modern;
 // V9 created club_news with status instead of category/is_published. Read that
 // legacy shape without changing production data; only explicitly published rows
 // are surfaced. The prepared migration upgrades the schema after backup/restore.
 return read(db,`SELECT title,body,'عام' AS category,created_at FROM club_news WHERE lower(trim(COALESCE(status,''))) IN ('published','active','approved') OR trim(COALESCE(status,'')) IN ('منشور','نشر') ORDER BY id DESC LIMIT ${n}`);
}
const services='<section class="wdn-services" aria-label="خدمات العضوية"><a class="wdn-service" href="/membership"><small>01 · انضم إلينا</small><strong>طلب عضوية جديدة ←</strong><span>قدّم بياناتك واحفظ رقم الطلب للمتابعة.</span></a><a class="wdn-service" href="/membership/track"><small>02 · تابع طلبك</small><strong>حالة طلب العضوية ←</strong><span>راجع مرحلة طلبك بالرقم والهاتف المسجل.</span></a><a class="wdn-service" href="/membership/payment"><small>03 · استكمل الإجراءات</small><strong>إشعار دفع أو مستند ←</strong><span>أرسل الإثبات لمراجعته من الحساب المختص.</span></a></section>';
const areas='<div class="wdn-grid">'+card('الرياضة','رعاية المواهب والتدريب والمنافسات، وبناء بيئة تجمع الشباب حول الانضباط والعمل الجماعي.','01')+card('الثقافة','لقاءات وبرامج معرفية تفتح المجال للحوار وتبادل الخبرات والتواصل بين الأجيال.','02')+card('المجتمع','مبادرات وتطوع ومشاركة أهلية لخدمة الحي، بمساهمة أبناء ود نفيع في الداخل والخارج.','03')+'</div>';
async function home(db){
 const [news,projects]=await Promise.all([
  readNews(db,3),
  read(db,'SELECT title,summary,status FROM club_projects WHERE is_published=1 ORDER BY id DESC LIMIT 3')
 ]);
 const section=(t,p,data,render)=>data.rows.length?'<section class="wdn-section"><div class="wdn-section-head"><h2>'+t+'</h2><a href="'+p+'">عرض الكل ←</a></div><div class="wdn-grid">'+data.rows.map(render).join('')+'</div></section>':'';
 const body='<section class="wdn-hero"><div class="wdn-hero-inner"><div><span class="wdn-eyebrow">منذ 1964 · من قلب ود نفيع</span><h1>نادي ود نفيع<span>رياضة تجمعنا.<br>ومجتمع نبنيه معاً.</span></h1><p>مساحة لأبناء الحي ومحبيه؛ نرعى المواهب، نلتقي حول المعرفة، ونعمل معاً لخدمة مجتمعنا.</p><div class="wdn-actions"><a class="wdn-button" href="/membership">انضم لعضوية النادي</a><a class="wdn-button secondary" href="/about">تعرّف على النادي</a></div></div><div class="wdn-hero-art"><img src="'+LOGO+'" width="220" height="220" alt="شعار نادي ود نفيع"><small>انتماء · مشاركة · مسؤولية</small></div></div></section><div class="wdn-wrap">'+services+'<section class="wdn-section"><div class="wdn-section-head"><h2>مساحة لكل مشاركة</h2><a href="/activities">أنشطة النادي ←</a></div>'+areas+'</section>'+section('آخر الأخبار','/news',news,x=>card(x.title,short(x.body),x.category||'أخبار النادي'))+section('المشروعات والمبادرات','/projects',projects,x=>card(x.title,short(x.summary),x.status||''))+(news.failed||projects.failed?'<p class="wdn-note" role="status">تعذر تحميل بعض المستجدات الآن. يمكنك إعادة المحاولة لاحقاً.</p>':'')+'<section class="wdn-band"><div><span class="wdn-label">ذاكرة النادي</span><h2>تاريخ نحفظه للأجيال</h2><p>تعرّف على مسيرة النادي وهويته، وشاركنا ما لديك من صور أو وثائق موثقة.</p></div><a class="wdn-button" href="/history">تاريخ النادي ←</a></section></div>';
 return page('الرئيسية',CLUB+' · تأسس عام 1964. الأنشطة والأخبار وخدمات العضوية الإلكترونية.',body);
}
function short(v){const s=String(v||'').trim();return s.length>180?s.slice(0,180)+'…':s}
const collections={
 '/news':['الأخبار','أخبار النادي وإعلاناته المنشورة.','SELECT title,body,category,created_at FROM club_news WHERE is_published=1 ORDER BY id DESC LIMIT 50',x=>card(x.title,x.body,x.category||'أخبار النادي'),'لا توجد أخبار منشورة حالياً.'],
 '/team':['الفريق','اللاعبون والجهاز الفني حسب السجل المنشور للنادي.','SELECT name,role,number,note FROM club_team ORDER BY sort_order,id',x=>card(x.name,x.note,[x.role||'لاعب',x.number?'الرقم '+x.number:''].filter(Boolean).join(' · ')),'لم تُنشر قائمة الفريق بعد.'],
 '/board':['مجلس الإدارة','بيانات المسؤولين كما تنشرها إدارة النادي.','SELECT name,position,note FROM club_board ORDER BY sort_order,id',x=>card(x.name,x.note,x.position),'لم تُنشر بيانات مجلس الإدارة بعد.'],
 '/achievements':['الإنجازات','محطات موثقة من مسيرة النادي.',"SELECT title,details,achievement_date FROM club_achievements ORDER BY COALESCE(achievement_date,'') DESC,id DESC",x=>card(x.title,x.details,x.achievement_date),'يجري توثيق الإنجازات. لا توجد سجلات منشورة حالياً.'],
 '/projects':['المشروعات والمبادرات','المشروعات المنشورة لخدمة النادي والمجتمع.','SELECT title,summary,status,progress FROM club_projects WHERE is_published=1 ORDER BY id DESC',x=>card(x.title,x.summary,[x.status,Number(x.progress)>0?'نسبة الإنجاز: '+Math.min(100,Number(x.progress))+'%':''].filter(Boolean).join(' · ')),'لا توجد مشروعات منشورة حالياً.'],
 '/events':['الفعاليات','البرامج والمناسبات الرياضية والثقافية والاجتماعية.',"SELECT title,details,event_date,location FROM club_events WHERE is_published=1 ORDER BY COALESCE(event_date,'') DESC,id DESC",x=>card(x.title,x.details,[x.event_date,x.location].filter(Boolean).join(' · ')),'لا توجد فعاليات منشورة حالياً.'],
 '/sponsors':['الداعمون','شكراً لكل من يساهم في دعم النادي وأنشطته.','SELECT name,kind,note,url FROM club_sponsors ORDER BY sort_order,id',x=>'<article class="wdn-card"><span class="wdn-label">'+esc(x.kind||'داعم')+'</span><h3>'+esc(x.name)+'</h3><p>'+esc(x.note||'')+'</p>'+(safeUrl(x.url)?'<a href="'+esc(safeUrl(x.url))+'" target="_blank" rel="noopener noreferrer">زيارة الموقع ←</a>':'')+'</article>','لم تُنشر قائمة الداعمين بعد.'],
 '/gallery':['معرض الصور','صور موثقة من حياة النادي وأنشطته.','SELECT title,image_url,caption FROM club_gallery ORDER BY sort_order,id DESC',x=>'<article class="wdn-card">'+(safeUrl(x.image_url)?'<img src="'+esc(safeUrl(x.image_url))+'" alt="'+esc(x.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'<h3>'+esc(x.title)+'</h3><p>'+esc(x.caption||'')+'</p></article>','لا توجد صور منشورة حالياً.']
};
const collectionTables={
 '/news':'club_news','/team':'club_team','/board':'club_board','/achievements':'club_achievements',
 '/projects':'club_projects','/events':'club_events','/sponsors':'club_sponsors','/gallery':'club_gallery'
};
async function publicColumnProfile(db,table){
 const allowedTables=new Set(Object.values(collectionTables));
 const allowedColumns=new Set(['id','title','body','category','is_published','created_by','created_at','name','role','number','note','sort_order','position','details','achievement_date','summary','status','target','progress','event_date','location','kind','url','image_url','caption']);
 if(!db||!allowedTables.has(table))return '';
 try{
  const result=await db.prepare('PRAGMA table_info('+table+')').all();
  return (result.results||[]).map(x=>String(x.name||'')).filter(x=>allowedColumns.has(x)).join(',');
 }catch{return ''}
}
async function collection(path,db){
 const [title,description,sql,render,message]=collections[path],data=path==='/news'?await readNews(db,50):await read(db,sql);
 const body=heading(title,description)+'<div class="wdn-wrap">'+(data.failed?'<div class="wdn-empty" role="alert"><h2>تعذر تحميل المحتوى</h2><p>أعد المحاولة بعد قليل.</p></div>':data.rows.length?'<div class="wdn-grid">'+data.rows.map(render).join('')+'</div>':empty(message))+'</div>';
 const response=page(title,description,body,path,data.failed?503:200);
 if(data.failed){
  response.headers.set('x-wadnofei-data-state',data.reason||'db-error');
  const profile=await publicColumnProfile(db,collectionTables[path]);
  if(profile)response.headers.set('x-wadnofei-schema-columns',profile);
 }
 return response;
}
const staticPages={
 '/about':['عن النادي','نادي رياضي ثقافي اجتماعي يجمع أبناء ود نفيع ومحبيها منذ عام 1964.','<section class="wdn-reading"><h2>انتماء يتحول إلى مشاركة</h2><p>يحمل النادي تاريخ الحي ويعمل ليكون مساحة جامعة للشباب والأسر وأبناء ود نفيع في الداخل والخارج. تمتد رسالته إلى الرياضة والثقافة والعمل الاجتماعي.</p><p>نؤمن بالعمل الجماعي، وحفظ حقوق الأعضاء، واحترام الاختصاصات، وتوثيق العمل بما يحفظ ذاكرة النادي وأصوله للأجيال القادمة.</p></section><section class="wdn-section">'+areas+'</section><section class="wdn-band"><div><h2>كن جزءاً من النادي</h2><p>ابدأ بطلب العضوية، وتابع إجراءاته حتى المراجعة والاعتماد.</p></div><a href="/membership" class="wdn-button">طلب العضوية</a></section>'],
 '/activities':['الأنشطة','رياضة وثقافة ومبادرات اجتماعية تفتح باب المشاركة للجميع.',areas+'<section class="wdn-section wdn-grid two">'+card('البرامج والفعاليات','تجد المواعيد والتفاصيل المعتمدة في صفحة الفعاليات.')+'<article class="wdn-card"><h3>شارك بمبادرة</h3><p>لطرح فكرة أو المشاركة في نشاط، تواصل مع النادي.</p><div class="wdn-actions"><a href="/events" class="wdn-button">الفعاليات</a><a href="/contact">تواصل معنا ←</a></div></article></section>'],
 '/history':['تاريخ النادي','مسيرة بدأت عام 1964، وذاكرة نحفظها بالتوثيق.','<section class="wdn-card wdn-reading"><span class="wdn-label">1964</span><h2>تأسيس نادي ود نفيع</h2><p>بداية مسيرة رياضية وثقافية واجتماعية تجمع أبناء الحي.</p><h2>التوثيق والمشاركة</h2><p>نعمل على حفظ المحطات والصور والإنجازات الموثقة، وإتاحة خدمات العضوية عبر الموقع.</p><p class="wdn-note">تُضاف المحطات التاريخية بعد التحقق من وثائقها ومصادرها.</p><a href="/contact" class="wdn-button">شارك بوثيقة أو صورة</a></section>'],
 '/identity':['الرؤية والقيم','انتماء ومسؤولية وعمل مؤسسي يخدم النادي والمجتمع.','<div class="wdn-grid">'+card('رؤيتنا','نادي يجمع الأجيال ويتيح المشاركة، بإدارة واضحة وعمل مستدام.')+card('رسالتنا','رعاية الرياضة والثقافة والعمل الاجتماعي، وحفظ حقوق الأعضاء وأصول النادي.')+card('قيمنا','الشفافية، الاحترام، الانتماء، العمل الجماعي، والتوثيق.')+'</div><div class="wdn-actions"><a href="/constitution" class="wdn-button">قراءة النظام الأساسي</a></div>'],
 '/contact':['تواصل معنا','للاستفسار عن النادي أو العضوية أو المشاركة في أنشطته.','<div class="wdn-grid two"><a class="wdn-card wdn-contact" href="https://wa.me/249912603242" target="_blank" rel="noopener noreferrer"><span class="wdn-label">التواصل المباشر</span><b>واتساب النادي</b><span dir="ltr">+249 91 260 3242</span></a><article class="wdn-card"><span class="wdn-label">ود نفيع · المناقل</span><h3>خدمات العضوية</h3><p>إذا سبق أن قدّمت طلباً، راجع حالته من صفحة المتابعة.</p><a href="/membership/track">متابعة طلب العضوية ←</a></article></div>'+services]
};
