(()=>{
  const STORAGE_KEY='bunyan_language';
  const DEFAULT_LANG='ar';
  const dictionaries={
    ar:{
      'Overview':'نظرة عامة','Projects':'المشروعات','Beneficiaries':'المستفيدون','Volunteers':'المتطوعون','Settings':'الإعدادات','View Website':'عرض الموقع','Finance Centre':'المركز المالي','Transparency & Reports':'الشفافية والتقارير','Project Transparency':'شفافية المشروعات','New Project':'مشروع جديد','Add Project':'إضافة مشروع','Platform Settings':'إعدادات بُنْيَان','Appearance, language and device settings.':'المظهر واللغة وإعدادات الجهاز.','Dark Mode':'الوضع الليلي','Improve readability in low light.':'تحسين القراءة في الإضاءة المنخفضة.','Enable Dark Mode':'تشغيل الوضع الليلي','Disable Dark Mode':'إيقاف الوضع الليلي','Language':'اللغة','Arabic is the primary interface, with instant translation for main headings.':'الواجهة العربية هي الأساسية، مع ترجمة فورية لجميع عناصر النظام.','Switch to English':'التبديل إلى الإنجليزية','App Update':'تحديث التطبيق','Check for Update':'التحقق من التحديث','Dashboard':'لوحة التحكم','Reports':'التقارير','Donations':'المساهمات','Expenses':'المصروفات','Documents':'المستندات','Logout':'تسجيل الخروج','Search':'بحث','Save':'حفظ','Cancel':'إلغاء','Delete':'حذف','Edit':'تعديل','Preview':'معاينة','Share Project':'مشاركة المشروع','Copy Link':'نسخ الرابط','Copied!':'تم النسخ!','Loading...':'جاري التحميل...','No data available':'لا توجد بيانات','Create Project':'إنشاء مشروع','Project Name':'اسم المشروع','Executive Summary':'الملخص التنفيذي','Status':'الحالة','Progress':'نسبة الإنجاز','Budget':'الميزانية','Currency':'العملة','Target Beneficiaries':'عدد المستفيدين المستهدف','Publish project on public website':'نشر المشروع في الموقع العام','Active':'نشط','Completed':'مكتمل','Paused':'متوقف مؤقتًا','Planning':'قيد التخطيط','Draft':'مسودة','Public':'منشور','Private':'غير منشور','English':'الإنجليزية','Arabic':'العربية','العربية / Switch to Arabic':'التبديل إلى العربية','English / التبديل عربي':'التبديل إلى الإنجليزية'
    },
    en:{
      'نظرة عامة':'Overview','المشروعات':'Projects','المستفيدون':'Beneficiaries','المتطوعون':'Volunteers','الإعدادات':'Settings','عرض الموقع':'View Website','المركز المالي':'Finance Centre','الشفافية والتقارير':'Transparency & Reports','شفافية المشروعات':'Project Transparency','مشروع جديد':'New Project','إضافة مشروع':'Add Project','إعدادات بُنْيَان':'Platform Settings','المظهر واللغة وإعدادات الجهاز.':'Appearance, language and device settings.','الوضع الليلي':'Dark Mode','تحسين القراءة في الإضاءة المنخفضة.':'Improve readability in low light.','تشغيل الوضع الليلي':'Enable Dark Mode','إيقاف الوضع الليلي':'Disable Dark Mode','اللغة':'Language','الواجهة العربية هي الأساسية، مع طبقة ترجمة فورية للعناوين الرئيسية.':'Arabic is the primary interface, with instant translation for main headings.','الواجهة العربية هي الأساسية، مع ترجمة فورية لجميع عناصر النظام.':'Arabic is the primary interface, with instant translation across the system.','التبديل عربي / English':'Switch to English','English / التبديل عربي':'Switch to English','التبديل إلى الإنجليزية':'Switch to English','التبديل إلى العربية':'Switch to Arabic','تحديث التطبيق':'App Update','التحقق من التحديث':'Check for Update','لوحة التحكم':'Dashboard','التقارير':'Reports','المساهمات':'Donations','المصروفات':'Expenses','المستندات':'Documents','تسجيل الخروج':'Logout','بحث':'Search','حفظ':'Save','إلغاء':'Cancel','حذف':'Delete','تعديل':'Edit','معاينة':'Preview','مشاركة المشروع':'Share Project','نسخ الرابط':'Copy Link','تم النسخ!':'Copied!','جاري التحميل...':'Loading...','لا توجد بيانات':'No data available','إنشاء مشروع':'Create Project','اسم المشروع':'Project Name','الملخص التنفيذي':'Executive Summary','الحالة':'Status','نسبة الإنجاز':'Progress','الميزانية':'Budget','العملة':'Currency','عدد المستفيدين المستهدف':'Target Beneficiaries','نشر المشروع في الموقع العام':'Publish project on public website','نشط':'Active','مكتمل':'Completed','متوقف مؤقتاً':'Paused','متوقف مؤقتًا':'Paused','قيد التخطيط':'Planning','مسودة':'Draft','منشور':'Public','غير منشور':'Private','الإنجليزية':'English','العربية':'Arabic'
    }
  };

  let lang=localStorage.getItem(STORAGE_KEY)||DEFAULT_LANG;
  const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();

  function translateText(text){
    const clean=normalize(text);
    if(!clean)return text;
    const translated=dictionaries[lang][clean];
    if(!translated)return text;
    const leading=String(text).match(/^\s*/)?.[0]||'';
    const trailing=String(text).match(/\s*$/)?.[0]||'';
    return leading+translated+trailing;
  }

  function translateElement(el){
    if(!el||el.closest('[data-no-i18n]'))return;
    if(el.nodeType===Node.TEXT_NODE){
      const parent=el.parentElement;
      if(!parent||['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))return;
      const next=translateText(el.nodeValue);
      if(next!==el.nodeValue)el.nodeValue=next;
      return;
    }
    if(el.nodeType!==Node.ELEMENT_NODE)return;
    ['placeholder','title','aria-label'].forEach(attr=>{
      if(el.hasAttribute(attr)){
        const current=el.getAttribute(attr);
        const next=translateText(current);
        if(next!==current)el.setAttribute(attr,next);
      }
    });
  }

  function walk(root=document.body){
    if(!root)return;
    translateElement(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode()))translateElement(node);
    refreshLanguageButtons();
  }

  function refreshLanguageButtons(){
    document.querySelectorAll('button,a').forEach(el=>{
      const text=normalize(el.textContent);
      if(/English|العربية|التبديل|Switch to/i.test(text)){
        if(el.closest('.language-card,.settings-card')||/English|التبديل عربي|Switch to Arabic|Switch to English/i.test(text)){
          el.dataset.languageToggle='true';
          el.textContent=lang==='ar'?'Switch to English':'التبديل إلى العربية';
          el.setAttribute('aria-label',el.textContent);
        }
      }
    });
  }

  function applyLanguage(next,rerender=true){
    lang=next==='en'?'en':'ar';
    localStorage.setItem(STORAGE_KEY,lang);
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.body?.classList.toggle('lang-en',lang==='en');
    document.body?.classList.toggle('lang-ar',lang==='ar');
    if(rerender)walk(document.body);
    window.dispatchEvent(new CustomEvent('bunyan:languagechange',{detail:{lang}}));
  }

  document.addEventListener('click',e=>{
    const toggle=e.target.closest('[data-language-toggle="true"]');
    if(!toggle)return;
    e.preventDefault();
    applyLanguage(lang==='ar'?'en':'ar');
  });

  const observer=new MutationObserver(records=>{
    records.forEach(r=>r.addedNodes.forEach(node=>{
      if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE)walk(node.nodeType===Node.ELEMENT_NODE?node:node.parentElement);
    }));
  });

  function init(){
    applyLanguage(lang,false);
    walk(document.body);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.BunyanI18n={get language(){return lang},setLanguage:applyLanguage,t:(key)=>dictionaries[lang][key]||key};
})();