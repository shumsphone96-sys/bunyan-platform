import app from './worker-global-v60.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ORIGIN='https://members.shamsphone.net';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';
const WA='249912603242';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(m==='GET'){
      if(p==='/') return home();
      if(p==='/about') return about();
      if(p==='/activities') return activities();
      if(p==='/contact') return contact();
      if(p==='/robots.txt') return text('User-agent: *\nAllow: /\nDisallow: /club-admin\nDisallow: /login\nSitemap: '+ORIGIN+'/sitemap.xml\n','text/plain; charset=utf-8');
      if(p==='/sitemap.xml') return text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/about</loc></url><url><loc>${ORIGIN}/activities</loc></url><url><loc>${ORIGIN}/membership</loc></url><url><loc>${ORIGIN}/contact</loc></url></urlset>`,'application/xml; charset=utf-8');
    }

    return app.fetch(req,env,ctx);
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

function home(){
  const body=`
  <section class="hero">
    <div class="hero-copy"><span class="eyebrow">منذ 1964</span><h1>${CLUB}</h1><p>مؤسسة رياضية وثقافية واجتماعية تعمل بروح الانتماء، التنظيم، المشاركة وخدمة المجتمع.</p><div class="cta"><a class="primary" href="/membership">انضم لعضوية النادي</a><a class="secondary" href="/about">تعرف على النادي</a></div></div>
    <div class="hero-mark"><img src="${LOGO}" alt="شعار نادي ود نفيع"><b>ود نفيع</b><span>رياضة · ثقافة · مجتمع</span></div>
  </section>
  <section class="section"><div class="section-head"><span>من نحن</span><h2>نادي يجمع الناس حول قيمة واحدة: خدمة ود نفيع</h2></div><div class="cards"><article><b>⚽</b><h3>رياضة</h3><p>رعاية النشاط الرياضي وبناء بيئة تنافسية منظمة تليق بتاريخ النادي.</p></article><article><b>📚</b><h3>ثقافة</h3><p>مساحة للمعرفة والمبادرات والبرامج التي تنمّي الوعي وتربط الأجيال.</p></article><article><b>🤝</b><h3>مجتمع</h3><p>عمل اجتماعي ومؤسسي يفتح أبواب المشاركة لكل أبناء الحي ومحبيه.</p></article></div></section>
  <section class="band"><div><span>العضوية الإلكترونية</span><h2>عضويتك حقك وصوتك ومشاركتك في مستقبل النادي</h2><p>التقديم أصبح إلكترونيًا، مع رقم طلب ومراجعة منظمة وبطاقة عضوية رقمية بعد الاعتماد.</p></div><a href="/membership">ابدأ طلب العضوية</a></section>
  <section class="section"><div class="section-head"><span>نحو مؤسسة حديثة</span><h2>تنظيم رقمي يحفظ الحقوق ويجعل الإدارة أكثر وضوحًا</h2></div><div class="features"><div><strong>01</strong><p>تسجيل عضوية إلكتروني من الهاتف</p></div><div><strong>02</strong><p>بطاقات عضوية قابلة للتحقق</p></div><div><strong>03</strong><p>سجل وتجديد ومتابعة مالية منظمة</p></div><div><strong>04</strong><p>واجهة عامة تعكس هوية النادي وتاريخه</p></div></div></section>`;
  return page('الرئيسية','نادي ود نفيع — منذ 1964',body,'الموقع الرسمي العام لنادي ود نفيع الرياضي الثقافي الاجتماعي.');
}

function about(){
  const body=`<section class="innerHero"><span>منذ 1964</span><h1>عن نادي ود نفيع</h1><p>نادي رياضي ثقافي اجتماعي يحمل تاريخ الحي ويعمل ليكون منصة جامعة للشباب والأسر وأبناء ود نفيع في الداخل والخارج.</p></section><section class="section"><div class="cards"><article><h3>رسالتنا</h3><p>بناء مؤسسة منظمة تحفظ حقوق الأعضاء وتدعم الرياضة والثقافة والعمل الاجتماعي.</p></article><article><h3>رؤيتنا</h3><p>أن يكون النادي نموذجًا محليًا في الإدارة الحديثة والمشاركة المجتمعية والاستدامة.</p></article><article><h3>قيمنا</h3><p>الشفافية، الانتماء، الاحترام، العمل الجماعي، المسؤولية وحفظ الأصول للأجيال القادمة.</p></article></div></section><section class="band"><div><span>شارك في البناء</span><h2>النادي يكبر بعضويته ومشاركة أهله</h2></div><a href="/membership">سجل عضويتك الآن</a></section>`;
  return page('عن النادي','عن نادي ود نفيع',body,'تعرف على رسالة ورؤية وقيم نادي ود نفيع الرياضي الثقافي الاجتماعي.');
}

function activities(){
  const body=`<section class="innerHero"><span>حياة النادي</span><h1>الأنشطة والمجالات</h1><p>النادي ليس فريق كرة قدم فقط؛ هو مساحة تجمع الرياضة والثقافة والعمل الاجتماعي والمبادرات.</p></section><section class="section"><div class="cards"><article><b>⚽</b><h3>النشاط الرياضي</h3><p>الفريق، التسجيلات، التدريب، المنافسات، المواهب والبرامج الرياضية.</p></article><article><b>🎙️</b><h3>النشاط الثقافي</h3><p>ندوات، لقاءات، مبادرات معرفية وبرامج تعزز الوعي والانتماء.</p></article><article><b>🫱🏽‍🫲🏾</b><h3>النشاط الاجتماعي</h3><p>مبادرات أهلية، مشاركة مجتمعية، دعم المناسبات والعمل التطوعي.</p></article></div></section><section class="band"><div><span>كن جزءًا من النشاط</span><h2>عضويتك هي المدخل للمشاركة المؤسسية</h2></div><a href="/membership">طلب العضوية</a></section>`;
  return page('الأنشطة','أنشطة نادي ود نفيع',body,'الأنشطة الرياضية والثقافية والاجتماعية لنادي ود نفيع.');
}

function contact(){
  const body=`<section class="innerHero"><span>تواصل معنا</span><h1>نحن أقرب إليك</h1><p>للاستفسارات المتعلقة بالعضوية أو النادي يمكنك التواصل مباشرة أو استخدام بوابة العضوية الإلكترونية.</p></section><section class="section"><div class="contactGrid"><a class="contactCard" href="https://wa.me/${WA}" target="_blank" rel="noopener"><b>واتساب النادي</b><span dir="ltr">+249 91 260 3242</span></a><a class="contactCard" href="/membership"><b>بوابة العضوية</b><span>تقديم طلب عضوية إلكتروني</span></a></div></section>`;
  return page('اتصل بنا','تواصل مع نادي ود نفيع',body,'تواصل مع نادي ود نفيع الرياضي الثقافي الاجتماعي.');
}

function page(title,ogTitle,body,desc){
  const nav=`<header><a class="brand" href="/"><img src="${LOGO}" alt="شعار النادي"><div><b>نادي ود نفيع</b><span>الرياضي الثقافي الاجتماعي</span></div></a><button class="menu" aria-label="فتح القائمة" onclick="document.body.classList.toggle('navopen')">☰</button><nav><a href="/">الرئيسية</a><a href="/about">عن النادي</a><a href="/activities">الأنشطة</a><a href="/membership">العضوية</a><a href="/contact">تواصل</a></nav></header>`;
  const foot=`<footer><div><img src="${LOGO}" alt="شعار نادي ود نفيع"><p><b>${CLUB}</b><br>تأسس عام 1964</p></div><div class="footlinks"><a href="/about">عن النادي</a><a href="/activities">الأنشطة</a><a href="/membership">العضوية</a><a href="/contact">تواصل</a></div><small>© ${new Date().getFullYear()} نادي ود نفيع. جميع الحقوق محفوظة.</small></footer>`;
  const json=JSON.stringify({'@context':'https://schema.org','@type':'SportsOrganization',name:CLUB,url:ORIGIN,logo:ORIGIN+LOGO,foundingDate:'1964'});
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(ogTitle)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${ORIGIN}"><meta property="og:image" content="${ORIGIN}${LOGO}"><link rel="canonical" href="${ORIGIN}${title==='الرئيسية'?'/':('/'+routeFor(title))}"><title>${esc(title)} · ${CLUB}</title><script type="application/ld+json">${json}</script><style>${css()}</style></head><body>${nav}<main>${body}</main>${foot}</body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','x-wadnofei-ui':'v61-public-site'}});
}

function routeFor(t){return t==='عن النادي'?'about':t==='الأنشطة'?'activities':t==='اتصل بنا'?'contact':''}
function text(s,ct){return new Response(s,{headers:{'content-type':ct,'cache-control':'public, max-age=3600'}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function css(){return `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.7}a{color:inherit}header{position:sticky;top:0;z-index:50;background:#061a43f2;backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:space-between;padding:10px max(4%,20px);border-bottom:1px solid #d5a92855}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}.brand img{width:54px;height:54px;object-fit:contain;background:#fff;border-radius:14px;padding:4px}.brand b{display:block;color:#f1c43d;font-size:18px}.brand span{display:block;font-size:12px;opacity:.8}nav{display:flex;gap:8px}nav a{color:#fff;text-decoration:none;padding:9px 11px;border-radius:10px;font-weight:700}nav a:hover{background:#ffffff12;color:#f1c43d}.menu{display:none;border:0;background:#d5a928;color:#061a43;border-radius:10px;padding:8px 11px;font-size:20px}.hero{min-height:72vh;background:radial-gradient(circle at 20% 20%,#1b4da5 0,#0a347c 38%,#061a43 75%);color:#fff;display:grid;grid-template-columns:1.25fr .75fr;align-items:center;gap:40px;padding:60px max(6%,26px);overflow:hidden}.hero h1{font-size:clamp(38px,6vw,76px);line-height:1.15;margin:10px 0;color:#f4ca44}.hero p{font-size:clamp(18px,2vw,24px);max-width:760px;opacity:.9}.eyebrow,.section-head span,.innerHero span,.band span{color:#d5a928;font-weight:900;letter-spacing:.03em}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.cta a,.band a{padding:13px 18px;border-radius:14px;text-decoration:none;font-weight:900}.primary,.band a{background:#d5a928;color:#061a43}.secondary{border:1px solid #d5a928;color:#fff}.hero-mark{text-align:center}.hero-mark img{width:min(300px,72vw);aspect-ratio:1;object-fit:contain;background:#fff;border-radius:34px;padding:18px;box-shadow:0 30px 80px #0006}.hero-mark b{display:block;color:#f4ca44;font-size:30px;margin-top:12px}.hero-mark span{opacity:.75}.section{width:min(1150px,92%);margin:0 auto;padding:70px 0}.section-head{max-width:800px;margin-bottom:26px}.section-head h2,.band h2,.innerHero h1{font-size:clamp(28px,4vw,46px);line-height:1.25;margin:8px 0}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.cards article{background:#fff;border:1px solid #d8e0ef;border-radius:22px;padding:25px;box-shadow:0 10px 35px #0a347c0d}.cards article>b{font-size:34px}.cards h3{color:#0a347c;font-size:23px;margin:10px 0}.band{width:min(1150px,92%);margin:15px auto 70px;background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;border:1px solid #d5a92866;border-radius:28px;padding:34px;display:flex;align-items:center;justify-content:space-between;gap:30px}.band p{max-width:760px;opacity:.85}.band a{white-space:nowrap}.features{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.features div{background:#0a347c;color:#fff;padding:24px;border-radius:20px}.features strong{display:block;color:#d5a928;font-size:30px}.innerHero{background:linear-gradient(145deg,#061a43,#0a347c);color:#fff;text-align:center;padding:85px max(7%,25px)}.innerHero h1{color:#f4ca44}.innerHero p{max-width:800px;margin:15px auto 0;font-size:19px;opacity:.9}.contactGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.contactCard{display:block;background:#fff;border:1px solid #d8e0ef;border-radius:22px;padding:28px;text-decoration:none}.contactCard b{display:block;color:#0a347c;font-size:24px}.contactCard span{color:#50627e}footer{background:#04132f;color:#fff;padding:35px max(5%,24px);display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center}footer>div:first-child{display:flex;align-items:center;gap:12px}footer img{width:60px;height:60px;object-fit:contain;background:#fff;border-radius:14px;padding:5px}footer p{margin:0;color:#dfe8ff}.footlinks{display:flex;gap:15px;flex-wrap:wrap}.footlinks a{color:#fff;text-decoration:none}footer small{grid-column:1/-1;opacity:.6;border-top:1px solid #ffffff22;padding-top:16px}@media(max-width:800px){header{align-items:flex-start}.menu{display:block}nav{display:none;position:absolute;top:74px;right:12px;left:12px;background:#061a43;border:1px solid #d5a92855;border-radius:16px;padding:10px;flex-direction:column}.navopen nav{display:flex}.hero{grid-template-columns:1fr;text-align:center;padding-top:45px}.hero-copy p{margin-inline:auto}.cta{justify-content:center}.hero-mark img{width:190px}.cards,.features,.contactGrid{grid-template-columns:1fr}.band{flex-direction:column;align-items:flex-start}footer{grid-template-columns:1fr}.footlinks{justify-content:flex-start}}`}
