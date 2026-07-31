(()=>{
  'use strict';
  const menu=document.getElementById('menu');
  const nav=document.getElementById('nav');
  if(!menu||!nav)return;

  const readLanguage=()=>{
    const q=new URLSearchParams(location.search).get('lang');
    if(q==='en'||q==='ar')return q;
    const stored=localStorage.getItem('bunyan_language')||localStorage.getItem('bunyan_lang');
    if(stored==='en'||stored==='ar')return stored;
    return document.documentElement.lang?.toLowerCase().startsWith('en')?'en':'ar';
  };
  const lang=readLanguage();
  const labels={
    ar:{about:'من نحن',programs:'البرامج',projects:'المشروعات',news:'الأخبار',join:'شارك معنا',contact:'اتصل بنا',impact:'الأثر',transparency:'الشفافية',admin:'لوحة الإدارة',brand:'بُنْيَان',sub:'مؤسسة شمس الأنبياء للتنمية',arabic:'العربية',english:'الإنجليزية'},
    en:{about:'About Us',programs:'Programs',projects:'Projects',news:'News',join:'Join Us',contact:'Contact Us',impact:'Impact',transparency:'Transparency',admin:'Admin Dashboard',brand:'BUNYAN',sub:'Shams Al-Anbiya Foundation for Development',arabic:'Arabic',english:'English'}
  }[lang];

  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  localStorage.setItem('bunyan_language',lang);

  const applyLabels=()=>{
    const map=[
      ['#about',labels.about],['#programs',labels.programs],['#projects',labels.projects],
      ['#news',labels.news],['#join',labels.join],['#contact',labels.contact],
      ['#impact',labels.impact],['#transparency',labels.transparency]
    ];
    nav.querySelectorAll('a').forEach(a=>{
      const href=a.getAttribute('href')||'';
      for(const [fragment,text] of map){if(href===fragment||href.endsWith(fragment)){a.textContent=text;break;}}
    });
    const admin=document.getElementById('adminBtn');if(admin)admin.textContent=labels.admin;
    const brand=document.querySelector('body>header .brand strong');if(brand)brand.textContent=labels.brand;
    const sub=document.querySelector('body>header .brand small');if(sub)sub.textContent=labels.sub;
    nav.querySelectorAll('[data-lang-link]').forEach(a=>{
      const code=a.dataset.langLink;
      a.textContent=code==='ar'?labels.arabic:labels.english;
      const active=code===lang;
      a.classList.toggle('active',active);
      a.setAttribute('aria-current',active?'true':'false');
    });
  };

  applyLabels();
  [50,200,600,1200].forEach(ms=>setTimeout(applyLabels,ms));
  const observer=new MutationObserver(()=>applyLabels());
  observer.observe(nav,{subtree:true,childList:true,characterData:true});

  nav.querySelectorAll('[data-lang-link]').forEach(a=>a.addEventListener('click',()=>sessionStorage.setItem('bunyan_menu_reopen','1')));

  const setOpen=open=>{
    nav.classList.toggle('open',open);
    document.body.classList.toggle('menu-open',open);
    menu.setAttribute('aria-expanded',String(open));
  };
  menu.setAttribute('aria-controls','nav');
  menu.setAttribute('aria-expanded','false');
  menu.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();setOpen(!nav.classList.contains('open'));
  },true);
  nav.addEventListener('click',e=>{if(e.target.closest('a:not([data-lang-link]),#adminBtn'))setOpen(false);},true);
  document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menu.contains(e.target))setOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  if(sessionStorage.getItem('bunyan_menu_reopen')==='1'){
    sessionStorage.removeItem('bunyan_menu_reopen');setTimeout(()=>setOpen(true),80);
  }else setOpen(false);
})();