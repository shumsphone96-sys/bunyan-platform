(()=>{
  'use strict';
  const origins=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];

  const loginAt=async(origin,email,password)=>{
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
      if(!res.ok){
        const err=new Error(data.error||data.message||`فشل الدخول (${res.status})`);
        err.status=res.status;
        throw err;
      }
      if(!data?.token)throw new Error('لم يُرجع الخادم جلسة دخول صالحة.');
      return {origin,data};
    }finally{clearTimeout(timer)}
  };

  const firstSuccess=tasks=>Promise.any
    ? Promise.any(tasks)
    : new Promise((resolve,reject)=>{let failures=0,last;tasks.forEach(p=>Promise.resolve(p).then(resolve).catch(e=>{last=e;if(++failures===tasks.length)reject(last)}))});

  const install=()=>{
    const form=document.getElementById('loginForm');
    if(!form||form.dataset.fastRootLogin==='1')return;
    form.dataset.fastRootLogin='1';
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      const msg=document.getElementById('loginMsg');
      const button=form.querySelector('button[type="submit"]');
      const email=form.elements.email?.value?.trim();
      const password=form.elements.password?.value||'';
      if(!email||!password)return;
      if(button)button.disabled=true;
      if(msg)msg.textContent='جاري التحقق السريع…';
      try{
        const preferred=sessionStorage.getItem('bunyan_api_origin');
        const ordered=preferred&&origins.includes(preferred)?[preferred,...origins.filter(x=>x!==preferred)]:origins;
        const winner=await firstSuccess(ordered.map(origin=>loginAt(origin,email,password)));
        sessionStorage.setItem('bunyan_token',winner.data.token);
        sessionStorage.setItem('bunyan_api_origin',winner.origin);
        if(msg)msg.textContent='تم الدخول. جاري فتح لوحة الإدارة…';
        const login=document.getElementById('login');
        const dash=document.getElementById('dash');
        login?.classList.remove('open','show');
        dash?.classList.add('open');
        window.openExecutiveDashboard?.();
        setTimeout(()=>window.openExecutiveDashboard?.(),120);
      }catch(error){
        if(msg){
          if(error?.errors?.some?.(e=>e?.status===401)||error?.status===401)msg.textContent='البريد الإلكتروني أو كلمة المرور غير صحيحة.';
          else msg.textContent='تعذر الوصول للخادم بسرعة. حاول مرة أخرى.';
        }
      }finally{if(button)button.disabled=false}
    },true);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.addEventListener('bunyan:ready',install);
})();