(()=>{
  const translations=new Map([
    ['Overview','نظرة عامة'],['Projects','المشروعات'],['Beneficiaries','المستفيدون'],['Volunteers','المتطوعون'],['Settings','الإعدادات'],['View Website','عرض الموقع'],['English / التبديل عربي','التبديل إلى الإنجليزية'],['English','الإنجليزية']
  ]);
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  function translate(root=document){
    root.querySelectorAll('button,a,[role="tab"],h1,h2,h3,span').forEach(el=>{
      if(el.children.length>0&&![...el.children].every(c=>c.tagName==='SVG'))return;
      const key=norm(el.textContent);
      if(translations.has(key))el.textContent=translations.get(key);
    });
  }
  function tagLayout(root=document){
    document.documentElement.lang='ar';
    document.documentElement.dir='rtl';
    document.body?.classList.add('bunyan-rtl');

    root.querySelectorAll('nav,.top-nav,.tabs,[role="tablist"]').forEach(el=>el.classList.add('bunyan-mobile-tabs'));

    root.querySelectorAll('h1,h2').forEach(title=>{
      const text=norm(title.textContent);
      if(text==='الإعدادات'||text==='Settings')title.parentElement?.classList.add('bunyan-page-heading');
    });

    root.querySelectorAll('button,a').forEach(el=>{
      const text=norm(el.textContent);
      if(text.includes('شفافية المشروعات')||text.includes('مشروع جديد')){
        el.classList.add('bunyan-floating-action');
        const parent=el.parentElement;
        if(parent&&parent.children.length<=3)parent.classList.add('bunyan-action-host');
      }
      if(text.includes('التبديل')||text==='الإنجليزية')el.classList.add('bunyan-language-button');
    });
  }
  function apply(){translate();tagLayout();}
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply();});
  });
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',apply);
  apply();
})();
