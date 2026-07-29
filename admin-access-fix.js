(()=>{
  'use strict';

  const currentLanguage=()=>new URLSearchParams(location.search).get('lang')==='en'?'en':'ar';
  const goToAdmin=()=>{
    const lang=currentLanguage();
    location.href=`./admin.html?lang=${lang}`;
  };

  document.addEventListener('click',event=>{
    if(!event.target.closest?.('#adminBtn'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goToAdmin();
  },true);

  const init=()=>{
    const admin=document.getElementById('adminBtn');
    if(admin){
      admin.setAttribute('aria-label',currentLanguage()==='en'?'Open admin sign in':'فتح تسجيل دخول الإدارة');
      admin.setAttribute('data-admin-route','standalone');
    }
    window.BunyanAdminAccess={open:goToAdmin};
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
