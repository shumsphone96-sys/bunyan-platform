(()=>{
  'use strict';
  const KEY='bunyan_language';
  const mount=()=>{
    const nav=document.getElementById('nav');
    if(!nav)return;
    let wrap=document.getElementById('languageSelector');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='languageSelector';
      wrap.className='language-selector';
      wrap.setAttribute('role','group');
      wrap.setAttribute('aria-label','Language selector');
      wrap.setAttribute('data-no-i18n','true');
      wrap.innerHTML='<button type="button" data-set-language="ar">العربية</button><button type="button" data-set-language="en">English</button>';
      const admin=document.getElementById('adminBtn');
      nav.insertBefore(wrap,admin||null);
    }
    const refresh=()=>{
      const current=localStorage.getItem(KEY)==='en'?'en':'ar';
      wrap.querySelectorAll('[data-set-language]').forEach(btn=>{
        const active=btn.dataset.setLanguage===current;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-pressed',active?'true':'false');
      });
    };
    wrap.addEventListener('click',e=>{
      const btn=e.target.closest('[data-set-language]');
      if(!btn)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const next=btn.dataset.setLanguage==='en'?'en':'ar';
      localStorage.setItem(KEY,next);
      document.documentElement.lang=next;
      document.documentElement.dir=next==='ar'?'rtl':'ltr';
      const url=new URL(location.href);
      url.searchParams.set('lang',next);
      url.searchParams.set('v','20260729-language-reload-fix-1');
      location.replace(url.toString());
    },true);
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('bunyan:ready',mount);
})();