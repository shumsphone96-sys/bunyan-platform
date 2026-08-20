(()=>{
  'use strict';
  const form=document.getElementById('loginForm');
  if(!form)return;
  const button=form.querySelector('button[type="submit"]');
  const message=document.getElementById('loginMessage');
  const origins=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];

  button.disabled=false;
  button.textContent='دخول';
  if(message)message.textContent='جاهز لتسجيل الدخول.';

  const loginAt=async(origin,email,password)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const response=await fetch(origin+'/api/auth/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password}),
        cache:'no-store',
        signal:controller.signal
      });
      const text=await response.text();
      let data={};
      try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok){
        const error=new Error(data.error||data.message||`فشل الدخول (${response.status})`);
        error.status=response.status;
        throw error;
      }
      if(!data?.token)throw new Error('لم يُرجع الخادم جلسة دخول صالحة.');
      return {origin,data};
    }finally{clearTimeout(timer)}
  };

  const firstSuccessful=async(tasks)=>{
    if(Promise.any)return Promise.any(tasks);
    return new Promise((resolve,reject)=>{
      let failed=0,lastError;
      tasks.forEach(task=>Promise.resolve(task).then(resolve).catch(error=>{
        lastError=error;
        failed+=1;
        if(failed===tasks.length)reject(lastError);
      }));
    });
  };

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!form.reportValidity())return;
    const email=form.elements.email.value.trim();
    const password=form.elements.password.value;
    button.disabled=true;
    if(message)message.textContent='جاري التحقق السريع…';
    try{
      const preferred=sessionStorage.getItem('bunyan_v2_origin');
      const ordered=preferred&&origins.includes(preferred)?[preferred,...origins.filter(x=>x!==preferred)]:origins;
      const result=await firstSuccessful(ordered.map(origin=>loginAt(origin,email,password)));
      sessionStorage.setItem('bunyan_v2_token',result.data.token);
      sessionStorage.setItem('bunyan_v2_origin',result.origin);
      if(message)message.textContent='تم الدخول. جاري فتح اللوحة…';
      location.reload();
    }catch(error){
      const msg=error?.name==='AbortError'?'الخادم لم يستجب سريعًا. حاول مرة أخرى.':(error?.message||'تعذر تسجيل الدخول.');
      if(message)message.textContent=msg;
      button.disabled=false;
    }
  },true);
})();
