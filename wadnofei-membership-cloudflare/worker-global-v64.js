import app from './worker-global-v63.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(m==='GET'&&p==='/history') return historyPage();
    if(m==='GET'&&p==='/identity') return identityPage();

    if(m==='GET'&&p==='/'&&env.DB){
      const base=await app.fetch(req,env,ctx);
      const ct=base.headers.get('content-type')||'';
      if(!ct.includes('text/html')) return base;
      let html=await base.text();
      const [members,news,projects,events,achievements,sponsors]=await Promise.all([
        n(env.DB,`SELECT COUNT(*) c FROM members`),
        many(env.DB,`SELECT * FROM club_news WHERE is_published=1 ORDER BY id DESC LIMIT 4`),
        many(env.DB,`SELECT * FROM club_projects WHERE is_published=1 ORDER BY id DESC LIMIT 3`),
        many(env.DB,`SELECT * FROM club_events WHERE is_published=1 ORDER BY COALESCE(event_date,'') DESC,id DESC LIMIT 1`),
        many(env.DB,`SELECT * FROM club_achievements ORDER BY COALESCE(achievement_date,'') DESC,id DESC LIMIT 3`),
        many(env.DB,`SELECT * FROM club_sponsors ORDER BY sort_order,id LIMIT 8`)
      ]);
      const block=homepageBlock({members,news,projects,event:events[0],achievements,sponsors});
      html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      html=html.replace('</nav>','<a href="/history">التاريخ</a><a href="/identity">الهوية</a></nav>');
      const h=new Headers(base.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v64-premium-home');
      return new Response(html,{status:base.status,statusText:base.statusText,headers:h});
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/about','/activities','/contact','/news','/team','/board','/achievements','/projects','/events','/sponsors','/gallery'].includes(p)){
      let html=await r.text();
      html=html.replace('</nav>','<a href="/history">التاريخ</a><a href="/identity">الهوية</a></nav>');
      const h=new Headers(r.headers);h.delete('content-length');h.set('x-wadnofei-ui','v64-premium-home');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

function homepageBlock(d){
  const event=d.event?`<article class="v64-feature"><span>الفعالية الأحدث</span><h3>${esc(d.event.title)}</h3><p>${esc(d.event.details||'')}</p><small>${esc(d.event.event_date||'')} ${d.event.location?'· '+esc(d.event.location):''}</small><a href="/events">كل الفعاليات</a></article>`:`<article class="v64-feature"><span>فعاليات النادي</span><h3>مساحة للرياضة والثقافة والمجتمع</h3><p>سيتم عرض أحدث الفعاليات هنا فور إضافتها من لوحة الإدارة.</p><a href="/events">الفعاليات</a></article>`;
  const achievements=d.achievements.length?d.achievements.map(x=>`<article><small>${esc(x.achievement_date||'محطة من تاريخنا')}</small><h3>${esc(x.title)}</h3><p>${esc(x.details||'')}</p></article>`).join(''):'<article><h3>توثيق التاريخ مستمر</h3><p>نعمل على جمع وحفظ إنجازات النادي للأجيال القادمة.</p></article>';
  const sponsors=d.sponsors.length?d.sponsors.map(x=>`<span class="v64-sponsor">${esc(x.name)}</span>`).join(''):'<span class="v64-sponsor">شكرًا لكل داعم للنادي</span>';
  return `<style>
  .v64-shell{width:min(1160px,94%);margin:44px auto}.v64-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.v64-head span{display:block;color:#b48812;font-weight:900}.v64-head h2{margin:4px 0;color:#061a43;font-size:clamp(25px,4vw,42px);line-height:1.25}.v64-head a{font-weight:900;text-decoration:none;color:#0a347c}.v64-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.v64-stat{background:linear-gradient(145deg,#061a43,#0c3c8d);color:#fff;border-radius:22px;padding:21px;box-shadow:0 16px 45px #061a4320}.v64-stat b{display:block;color:#f1c43d;font-size:30px}.v64-stat span{opacity:.85}.v64-news{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.v64-news article,.v64-ach article,.v64-feature{background:#fff;border:1px solid #dbe4f4;border-radius:20px;padding:20px;box-shadow:0 12px 34px #12325d10}.v64-news small,.v64-ach small,.v64-feature>span{color:#a87e0b;font-weight:900}.v64-news h3,.v64-ach h3,.v64-feature h3{color:#061a43;margin:8px 0}.v64-news p,.v64-ach p,.v64-feature p{color:#52647e}.v64-feature{background:linear-gradient(145deg,#071f50,#0d3f91);color:#fff}.v64-feature h3,.v64-feature p{color:#fff}.v64-feature a{display:inline-block;margin-top:10px;background:#f1c43d;color:#061a43;text-decoration:none;padding:10px 15px;border-radius:12px;font-weight:900}.v64-duo{display:grid;grid-template-columns:1fr 1.15fr;gap:16px}.v64-ach{display:grid;gap:12px}.v64-sponsors{display:flex;gap:10px;flex-wrap:wrap}.v64-sponsor{background:#fff;border:1px solid #d9e2f1;border-radius:999px;padding:11px 16px;font-weight:800;color:#173258}.v64-actions{background:linear-gradient(135deg,#061a43,#0a347c);border-radius:28px;padding:28px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:20px}.v64-actions h2{margin:0;color:#f1c43d}.v64-actions div:last-child{display:flex;gap:10px;flex-wrap:wrap}.v64-actions a{background:#f1c43d;color:#061a43;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900}.v64-actions a.alt{background:#fff}.v64-projects{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.v64-projects article{background:#071f50;color:#fff;border-radius:20px;padding:20px}.v64-projects b{color:#f1c43d}.v64-projects p{opacity:.86}.v64-bar{height:8px;border-radius:999px;background:#ffffff20;overflow:hidden;margin-top:12px}.v64-bar i{display:block;height:100%;background:#f1c43d}.v64-history{display:grid;grid-template-columns:1fr 1fr;gap:14px}.v64-history a{background:#fff;border:1px solid #dae4f2;border-radius:20px;padding:20px;text-decoration:none;color:#061a43;font-weight:900}.v64-history a span{display:block;font-weight:400;color:#5a6b82;margin-top:7px}@media(max-width:850px){.v64-stats,.v64-news{grid-template-columns:repeat(2,1fr)}.v64-duo{grid-template-columns:1fr}.v64-projects{grid-template-columns:1fr}.v64-actions{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.v64-stats,.v64-news,.v64-history{grid-template-columns:1fr}.v64-shell{margin:30px auto}}
  </style>
  <section class="v64-shell"><div class="v64-head"><div><span>النادي بالأرقام</span><h2>مؤسسة تتطور كل يوم</h2></div></div><div class="v64-stats"><div class="v64-stat"><b>1964</b><span>عام التأسيس</span></div><div class="v64-stat"><b>${d.members}</b><span>عضو مسجل بالنظام</span></div><div class="v64-stat"><b>${d.news.length}</b><span>أحدث أخبار معروضة</span></div><div class="v64-stat"><b>${d.projects.length}</b><span>مشروعات مختارة</span></div></div></section>
  <section class="v64-shell"><div class="v64-head"><div><span>آخر المستجدات</span><h2>من قلب النادي</h2></div><a href="/news">كل الأخبار ←</a></div><div class="v64-news">${d.news.length?d.news.map(x=>`<article><small>${esc(x.category||'عام')}</small><h3>${esc(x.title)}</h3><p>${esc(short(x.body,130))}</p></article>`).join(''):'<article><h3>قريبًا</h3><p>ستظهر الأخبار الرسمية هنا فور نشرها.</p></article>'}</div></section>
  <section class="v64-shell v64-duo">${event}<div class="v64-ach">${achievements}</div></section>
  <section class="v64-shell"><div class="v64-head"><div><span>نبني للمستقبل</span><h2>مشروعات ومبادرات</h2></div><a href="/projects">كل المشروعات ←</a></div><div class="v64-projects">${d.projects.length?d.projects.map(x=>`<article><b>${esc(x.status||'قيد التنفيذ')}</b><h3>${esc(x.title)}</h3><p>${esc(short(x.summary,150))}</p><div class="v64-bar"><i style="width:${Math.max(0,Math.min(100,Number(x.progress||0)))}%"></i></div></article>`).join(''):'<article><h3>مساحة للمبادرات</h3><p>تظهر هنا مشروعات النادي فور اعتمادها.</p></article>'}</div></section>
  <section class="v64-shell"><div class="v64-head"><div><span>شركاء النجاح</span><h2>الداعمون والرعاة</h2></div><a href="/sponsors">عرض الجميع ←</a></div><div class="v64-sponsors">${sponsors}</div></section>
  <section class="v64-shell v64-history"><a href="/history">تاريخ النادي<span>منذ 1964، صفحة مخصصة لتوثيق المسيرة والمحطات.</span></a><a href="/identity">الهوية المؤسسية<span>الرؤية، الرسالة، القيم وما الذي يمثله نادي ود نفيع.</span></a></section>
  <section class="v64-shell v64-actions"><div><small>شارك في مستقبل النادي</small><h2>العضوية الإلكترونية مفتوحة</h2></div><div><a href="/membership">تقديم طلب عضوية</a><a class="alt" href="/contact">تواصل معنا</a></div></section>`;
}

function historyPage(){return simplePage('تاريخ النادي',`<section class="hero64"><span>منذ 1964</span><h1>تاريخ نادي ود نفيع</h1><p>صفحة مخصصة لتوثيق مسيرة النادي ومحطاته وإنجازاته وحفظ ذاكرته المؤسسية للأجيال القادمة.</p></section><section class="cards64"><article><b>1964</b><h2>البداية</h2><p>عام تأسيس النادي، ومنه بدأت مسيرة رياضية وثقافية واجتماعية ممتدة.</p></article><article><b>اليوم</b><h2>مرحلة التنظيم الرقمي</h2><p>عضوية إلكترونية، إدارة بيانات، بطاقات رقمية، تقارير، وموقع عام يجمع هوية النادي في مكان واحد.</p></article><article><b>المستقبل</b><h2>توثيق مستمر</h2><p>سيتم إثراء هذه الصفحة بالمحطات التاريخية الموثقة والصور والبطولات والشخصيات المؤثرة.</p></article></section>`)}
function identityPage(){return simplePage('الهوية المؤسسية',`<section class="hero64"><span>رياضة · ثقافة · مجتمع</span><h1>هوية نادي ود نفيع</h1><p>نادي يجمع الانتماء بالتنظيم، ويحفظ حق الأعضاء، ويفتح المجال للمشاركة وخدمة المجتمع.</p></section><section class="cards64"><article><h2>الرؤية</h2><p>أن يكون النادي نموذجًا مؤسسيًا حديثًا في الرياضة والثقافة والعمل الاجتماعي والمشاركة المجتمعية.</p></article><article><h2>الرسالة</h2><p>بناء بيئة منظمة تحفظ الحقوق، تدعم المواهب، وتربط أبناء النادي داخل الحي وخارجه.</p></article><article><h2>القيم</h2><p>الشفافية، الانتماء، الاحترام، المسؤولية، العمل الجماعي، حفظ الأصول والاستدامة.</p></article></section>`)}
function simplePage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.8}header{background:#061a43;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:11px 4%;gap:15px;position:sticky;top:0}header a{color:#fff;text-decoration:none}header .brand{display:flex;align-items:center;gap:10px;color:#f1c43d;font-weight:900}.brand img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:12px;padding:3px}nav{display:flex;gap:10px;flex-wrap:wrap}.wrap{width:min(1100px,94%);margin:30px auto}.hero64{background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;padding:48px;border-radius:28px}.hero64 span{color:#f1c43d;font-weight:900}.hero64 h1{font-size:clamp(32px,6vw,60px);line-height:1.2;margin:8px 0}.hero64 p{font-size:18px;max-width:760px}.cards64{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:20px}.cards64 article{background:#fff;border:1px solid #dbe5f3;border-radius:20px;padding:22px}.cards64 b{font-size:28px;color:#b48812}@media(max-width:720px){.cards64{grid-template-columns:1fr}.hero64{padding:28px}nav{display:none}}</style></head><body><header><a class="brand" href="/"><img src="${LOGO}" alt="شعار النادي">نادي ود نفيع</a><nav><a href="/">الرئيسية</a><a href="/news">الأخبار</a><a href="/history">التاريخ</a><a href="/identity">الهوية</a><a href="/membership">العضوية</a></nav></header><main class="wrap">${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff','x-wadnofei-ui':'v64-premium-home'}})}
async function many(db,q,b=[]){try{return (await db.prepare(q).bind(...b).all()).results||[]}catch(_){return []}}
async function n(db,q,b=[]){try{return Number((await db.prepare(q).bind(...b).first())?.c||0)}catch(_){return 0}}
function short(v,n){const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n)+'…':s}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
