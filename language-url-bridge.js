(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('lang');
  if(requested==='ar'||requested==='en'){
    try{localStorage.setItem('bunyan_language',requested);}catch{}
    document.documentElement.lang=requested;
    document.documentElement.dir=requested==='ar'?'rtl':'ltr';
  }
})();
