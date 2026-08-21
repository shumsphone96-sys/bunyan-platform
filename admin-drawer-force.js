(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const isAdminOpen=()=>$('#dash')?.classList.contains('open')||$('#dash')?.classList.contains('show');
  const aside=()=>$('#dash aside');
  const menu=()=>$('#menu');

  const style=document.createElement('style');
  style.textContent=`
  @media(max-width:900px){
    #dash{z-index:2147483000!important;overflow:visible!important;}
    #dash aside{
      position:fixed!important;
      top:0!important;
      right:0!important;
      left:auto!important;
      bottom:0!important;
      width:min(84vw,340px)!important;
      height:100dvh!important;
      max-height:100dvh!important;
      z-index:2147483646!important;
      display:flex!important;
      visibility:visible!important;
      opacity:1!important;
      pointer-events:auto!important;
      flex-direction:column!important;
      overflow-y:auto!important;
      transform:translate3d(110%,0,0)!important;
      transition:transform .22s ease!important;
      background:#071a17!important;
      box-shadow:-18px 0 50px rgba(0,0,0,.35)!important;
      -webkit-overflow-scrolling:touch!important;
    }
    #dash aside.admin-drawer-open{
      transform:translate3d(0,0,0)!important;
      visibility:visible!important;
      opacity:1!important;
    }
    body.admin-drawer-visible{overflow:hidden!important;}
    body.admin-drawer-visible:after{
      content:''!important;
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.48)!important;
      z-index:2147483600!important;
      pointer-events:auto!important;
    }
  }`;
  document.head.appendChild(style);

  function close(){
    aside()?.classList.remove('admin-drawer-open');
    document.body.classList.remove('admin-drawer-visible');
  }
  function toggle(e){
    if(!isAdminOpen())return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const a=aside();
    if(!a)return;
    const opening=!a.classList.contains('admin-drawer-open');
    close();
    if(opening){
      a.classList.add('admin-drawer-open');
      document.body.classList.add('admin-drawer-visible');
    }
  }
  function install(){
    const m=menu();
    if(!m||m.dataset.drawerForceBound)return;
    m.dataset.drawerForceBound='1';
    m.addEventListener('click',toggle,true);
  }

  document.addEventListener('click',e=>{
    if(!isAdminOpen())return;
    const a=aside();
    if(!a?.classList.contains('admin-drawer-open'))return;
    if(e.target.closest('#dash aside')||e.target.closest('#menu'))return;
    close();
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('bunyan:ready',install);
  setTimeout(install,500);
  setTimeout(install,1500);
  window.BunyanAdminDrawerForce={install,close};
})();