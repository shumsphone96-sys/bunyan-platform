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

  const release='20260728-global-i18n-1';
  loadStyle(`./project-center.css?v=${release}`,'project-center-style');
  loadStyle(`./financial-center.css?v=${release}`,'financial-center-style');
  loadStyle(`./global-suite.css?v=${release}`,'global-suite-style');
  loadStyle(`./project-transparency.css?v=${release}`,'project-transparency-style');
  loadStyle(`./completion-suite.css?v=${release}`,'completion-suite-style');
  loadStyle(`./project-operations.css?v=${release}`,'project-operations-style');
  loadStyle(`./copy-link.css?v=${release}`,'copy-link-style');
  loadStyle(`./mobile-admin-fix.css?v=${release}`,'mobile-admin-fix-style');
  loadStyle(`./i18n-global.css?v=${release}`,'i18n-global-style');
  loadScript(`./i18n-global.js?v=${release}`,'i18n-global');
  loadScript(`./global-upgrade.js?v=${release}`,'global-manager');
  loadScript(`./quick-project.js?v=${release}`,'quick-project');
  loadScript(`./project-center.js?v=${release}`,'project-center');
  loadScript(`./financial-center.js?v=${release}`,'financial-center');
  loadScript(`./global-admin.js?v=${release}`,'global-admin');
  loadScript(`./global-suite.js?v=${release}`,'global-suite');
  loadScript(`./project-transparency.js?v=${release}`,'project-transparency');
  loadScript(`./completion-suite.js?v=${release}`,'completion-suite');
  loadScript(`./project-operations.js?v=${release}`,'project-operations');
  loadScript(`./copy-link.js?v=${release}`,'copy-link');
  loadScript(`./mobile-admin-fix.js?v=${release}`,'mobile-admin-fix');
})();