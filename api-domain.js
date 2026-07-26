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

  // index.html كان يحمّل app.js فقط؛ لذلك ميزات إدارة المشروعات لم تكن تعمل.
  // نحمّل وحدة الإدارة العالمية صراحة مع رقم إصدار لتجاوز الكاش.
  const loadManager=()=>{
    if(document.querySelector('script[data-bunyan-global-manager]')) return;
    const script=document.createElement('script');
    script.src='./global-upgrade.js?v=20260726-2057';
    script.defer=true;
    script.dataset.bunyanGlobalManager='true';
    script.onerror=()=>console.error('تعذر تحميل وحدة إدارة المشروعات');
    document.head.appendChild(script);
  };
  loadManager();
})();