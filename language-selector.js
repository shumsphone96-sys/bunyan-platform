(()=>{
  'use strict';
  const current=()=>new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
  const hrefFor=lang=>{
    const url=new URL(location.href);
    url.searchParams.set('lang',lang);
    url.searchParams.set('v','20260729-url-language-final-1');
    return url.pathname+url.search+url.hash;
  };
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
      const admin=document.getElementById('adminBtn');
      nav.insertBefore(wrap,admin||null);
    }
    wrap.innerHTML=`<a data-set-language="ar" href="${hrefFor('ar')}">العربية</a><a data-set-language="en" href="${hrefFor('en')}">English</a>`;
    const active=current();
    wrap.querySelectorAll('[data-set-language]').forEach(link=>{
      const isActive=link.dataset.setLanguage===active;
      link.classList.toggle('active',isActive);
      link.setAttribute('aria-current',isActive?'true':'false');
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('bunyan:ready',mount);
})();
