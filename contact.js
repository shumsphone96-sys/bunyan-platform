(()=>{
  const API='https://api.bunyan-sudan.org';
  const form=document.getElementById('contactForm');
  const msg=document.getElementById('contactMsg');
  if(!form)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    const data=Object.fromEntries(new FormData(form));
    button.disabled=true;
    msg.textContent='جارٍ إرسال رسالتك...';
    try{
      const response=await fetch(`${API}/api/public/contact`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'تعذر إرسال الرسالة');
      form.reset();
      msg.textContent='تم إرسال رسالتك بنجاح، وسيصل تنبيه فوري إلى فريق بُنْيَان.';
      msg.className='contact-success';
    }catch(error){
      msg.textContent=error.message;
      msg.className='contact-error';
    }finally{
      button.disabled=false;
    }
  });
})();
