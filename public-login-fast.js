(()=>{
  'use strict';
  const origins=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const form=document.getElementById('loginForm');
  if(!form)return;
  const msg=document.getElementById('loginMsg');
  const button=form.querySelector('button[type="submit"]');

  const attempt=async(origin,email,password)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const res=await fetch(origin+'/api/auth/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password}),
        cache:'no-store',
        signal:controller.signal
      });
      const text=await res.text();
      let data={};
      try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!res.ok){const e=new Error(data.error||data.message||`فشل الدخول (${res.status})`);e.status=res.status;throw e;}
      if(!data?.token)throw new Error('لم يُرجع الخادم جلسة دخول صالحة.');
      return {origin,data};
    }finally{clearTimeout(timer)}
  };

  const firstSuccess=tasks=>Promise.any?Promise.any(tasks):new Promise((resolve,reject)=>{
    let failed=0,last;
    tasks.forEach(p=>Promise.resolve(p).then(resolve).catch(e=>{last=e;if(++failed===tasks.length)reject(last);}));
  });

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    if(!form.reportValidity())return;
    const email=form.elements.email.value.trim();
    const password=form.elements.password.value;
    if(button)button.disabled=true;
    if(msg)msg.textContent='جاري التحقق السريع…';
    try{
      const preferred=sessionStorage.getItem('bunyan_api_origin');
      const ordered=preferred&&origins.includes(preferred)?[preferred,...origins.filter(x=>x!==preferred)]:origins;
      const {origin,data}=await firstSuccess(ordered.map(o=>attempt(o,email,password)));
      sessionStorage.setItem('bunyan_token',data.token);
      sessionStorage.setItem('bunyan_api_origin',origin);
      if(msg)msg.textContent='تم الدخول. جاري فتح اللوحة…';
      document.getElementById('login')?.classList.remove('open');
      document.getElementById('dash')?.classList.add('open');
      setTimeout(()=>window.openExecutiveDashboard?.(),0);
      setTimeout(()=>window.openExecutiveDashboard?.(),250);
    }catch(err){
      if(msg)msg.textContent=err?.name==='AggregateError'?'تعذر الوصول إلى خادم بُنْيَان الآن. حاول مرة أخرى.':(err?.message||'تعذر تسجيل الدخول.');
    }finally{if(button)button.disabled=false;}
  },true);
})();