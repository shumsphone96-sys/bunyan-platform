(()=>{
  const KEY='bunyan_language';
  const AR='ar', EN='en';
  let lang=localStorage.getItem(KEY)===EN?EN:AR;

  const pairs=[
    ['Overview','نظرة عامة'],['Projects','المشروعات'],['Beneficiaries','المستفيدون'],['Volunteers','المتطوعون'],
    ['Settings','الإعدادات'],['View Website','عرض الموقع'],['Finance Centre','المركز المالي'],
    ['Transparency & Reports','الشفافية والتقارير'],['Project Transparency','شفافية المشروعات'],
    ['New Project','مشروع جديد'],['Add Project','إضافة مشروع'],['Dashboard','لوحة التحكم'],['Reports','التقارير'],
    ['Donations','المساهمات'],['Expenses','المصروفات'],['Documents','المستندات'],['Logout','تسجيل الخروج'],
    ['Platform Settings','إعدادات بُنْيَان'],['Appearance, language and device settings.','المظهر واللغة وإعدادات الجهاز.'],
    ['Dark Mode','الوضع الليلي'],['Improve readability in low light.','تحسين القراءة في الإضاءة المنخفضة.'],
    ['Enable Dark Mode','تشغيل الوضع الليلي'],['Disable Dark Mode','إيقاف الوضع الليلي'],['Language','اللغة'],
    ['Arabic is the primary interface, with instant translation across the system.','الواجهة العربية هي الأساسية، مع ترجمة فورية لجميع عناصر النظام.'],
    ['App Update','تحديث التطبيق'],['Check for Update','التحقق من التحديث'],['Search','بحث'],['Save','حفظ'],
    ['Cancel','إلغاء'],['Delete','حذف'],['Edit','تعديل'],['Preview','معاينة'],['Share Project','مشاركة المشروع'],
    ['Copy Link','نسخ الرابط'],['Copied!','تم النسخ!'],['Loading...','جاري التحميل...'],['No data available','لا توجد بيانات'],
    ['Create Project','إنشاء مشروع'],['Project Name','اسم المشروع'],['Executive Summary','الملخص التنفيذي'],
    ['Status','الحالة'],['Progress','نسبة الإنجاز'],['Budget','الميزانية'],['Currency','العملة'],
    ['Target Beneficiaries','عدد المستفيدين المستهدف'],['Publish project on public website','نشر المشروع في الموقع العام'],
    ['Active','نشط'],['Completed','مكتمل'],['Paused','متوقف مؤقتًا'],['Planning','قيد التخطيط'],
    ['Draft','مسودة'],['Public','منشور'],['Private','غير منشور'],['Project expenses and documents','مصروفات المشروع ومستنداته'],
    ['Add expense','إضافة مصروف'],['Upload document','رفع مستند'],['Amount','المبلغ'],['Date','التاريخ'],
    ['Category','التصنيف'],['Notes','ملاحظات'],['File','الملف'],['Download','تنزيل'],['Receipt','فاتورة أو إيصال']
  ];

  const arToEn=new Map(pairs.map(([en,ar])=>[ar,en]));
  const enToAr=new Map(pairs.map(([en,ar])=>[en,ar]));
  const normalize=v=>String(v??'').replace(/\s+/g,' ').trim();
  const isToggleText=t=>/English|العربية|التبديل|Switch\s+to/i.test(t);

  function translated(value){
    const clean=normalize(value);
    if(!clean)return value;
    const next=(lang===EN?arToEn:enToAr).get(clean);
    if(!next)return value;
    const source=String(value);
    return (source.match(/^\s*/)?.[0]||'')+next+(source.match(/\s*$/)?.[0]||'');
  }

  function translateNode(node){
    if(!node)return;
    if(node.nodeType===Node.TEXT_NODE){
      const p=node.parentElement;
      if(!p||p.closest('[data-no-i18n]')||['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName))return;
      const next=translated(node.nodeValue);
      if(next!==node.nodeValue)node.nodeValue=next;
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE||node.closest('[data-no-i18n]'))return;
    ['placeholder','title','aria-label','value'].forEach(attr=>{
      if(node.hasAttribute(attr)&&!(attr==='value'&&!['BUTTON','INPUT'].includes(node.tagName))){
        const old=node.getAttribute(attr),next=translated(old);
        if(next!==old)node.setAttribute(attr,next);
      }
    });
  }

  function markAndRefreshToggle(){
    document.querySelectorAll('button,a').forEach(el=>{
      const t=normalize(el.textContent);
      const inLanguageArea=!!el.closest('.language-card,.settings-card,[data-setting="language"]');
      if(inLanguageArea&&isToggleText(t) || /التبديل عربي\s*\/\s*English|English\s*\/\s*التبديل عربي|Switch to English|Switch to Arabic|التبديل إلى الإنجليزية|التبديل إلى العربية/i.test(t)){
        el.dataset.languageToggle='true';
        el.textContent=lang===AR?'Switch to English':'التبديل إلى العربية';
        el.setAttribute('aria-label',el.textContent);
      }
    });
  }

  function apply(root=document.body){
    if(!root)return;
    translateNode(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let n; while((n=walker.nextNode()))translateNode(n);
    markAndRefreshToggle();
  }

  function setLanguage(next){
    lang=next===EN?EN:AR;
    localStorage.setItem(KEY,lang);
    document.documentElement.lang=lang;
    document.documentElement.dir=lang===AR?'rtl':'ltr';
    document.body?.classList.toggle('lang-en',lang===EN);
    document.body?.classList.toggle('lang-ar',lang===AR);
    apply(document.body);
    window.dispatchEvent(new CustomEvent('bunyan:languagechange',{detail:{lang}}));
  }

  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a');
    if(!el)return;
    const text=normalize(el.textContent);
    if(el.dataset.languageToggle==='true'||isToggleText(text)&&!!el.closest('.language-card,.settings-card,[data-setting="language"]')){
      e.preventDefault();
      e.stopImmediatePropagation();
      setLanguage(lang===AR?EN:AR);
    }
  },true);

  let queued=false;
  const observer=new MutationObserver(records=>{
    if(queued)return; queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      records.forEach(r=>r.addedNodes.forEach(n=>{
        if(n.nodeType===Node.ELEMENT_NODE)apply(n);
        else if(n.nodeType===Node.TEXT_NODE)translateNode(n);
      }));
      markAndRefreshToggle();
    });
  });

  function init(){
    setLanguage(lang);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.BunyanI18n={get language(){return lang},setLanguage,t:key=>(lang===EN?arToEn:enToAr).get(key)||key};
})();
