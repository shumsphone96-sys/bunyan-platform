(()=>{
  'use strict';

  const official='https://api.bunyan-sudan.org';
  const render='https://bunyan-api-qhkf.onrender.com';
  const release='20260801-admin-navigation-final-1';

  window.BUNYAN_API_ORIGINS=[official,render];
  window.BUNYAN_API_ORIGIN=official;
  window.BUNYAN_RELEASE=release;

  document.documentElement.classList.add('bunyan-loading');
  const reveal=()=>{
    document.documentElement.classList.remove('bunyan-loading');
    document.documentElement.classList.add('bunyan-ready');
    if(document.body){document.body.style.visibility='visible';document.body.style.opacity='1';}
  };

  window.addEventListener('error',event=>{console.error('BUNYAN frontend error:',event.error||event.message);reveal();});
  window.addEventListener('unhandledrejection',event=>{console.error('BUNYAN rejected promise:',event.reason);reveal();});
  setTimeout(reveal,2500);

  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(registrations=>Promise.all(registrations.map(r=>r.unregister()))).catch(()=>{});
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{});
  }

  const loadStyle=(file,key)=>{
    if(document.querySelector(`link[data-bunyan-module="${key}"]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=`./${file}?v=${release}`;link.dataset.bunyanModule=key;
    link.onerror=()=>console.warn(`Optional stylesheet failed: ${file}`);
    document.head.appendChild(link);
  };

  const loadScript=(file,key)=>new Promise(resolve=>{
    const old=document.querySelector(`script[data-bunyan-module="${key}"]`);
    if(old)old.remove();
    const script=document.createElement('script');
    script.src=`./${file}?v=${release}`;script.async=false;script.dataset.bunyanModule=key;
    script.onload=resolve;script.onerror=()=>{console.warn(`Optional script failed: ${file}`);resolve();};
    document.head.appendChild(script);
  });

  [
    ['project-center.css','project-center-style'],['financial-center.css','financial-center-style'],['global-suite.css','global-suite-style'],['project-transparency.css','project-transparency-style'],['completion-suite.css','completion-suite-style'],['project-operations.css','project-operations-style'],['copy-link.css','copy-link-style'],['mobile-admin-fix.css','mobile-admin-fix-style'],['i18n-global.css','i18n-global-style'],['impact-upgrade.css','impact-upgrade-style'],['public-project-page.css','public-project-page-style'],['project-map.css','project-map-style'],['mobile-public-menu.css','mobile-public-menu-style'],['language-selector.css','language-selector-style'],['admin-access-fix.css','admin-access-fix-style'],['menu-final-fix.css','menu-final-fix-style'],['executive-dashboard-v9.css','executive-dashboard-v9-force-style']
  ].forEach(([file,key])=>loadStyle(file,key));

  const modules=[
    ['language-native-router.js','language-native-router'],
    ['i18n-bindings.js','i18n-bindings'],
    ['i18n-keyed.js','i18n-keyed'],
    ['public-locale-render.js','public-locale-render'],
    ['admin-access-fix.js','admin-access-fix'],
    ['mobile-public-menu.js','mobile-public-menu'],
    ['global-upgrade.js','global-manager'],['quick-project.js','quick-project'],['project-center.js','project-center'],['financial-center.js','financial-center'],['global-admin.js','global-admin'],['global-suite.js','global-suite'],['project-transparency.js','project-transparency'],['completion-suite.js','completion-suite'],['project-operations.js','project-operations'],['copy-link.js','copy-link'],['mobile-admin-fix.js','mobile-admin-fix'],['impact-upgrade.js','impact-upgrade'],['finance-transparency.js','finance-transparency'],['public-project-page.js','public-project-page'],['project-map.js','project-map'],['project-geo-admin.js','project-geo-admin'],['menu-final-fix.js','menu-final-fix']
  ];

  (async()=>{
    for(const [file,key] of modules)await loadScript(file,key);
    window.BunyanI18nBindings?.bind?.();
    window.BunyanI18n?.refresh?.();
    window.BunyanPublicLocale?.render?.();
    await loadScript('menu-final-fix.js','menu-final-fix-last');
    await loadScript('executive-dashboard-v9.js','executive-dashboard-v9-force-last');
    await loadScript('stability-v1.js','stability-v1-last');
    await loadScript('admin-navigation-final.js','admin-navigation-final-last');
    reveal();
    window.dispatchEvent(new CustomEvent('bunyan:ready',{detail:{release}}));
    setTimeout(()=>{
      const dash=document.getElementById('dash');
      const title=document.getElementById('dashTitle');
      if(dash?.classList.contains('open')&&title?.textContent?.trim()==='نظرة عامة')window.openExecutiveDashboard?.();
      window.BunyanStability?.run?.();
    },900);
  })().catch(error=>{console.error('BUNYAN bootstrap failed:',error);reveal();});
})();
