(()=>{
  const official='https://api.bunyan-sudan.org';
  const render='https://bunyan-api-qhkf.onrender.com';
  window.BUNYAN_API_ORIGINS=[official,render];
  window.BUNYAN_API_ORIGIN=official;

  // إزالة أي Service Worker قديم يقدّم نسخة متقادمة على Android.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations()
      .then(registrations=>Promise.all(registrations.map(r=>r.unregister())))
      .catch(()=>{});
  }
})();