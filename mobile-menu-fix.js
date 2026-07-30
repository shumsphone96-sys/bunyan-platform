(()=>{
  'use strict';
  const menu=document.getElementById('menu');
  const nav=document.getElementById('nav');
  if(!menu||!nav)return;

  const setOpen=open=>{
    nav.classList.toggle('open',open);
    menu.setAttribute('aria-expanded',String(open));
    menu.textContent=open?'×':'☰';
  };

  menu.setAttribute('aria-controls','nav');
  menu.setAttribute('aria-expanded','false');

  menu.addEventListener('click',event=>{
    event.stopPropagation();
    setOpen(!nav.classList.contains('open'));
  });

  nav.addEventListener('click',event=>event.stopPropagation());
  document.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false)});

  nav.querySelectorAll('a:not([data-lang-link])').forEach(link=>{
    link.addEventListener('click',()=>setOpen(false));
  });

  const current=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
  nav.querySelectorAll('[data-lang-link]').forEach(link=>{
    const active=link.dataset.langLink===current;
    link.classList.toggle('active',active);
    link.setAttribute('aria-current',active?'true':'false');
    link.addEventListener('click',()=>sessionStorage.setItem('bunyan_keep_menu_open','1'));
  });

  if(sessionStorage.getItem('bunyan_keep_menu_open')==='1'){
    sessionStorage.removeItem('bunyan_keep_menu_open');
    setOpen(true);
  }
})();
