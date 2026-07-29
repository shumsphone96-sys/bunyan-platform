(()=>{
  'use strict';
  const mount=()=>{
    const nav=document.getElementById('nav');
    const api=window.BunyanI18n;
    if(!nav||!api)return;
    let wrap=document.getElementById('languageSelector');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='languageSelector';
      wrap.className='language-selector';
      wrap.setAttribute('role','group');
      wrap.setAttribute('aria-label','Language selector');
      wrap.innerHTML='<button type="button" data-set-language="ar">العربية</button><button type="button" data-set-language="en">English</button>';
      const admin=document.getElementById('adminBtn');
      nav.insertBefore(wrap,admin||null);
    }
    const refresh=()=>{
      const current=api.getLanguage();
      wrap.querySelectorAll('[data-set-language]').forEach(btn=>{
        const active=btn.dataset.setLanguage===current;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-pressed',active?'true':'false');
      });
    };
    wrap.onclick=e=>{
      const btn=e.target.closest('[data-set-language]');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      api.setLanguage(btn.dataset.setLanguage);
      refresh();
    };
    window.addEventListener('bunyan:languagechange',refresh);
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('bunyan:ready',mount);
})();
