(()=>{
  const legacy='https://bunyan-api-qhkf.onrender.com';
  const official='https://api.bunyan-sudan.org';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    if(typeof input==='string'&&input.startsWith(legacy)) input=official+input.slice(legacy.length);
    else if(input instanceof Request&&input.url.startsWith(legacy)) input=new Request(official+input.url.slice(legacy.length),input);
    return nativeFetch(input,init);
  };
  window.BUNYAN_API_ORIGIN=official;
})();
