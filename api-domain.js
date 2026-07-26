(()=>{
  const official='https://api.bunyan-sudan.org';
  const render='https://bunyan-api-qhkf.onrender.com';
  window.BUNYAN_API_ORIGINS=[official,render];
  window.BUNYAN_API_ORIGIN=official;

  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations()
      .then(registrations=>Promise.all(registrations.map(r=>r.unregister())))
      .catch(()=>{});
  }

  const loadStyle=(href,key)=>{
    if(document.querySelector(`link[data-bunyan-module="${key}"]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.bunyanModule=key;
    document.head.appendChild(link);
  };

  const loadScript=(src,key)=>{
    if(document.querySelector(`script[data-bunyan-module="${key}"]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.defer=true;
    script.dataset.bunyanModule=key;
    script.onerror=()=>console.error(`تعذر تحميل ${src}`);
    document.head.appendChild(script);
  };

  loadStyle('./project-center.css?v=20260726-2305','project-center-style');
  loadScript('./global-upgrade.js?v=20260726-2057','global-manager');
  loadScript('./quick-project.js?v=20260726-2130','quick-project');
  loadScript('./project-center.js?v=20260726-2305','project-center');
})();