(()=>{
  'use strict';
  const menu=document.getElementById('menu');
  const nav=document.getElementById('nav');
  if(!menu||!nav)return;

  const adminIsOpen=()=>{
    const dash=document.getElementById('dash');
    return !!dash&&(dash.classList.contains('open')||dash.classList.contains('show'));
  };

  const setOpen=open=>{
    nav.classList.toggle('open',open);
    document.body.classList.toggle('menu-open',open);
    menu.setAttribute('aria-expanded',open?'true':'false');
    menu.setAttribute('aria-label',open
      ?(window.BunyanI18n?.getLanguage?.()==='en'?'Close menu':'إغلاق القائمة')
      :(window.BunyanI18n?.getLanguage?.()==='en'?'Open menu':'فتح القائمة'));
  };

  menu.setAttribute('aria-controls','nav');
  menu.setAttribute('aria-expanded','false');

  menu.addEventListener('click',e=>{
    if(adminIsOpen())return;
    e.preventDefault();
    e.stopImmediatePropagation();
    setOpen(!nav.classList.contains('open'));
  },true);

  nav.addEventListener('click',e=>{
    const languageLink=e.target.closest('[data-lang-link]');
    if(languageLink){
      sessionStorage.setItem('bunyan_keep_menu_open','1');
      return;
    }
    if(e.target.closest('a,#adminBtn'))setOpen(false);
  });

  document.addEventListener('click',e=>{
    if(adminIsOpen())return;
    if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menu.contains(e.target))setOpen(false);
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')setOpen(false);
  });

  window.addEventListener('resize',()=>{
    if(innerWidth>900)setOpen(false);
  });

  const current=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
  nav.querySelectorAll('[data-lang-link]').forEach(link=>{
    const active=link.dataset.langLink===current;
    link.classList.toggle('active',active);
    link.setAttribute('aria-current',active?'true':'false');
  });

  window.addEventListener('bunyan:languagechange',()=>setOpen(nav.classList.contains('open')));
  if(sessionStorage.getItem('bunyan_keep_menu_open')==='1'){
    sessionStorage.removeItem('bunyan_keep_menu_open');
    setOpen(true);
  }else setOpen(false);
})();
