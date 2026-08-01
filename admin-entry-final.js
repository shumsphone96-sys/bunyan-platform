(()=>{
  'use strict';

  function openAdmin(event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    document.getElementById('nav')?.classList.remove('open');
    const token=sessionStorage.getItem('bunyan_token');
    const dash=document.getElementById('dash');
    const login=document.getElementById('login');

    if(token){
      login?.classList.remove('open');
      dash?.classList.add('open');
      window.openExecutiveDashboard?.();
      setTimeout(()=>window.openExecutiveDashboard?.(),250);
    }else{
      dash?.classList.remove('open');
      login?.classList.add('open');
    }
  }

  function install(){
    const btn=document.getElementById('adminBtn');
    if(!btn)return;
    btn.onclick=null;
    btn.addEventListener('click',openAdmin,true);
    btn.dataset.adminEntryFinal='true';
    btn.textContent='لوحة الإدارة';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.addEventListener('bunyan:ready',install);
  setTimeout(install,1200);
  setTimeout(install,3000);
  window.BunyanAdminEntryFinal={open:openAdmin,install};
})();
