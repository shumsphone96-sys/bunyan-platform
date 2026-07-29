(()=>{
  'use strict';

  const openLogin=()=>{
    const login=document.getElementById('login');
    const nav=document.getElementById('nav');
    if(!login)return;
    nav?.classList.remove('open');
    document.body.classList.remove('menu-open');
    login.classList.add('open');
    login.setAttribute('aria-hidden','false');
    document.body.classList.add('admin-login-open');
    requestAnimationFrame(()=>login.querySelector('input[name="email"]')?.focus());
  };

  const closeLogin=()=>{
    const login=document.getElementById('login');
    if(!login)return;
    login.classList.remove('open');
    login.setAttribute('aria-hidden','true');
    document.body.classList.remove('admin-login-open');
  };

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#adminBtn')){
      event.preventDefault();
      event.stopImmediatePropagation();
      openLogin();
      return;
    }
    if(event.target.closest?.('#close')){
      event.preventDefault();
      event.stopImmediatePropagation();
      closeLogin();
      return;
    }
    if(event.target?.id==='login')closeLogin();
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.getElementById('login')?.classList.contains('open'))closeLogin();
  });

  const init=()=>{
    const login=document.getElementById('login');
    const admin=document.getElementById('adminBtn');
    if(login)login.setAttribute('aria-hidden',login.classList.contains('open')?'false':'true');
    if(admin){admin.setAttribute('aria-haspopup','dialog');admin.setAttribute('aria-controls','login');}
    window.BunyanAdminAccess={open:openLogin,close:closeLogin};
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();