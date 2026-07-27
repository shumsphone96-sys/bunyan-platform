(()=>{
  function openProjectEditor(){
    if(typeof window.openGlobalProjectEditor==='function'){
      window.openGlobalProjectEditor();
      return;
    }
    const wait=setInterval(()=>{
      if(typeof window.openGlobalProjectEditor==='function'){
        clearInterval(wait);
        window.openGlobalProjectEditor();
      }
    },100);
    setTimeout(()=>clearInterval(wait),5000);
  }

  function install(){
    const dash=document.getElementById('dash');
    if(!dash)return;
    let btn=document.getElementById('quickProjectBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='quickProjectBtn';
      btn.type='button';
      btn.textContent='+ مشروع جديد';
      btn.style.cssText='position:fixed;left:18px;bottom:86px;z-index:9998;border:0;border-radius:999px;padding:14px 20px;background:linear-gradient(135deg,#d7aa4b,#f0d084);color:#211604;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none';
      document.body.appendChild(btn);
    }
    btn.onclick=openProjectEditor;
    const sync=()=>{
      const isOpen=dash.classList.contains('open')||dash.classList.contains('show');
      const projectsActive=document.querySelector('[data-view="projects"].active,[data-view="projects"][aria-current="page"]');
      btn.style.display=isOpen&&!projectsActive?'block':'none';
    };
    new MutationObserver(sync).observe(dash,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view]'))setTimeout(sync,50)});
    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.openQuickProjectEditor=openProjectEditor;
})();