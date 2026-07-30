(()=>{
  'use strict';
  const menu=document.getElementById('menu');
  const nav=document.getElementById('nav');
  if(!menu||!nav)return;
  const lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
  const labels=lang==='en'
    ?{about:'About Us',programs:'Programs',projects:'Projects',news:'News',join:'Join Us',contact:'Contact Us',admin:'Admin Dashboard',brand:'BUNYAN',sub:'Shams Al-Anbiya Foundation for Development'}
    :{about:'من نحن',programs:'البرامج',projects:'المشروعات',news:'الأخبار',join:'شارك معنا',contact:'اتصل بنا',admin:'لوحة الإدارة',brand:'بُنْيَان',sub:'مؤسسة شمس الأنبياء للتنمية'};
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const byHref={
    '#about':labels.about,
    '#programs':labels.programs,
    '#projects':labels.projects,
    '#news':labels.news,
    '#join':labels.join,
    '#contact':labels.contact
  };
  nav.querySelectorAll('a[href^="#"]').forEach(a=>{if(byHref[a.getAttribute('href')])a.textContent=byHref[a.getAttribute('href')];});
  const admin=document.getElementById('adminBtn');if(admin)admin.textContent=labels.admin;
  const brand=document.querySelector('body>header .brand strong');if(brand)brand.textContent=labels.brand;
  const sub=document.querySelector('body>header .brand small');if(sub)sub.textContent=labels.sub;
  nav.querySelectorAll('[data-lang-link]').forEach(a=>{
    const active=a.dataset.langLink===lang;
    a.classList.toggle('active',active);
    a.setAttribute('aria-current',active?'true':'false');
    a.addEventListener('click',()=>sessionStorage.setItem('bunyan_menu_reopen','1'));
  });
  const setOpen=open=>{
    nav.classList.toggle('open',open);
    document.body.classList.toggle('menu-open',open);
    menu.setAttribute('aria-expanded',String(open));
  };
  menu.setAttribute('aria-controls','nav');
  menu.setAttribute('aria-expanded','false');
  menu.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    setOpen(!nav.classList.contains('open'));
  },true);
  nav.addEventListener('click',e=>{
    if(e.target.closest('a:not([data-lang-link]),#adminBtn'))setOpen(false);
  },true);
  document.addEventListener('click',e=>{
    if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menu.contains(e.target))setOpen(false);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  if(sessionStorage.getItem('bunyan_menu_reopen')==='1'){
    sessionStorage.removeItem('bunyan_menu_reopen');
    setTimeout(()=>setOpen(true),80);
  }else setOpen(false);
})();
