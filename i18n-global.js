(function(){
  'use strict';
  var KEY='bunyan_language';
  var lang=localStorage.getItem(KEY)==='en'?'en':'ar';
  var pairs=[
    ['Overview','نظرة عامة'],['Projects','المشروعات'],['Beneficiaries','المستفيدون'],['Volunteers','المتطوعون'],['Settings','الإعدادات'],['View Website','عرض الموقع'],['Finance Centre','المركز المالي'],['Transparency & Reports','الشفافية والتقارير'],['Project Transparency','شفافية المشروعات'],['Project Management','إدارة المشروعات'],['New Project','مشروع جديد'],['Add Project','إضافة مشروع'],['Dashboard','لوحة التحكم'],['Reports','التقارير'],['Donations','المساهمات'],['Expenses','المصروفات'],['Documents','المستندات'],['Logout','تسجيل الخروج'],
    ['Platform Settings','إعدادات بُنْيَان'],['Appearance, language and device settings.','المظهر واللغة وإعدادات الجهاز.'],['Dark Mode','الوضع الليلي'],['Improve readability in low light.','تحسين القراءة في الإضاءة المنخفضة.'],['Enable Dark Mode','تشغيل الوضع الليلي'],['Disable Dark Mode','إيقاف الوضع الليلي'],['Language','اللغة'],['Arabic is the primary interface, with instant translation for main headings.','الواجهة العربية هي الأساسية، مع طبقة ترجمة فورية للعناوين الرئيسية.'],['Arabic is the primary interface, with instant translation across the system.','الواجهة العربية هي الأساسية، مع ترجمة فورية لجميع عناصر النظام.'],['App Update','تحديث التطبيق'],['Clear local cache and reload the latest version.','حذف الكاش المحلي وإعادة تحميل أحدث إصدار.'],['Full Update','تحديث كامل'],['Check for Update','التحقق من التحديث'],
    ['About Us','من نحن'],['Programs','البرامج'],['News','الأخبار'],['Join Us','شارك معنا'],['Contact Us','اتصل بنا'],['Admin Dashboard','لوحة الإدارة'],['From local community to sustainable impact','من المجتمع المحلي إلى أثر مستدام'],['We build people','نبني الإنسان'],['to build the future','ليَبني المستقبل'],['View Our Projects','شاهد مشروعاتنا'],['Join BUNYAN','انضم إلى البُنْيَان'],
    ['Search','بحث'],['Save','حفظ'],['Cancel','إلغاء'],['Delete','حذف'],['Edit','تعديل'],['Preview','معاينة'],['Share Project','مشاركة المشروع'],['Copy Link','نسخ الرابط'],['Copied!','تم النسخ!'],['Loading...','جاري التحميل...'],['No data available','لا توجد بيانات'],['Create Project','إنشاء مشروع'],['Project Name','اسم المشروع'],['Executive Summary','الملخص التنفيذي'],['Status','الحالة'],['Progress','نسبة الإنجاز'],['Budget','الميزانية'],['Currency','العملة'],['Target Beneficiaries','عدد المستفيدين المستهدف'],['Publish project on public website','نشر المشروع في الموقع العام'],['Active','نشط'],['Completed','مكتمل'],['Paused','متوقف مؤقتًا'],['Planning','قيد التخطيط'],['Draft','مسودة'],['Public','منشور'],['Private','غير منشور'],
    ['Project expenses and documents','مصروفات المشروع ومستنداته'],['Add expense','إضافة مصروف'],['Upload document','رفع مستند'],['Amount','المبلغ'],['Date','التاريخ'],['Category','التصنيف'],['Notes','ملاحظات'],['File','الملف'],['Download','تنزيل'],['Receipt','فاتورة أو إيصال'],['Full name','الاسم الكامل'],['Phone number','رقم الهاتف'],['Send Request','إرسال الطلب'],['Send Message','إرسال الرسالة']
  ];
  var arToEn={},enToAr={},i;
  for(i=0;i<pairs.length;i++){enToAr[pairs[i][0]]=pairs[i][1];arToEn[pairs[i][1]]=pairs[i][0];}
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function convert(v){var c=clean(v),m=lang==='en'?arToEn:enToAr,n=m[c];if(!n)return v;var s=String(v),a=(s.match(/^\s*/)||[''])[0],b=(s.match(/\s*$/)||[''])[0];return a+n+b;}
  function nodeTranslate(n){
    if(!n)return;
    if(n.nodeType===3){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/i.test(p.tagName)||closestNoI18n(p))return;var x=convert(n.nodeValue);if(x!==n.nodeValue)n.nodeValue=x;return;}
    if(n.nodeType!==1||closestNoI18n(n))return;
    var attrs=['placeholder','title','aria-label'];
    for(var j=0;j<attrs.length;j++){var a=attrs[j];if(n.hasAttribute&&n.hasAttribute(a)){var old=n.getAttribute(a),next=convert(old);if(next!==old)n.setAttribute(a,next);}}
  }
  function closestNoI18n(el){while(el&&el.nodeType===1){if(el.getAttribute&&el.getAttribute('data-no-i18n')!==null)return true;el=el.parentNode;}return false;}
  function walk(root){
    if(!root)return;nodeTranslate(root);
    var w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,null,false),n;
    while((n=w.nextNode()))nodeTranslate(n);
    updateToggle();removeDuplicateHeading();
  }
  function updateToggle(){
    var list=document.querySelectorAll('button,a');
    for(var i=0;i<list.length;i++){var el=list[i],t=clean(el.textContent);if(/Switch to English|Switch to Arabic|التبديل إلى الإنجليزية|التبديل إلى العربية|English\s*\/|\/\s*English/i.test(t)){el.setAttribute('data-language-toggle','true');el.textContent=lang==='ar'?'Switch to English':'التبديل إلى العربية';el.setAttribute('aria-label',el.textContent);}}
  }
  function removeDuplicateHeading(){
    var cards=document.querySelectorAll('.settings-hero,.settings-banner,.platform-settings');
    for(var i=0;i<cards.length;i++){var hs=cards[i].querySelectorAll('h1,h2,h3');if(hs.length>1&&clean(hs[0].textContent).toLowerCase()===clean(hs[1].textContent).toLowerCase())hs[0].style.display='none';}
  }
  function setLanguage(next){
    lang=next==='en'?'en':'ar';localStorage.setItem(KEY,lang);
    document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    if(document.body){document.body.classList.remove('lang-ar','lang-en');document.body.classList.add(lang==='ar'?'lang-ar':'lang-en');walk(document.body);}
    try{window.dispatchEvent(new CustomEvent('bunyan:languagechange',{detail:{lang:lang}}));}catch(e){}
  }
  document.addEventListener('click',function(e){var el=e.target;while(el&&el!==document&&!(el.getAttribute&&el.getAttribute('data-language-toggle')==='true'))el=el.parentNode;if(!el||el===document)return;e.preventDefault();e.stopPropagation();setLanguage(lang==='ar'?'en':'ar');},true);
  var timer=null;
  if(window.MutationObserver){new MutationObserver(function(records){clearTimeout(timer);timer=setTimeout(function(){for(var r=0;r<records.length;r++){for(var k=0;k<records[r].addedNodes.length;k++){var n=records[r].addedNodes[k];if(n.nodeType===1)walk(n);else if(n.nodeType===3)nodeTranslate(n);}}updateToggle();},80);}).observe(document.documentElement,{childList:true,subtree:true});}
  function init(){setLanguage(lang);setTimeout(function(){walk(document.body);},300);setTimeout(function(){walk(document.body);},1200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.BunyanI18n={getLanguage:function(){return lang;},setLanguage:setLanguage,t:function(key){return (lang==='en'?arToEn:enToAr)[key]||key;}};
})();