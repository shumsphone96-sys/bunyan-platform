(()=>{
'use strict';
const requested=new URLSearchParams(location.search).get('lang');
let lang=(requested==='en'||requested==='ar')?requested:'ar';
const dict={
 ar:{
  'brand.name':'بُنْيَان','brand.subtitle':'مؤسسة شمس الأنبياء للتنمية','brand.footer':'هنا يُبنى الإنسان',
  'nav.about':'من نحن','nav.programs':'البرامج','nav.projects':'المشروعات','nav.news':'الأخبار','nav.join':'شارك معنا','nav.contact':'اتصل بنا','nav.admin':'لوحة الإدارة',
  'hero.tag':'من المجتمع المحلي إلى أثر مستدام','hero.title1':'نبني الإنسان','hero.title2':'ليَبني المستقبل','hero.body':'بُنْيَان منظومة سودانية للتنمية تجمع الحوكمة والشفافية والمعرفة والعمل الميداني لصناعة أثر حقيقي قابل للقياس والاستمرار.','hero.projects':'شاهد مشروعاتنا','hero.join':'انضم إلى البُنْيَان','hero.orb':'الإنسان أولاً',
  'stats.fields':'مجالات تنموية','stats.initiatives':'مبادرة مستهدفة','stats.volunteers':'متطوعاً مستهدفاً','stats.beneficiaries':'مستفيد مستهدف',
  'about.tag':'من نحن','about.title':'مؤسسة تُدار بالنظام\nوتتحرك بقيم المجتمع','about.body':'نؤسس نموذجاً تنموياً يبدأ من احتياجات الناس الحقيقية، ويوثق الموارد والقرارات والنتائج، ويمنح كل مساهم ومتطوع وشريك صورة واضحة عن الأثر.','about.people':'الإنسان أولاً','about.transparency':'الشفافية','about.justice':'العدالة','about.sustainability':'الاستدامة',
  'programs.tag':'برامج بُنْيَان','programs.title':'أربعة مسارات لبناء مجتمع أقوى','programs.edu':'التعليم والمعرفة','programs.eduBody':'دعم المدارس، التدريب، والمكتبات الرقمية.','programs.health':'الصحة والمجتمع','programs.healthBody':'الرعاية الوقائية وصحة الأم والطفل.','programs.econ':'التمكين الاقتصادي','programs.econBody':'المهارات والمشروعات الصغيرة.','programs.digital':'التحول الرقمي','programs.digitalBody':'منصات وبيانات لخدمة التنمية.',
  'projects.tag':'المشروعات','projects.title':'من الفكرة إلى أثر يُرى','projects.support':'ساهم في المشروع',
  'news.tag':'آخر الأخبار','news.title':'نبض بُنْيَان',
  'donate.tag':'الدعم يصنع أثراً','donate.title':'ساهم في مشروع موثّق','donate.body':'سجّل مساهمتك الآن، وستظهر في لوحة الإدارة مع المشروع والعملة وطريقة الدفع.','donate.button':'تسجيل مساهمة',
  'join.tag':'المشاركة تصنع الفرق','join.title':'لك مكان في هذا البُنْيَان','join.body':'متطوعاً أو خبيراً أو داعماً أو شريكاً.','join.volunteer':'أرغب في التطوع','join.partner':'أرغب في الشراكة','join.support':'أرغب في دعم مشروع','join.send':'إرسال الطلب',
  'contact.tag':'تواصل مباشر','contact.title':'رسالتك تصل فورًا إلى فريق بُنْيَان','contact.body':'للشراكات، الاستفسارات، المقترحات والبلاغات. تُحفظ الرسالة في النظام ويصل تنبيه فوري إلى البريد وتيليجرام.','contact.location':'المناقل — ولاية الجزيرة — السودان','contact.send':'إرسال الرسالة',
  'form.fullName':'الاسم الكامل','form.phone':'رقم الهاتف','form.emailOptional':'البريد الإلكتروني (اختياري)','form.phoneOptional':'رقم الهاتف أو واتساب (اختياري)','form.subject':'موضوع الرسالة','form.message':'اكتب رسالتك بوضوح','form.donor':'اسم المساهم','form.amount':'المبلغ','form.project':'اسم المشروع','form.method':'طريقة الدفع','form.reference':'رقم المرجع (اختياري)','form.saveDonation':'حفظ المساهمة',
  'login.title':'دخول لوحة الإدارة','login.name':'اسم المدير (مطلوب لأول إعداد فقط)','login.email':'البريد الإلكتروني','login.password':'كلمة المرور','login.signin':'دخول','login.setup':'إنشاء أول حساب مدير','login.note':'استخدم زر إنشاء المدير مرة واحدة فقط عند الإعداد الأول.',
  'dash.overview':'نظرة عامة','dash.projects':'المشروعات','dash.beneficiaries':'المستفيدون','dash.volunteers':'المتطوعون','dash.donations':'التبرعات','dash.news':'الأخبار','dash.requests':'طلبات المشاركة','dash.backup':'تنزيل نسخة احتياطية','dash.logout':'تسجيل الخروج','dash.site':'عرض الموقع',
  'receipt.title':'إرفاق إشعار التحويل','receipt.note':'صورة أو PDF — الحد الأقصى 3 ميغابايت','footer.copy':'© 2026 مؤسسة شمس الأنبياء للتنمية'
 },
 en:{
  'brand.name':'BUNYAN','brand.subtitle':'Shams Al-Anbiya Foundation for Development','brand.footer':'Building people here',
  'nav.about':'About Us','nav.programs':'Programs','nav.projects':'Projects','nav.news':'News','nav.join':'Join Us','nav.contact':'Contact Us','nav.admin':'Admin Dashboard',
  'hero.tag':'From local community to sustainable impact','hero.title1':'We build people','hero.title2':'to build the future','hero.body':'BUNYAN is a Sudanese development platform combining governance, transparency, knowledge and fieldwork to create measurable, lasting impact.','hero.projects':'View Our Projects','hero.join':'Join BUNYAN','hero.orb':'People First',
  'stats.fields':'Development Fields','stats.initiatives':'Target Initiatives','stats.volunteers':'Target Volunteers','stats.beneficiaries':'Target Beneficiaries',
  'about.tag':'About Us','about.title':'An institution governed by systems\nand driven by community values','about.body':'We build a development model that starts from real community needs, documents resources, decisions and outcomes, and gives every contributor, volunteer and partner a clear view of impact.','about.people':'People First','about.transparency':'Transparency','about.justice':'Justice','about.sustainability':'Sustainability',
  'programs.tag':'BUNYAN Programs','programs.title':'Four pathways to build a stronger community','programs.edu':'Education and Knowledge','programs.eduBody':'Supporting schools, training and digital libraries.','programs.health':'Health and Community','programs.healthBody':'Preventive care and maternal and child health.','programs.econ':'Economic Empowerment','programs.econBody':'Skills and small enterprises.','programs.digital':'Digital Transformation','programs.digitalBody':'Platforms and data serving development.',
  'projects.tag':'Projects','projects.title':'From idea to visible impact','projects.support':'Support Project',
  'news.tag':'Latest News','news.title':'BUNYAN Pulse',
  'donate.tag':'Support creates impact','donate.title':'Support a verified project','donate.body':'Register your contribution now; it will appear in the admin dashboard with the project, currency and payment method.','donate.button':'Register Contribution',
  'join.tag':'Participation makes a difference','join.title':'You have a place in BUNYAN','join.body':'As a volunteer, expert, supporter or partner.','join.volunteer':'I want to volunteer','join.partner':'I want to partner','join.support':'I want to support a project','join.send':'Send Request',
  'contact.tag':'Direct Contact','contact.title':'Your message reaches the BUNYAN team immediately','contact.body':'For partnerships, enquiries, suggestions and reports. Your message is stored in the system and an instant alert is sent by email and Telegram.','contact.location':'Al Managil — Gezira State — Sudan','contact.send':'Send Message',
  'form.fullName':'Full Name','form.phone':'Phone Number','form.emailOptional':'Email (optional)','form.phoneOptional':'Phone or WhatsApp (optional)','form.subject':'Message Subject','form.message':'Write your message clearly','form.donor':'Contributor Name','form.amount':'Amount','form.project':'Project Name','form.method':'Payment Method','form.reference':'Reference Number (optional)','form.saveDonation':'Save Contribution',
  'login.title':'Admin Dashboard Sign In','login.name':'Administrator name (first setup only)','login.email':'Email Address','login.password':'Password','login.signin':'Sign In','login.setup':'Create First Administrator','login.note':'Use the create administrator button once during initial setup only.',
  'dash.overview':'Overview','dash.projects':'Projects','dash.beneficiaries':'Beneficiaries','dash.volunteers':'Volunteers','dash.donations':'Donations','dash.news':'News','dash.requests':'Participation Requests','dash.backup':'Download Backup','dash.logout':'Logout','dash.site':'View Website',
  'receipt.title':'Attach Transfer Receipt','receipt.note':'Image or PDF — maximum 3 MB','footer.copy':'© 2026 Shams Al-Anbiya Foundation for Development'
 }
};
const legacyPairs=[
 ['التعليم والمعرفة','Education and Knowledge'],['الصحة والمجتمع','Health and Community'],['التمكين الاقتصادي','Economic Empowerment'],['التحول الرقمي','Digital Transformation'],['ساهم في المشروع','Support Project'],['قيد النشر','Pending Publication'],['في مرحلة الإعداد','Preparation Stage'],['الميزانية','Budget'],['حالة التنفيذ','Implementation Status'],['الشفافية العامة','Public Transparency'],['الأثر بالأرقام','Impact in Numbers'],['جاري التحميل...','Loading...'],['جاري التحميل…','Loading…'],['لا توجد بيانات','No data available'],['موثق','Verified'],['موثقة','Verified'],['قيد المراجعة','Pending Review'],['مرفوض','Rejected'],['مرفوضة','Rejected'],['مكتمل','Completed'],['نشط','Active'],['مسودة','Draft'],['منشور','Published'],['حفظ','Save'],['إلغاء','Cancel'],['حذف','Delete'],['تعديل','Edit'],['فتح','Open'],['تنزيل','Download'],['طباعة','Print'],['مشاركة','Share'],['نسخ الرابط','Copy Link']
];
const arToEn=new Map(legacyPairs),enToAr=new Map(legacyPairs.map(([a,e])=>[e,a]));
function t(key){return dict[lang]?.[key]??dict.ar[key]??key;}
function applyStatic(root=document){
 root.querySelectorAll?.('[data-i18n]').forEach(el=>{const value=t(el.dataset.i18n);if(el.dataset.i18nHtml==='true')el.innerHTML=value.replace(/\n/g,'<br>');else el.textContent=value;});
 root.querySelectorAll?.('[data-i18n-placeholder]').forEach(el=>el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder)));
}
function translateDynamic(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
 while((n=walker.nextNode())){if(!n.parentElement||n.parentElement.closest('[data-i18n],[data-no-i18n],script,style,textarea'))continue;const raw=n.nodeValue.trim();if(!raw)continue;const next=lang==='en'?arToEn.get(raw):enToAr.get(raw);if(next)n.nodeValue=n.nodeValue.replace(raw,next);}
}
function languageUrl(next){const url=new URL(location.origin+location.pathname);url.searchParams.set('lang',next);url.searchParams.set('v','20260729-native-language-links-1');return url.toString();}
function mountSelector(){
 const nav=document.getElementById('nav');if(!nav)return;
 let wrap=document.getElementById('languageSelector');
 if(!wrap){wrap=document.createElement('div');wrap.id='languageSelector';wrap.className='language-selector';wrap.dataset.noI18n='true';wrap.innerHTML='<a data-lang-link="ar">العربية</a><a data-lang-link="en">English</a>';nav.insertBefore(wrap,document.getElementById('adminBtn')||null);}
 wrap.querySelectorAll('[data-lang-link]').forEach(a=>{a.href=languageUrl(a.dataset.langLink);a.classList.toggle('active',a.dataset.langLink===lang);a.setAttribute('aria-current',a.dataset.langLink===lang?'page':'false');});
}
function applyAll(root=document){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body?.setAttribute('dir',document.documentElement.dir);document.title=lang==='ar'?'بُنْيَان | مؤسسة شمس الأنبياء للتنمية':'BUNYAN | Shams Al-Anbiya Foundation for Development';applyStatic(root);translateDynamic(root);mountSelector();}
const observer=new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1){applyStatic(node);translateDynamic(node);}});
function init(){applyAll(document);observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.BunyanI18n={getLanguage:()=>lang,setLanguage:next=>location.assign(languageUrl(next==='en'?'en':'ar')),t,refresh:()=>applyAll(document),dictionary:dict};
})();