(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('lang');
  const desired=requested==='en'?'en':'ar';
  const KEY='bunyan_language';
  let applying=false;

  const enforce=()=>{
    if(applying)return;
    applying=true;
    try{
      localStorage.setItem(KEY,desired);
      document.documentElement.lang=desired;
      document.documentElement.dir=desired==='ar'?'rtl':'ltr';
      document.body?.setAttribute('dir',desired==='ar'?'rtl':'ltr');
      if(window.BunyanI18n?.getLanguage?.()!==desired){
        window.BunyanI18n?.setLanguage?.(desired);
      }else{
        window.BunyanI18n?.refresh?.();
      }
      document.querySelectorAll('[data-set-language]').forEach(el=>{
        const active=el.getAttribute('data-set-language')===desired;
        el.classList.toggle('active',active);
        el.setAttribute('aria-pressed',active?'true':'false');
      });
    }finally{
      applying=false;
    }
  };

  enforce();
  window.addEventListener('bunyan:ready',enforce);
  window.addEventListener('bunyan:languagechange',()=>{
    if(window.BunyanI18n?.getLanguage?.()!==desired)enforce();
  });
  const observer=new MutationObserver(()=>requestAnimationFrame(enforce));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(enforce,100);
  setTimeout(enforce,500);
  setTimeout(enforce,1500);
})();
