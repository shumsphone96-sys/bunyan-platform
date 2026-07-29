(()=>{
  'use strict';
  const menu=document.getElementById('menu');
  const nav=document.getElementById('nav');
  if(!menu||!nav)return;

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

  // Capture first and stop the legacy onclick handler from toggling the menu a second time.
  menu.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    setOpen(!nav.classList.contains('open'));
  },true);

  nav.addEventListener('click',e=>{
    if(e.target.closest('a,#adminBtn'))setOpen(false);
  });

  document.addEventListener('click',e=>{
    if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menu.contains(e.target))setOpen(false);
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')setOpen(false);
  });

  window.addEventListener('resize',()=>{
    if(innerWidth>900)setOpen(false);
  });

  window.addEventListener('bunyan:languagechange',()=>setOpen(nav.classList.contains('open')));
  setOpen(false);
})();