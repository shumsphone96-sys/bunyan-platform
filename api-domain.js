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

  const loadScript=(src,key)=>{
    if(document.querySelector(`script[data-bunyan-${key}]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.defer=true;
    script.dataset[`bunyan${key[0].toUpperCase()+key.slice(1)}`]='true';
    script.onerror=()=>console.error(`تعذر تحميل ${src}`);
    document.head.appendChild(script);
  };

  loadScript('./global-upgrade.js?v=20260726-2057','globalManager');
  loadScript('./quick-project.js?v=20260726-2103','quickProject');
})();