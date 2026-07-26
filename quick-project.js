(()=>{
  const API_ORIGINS=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(path,options={}){
    const headers={...(options.headers||{})};
    if(token())headers.Authorization=`Bearer ${token()}`;
    if(options.body&&!(options.body instanceof FormData)){
      headers['Content-Type']='application/json';
      if(typeof options.body==='object')options.body=JSON.stringify(options.body);
    }
    let last;
    for(const base of API_ORIGINS){
      try{
        const res=await fetch(base+path,{...options,headers,cache:'no-store'});
        const text=await res.text();let data={};
        try{data=text?JSON.parse(text):{}}catch{data={message:text}}
        if(!res.ok)throw new Error(data.error||data.message||`فشل الطلب (${res.status})`);
        return data;
      }catch(err){last=err}
    }
    throw last||new Error('تعذر الاتصال بالخادم');
  }

  function openProjectEditor(){
    document.getElementById('quickProjectModal')?.remove();
    const modal=document.createElement('div');
    modal.id='quickProjectModal';
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(2,16,13,.88);display:grid;place-items:center;padding:16px;direction:rtl';
    modal.innerHTML=`<form style="width:min(520px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:24px;display:grid;gap:13px;box-shadow:0 20px 70px rgba(0,0,0,.35)">
      <button type="button" data-close style="justify-self:start;border:0;background:none;font-size:30px;line-height:1">×</button>
      <h2 style="margin:0">إضافة مشروع جديد</h2>
      <label>اسم المشروع<input name="name" required style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"></label>
      <label>وصف المشروع<textarea name="summary" required rows="4" style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"></textarea></label>
      <label>الحالة<select name="status" style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"><option value="active">نشط</option><option value="planning">قيد التخطيط</option><option value="completed">مكتمل</option></select></label>
      <label>نسبة الإنجاز<input name="progress" type="number" min="0" max="100" value="0" style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"></label>
      <label>الميزانية<input name="budget" type="number" min="0" value="0" style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"></label>
      <label>العملة<select name="currency" style="width:100%;padding:13px;border:1px solid #dfe5e1;border-radius:10px"><option>SDG</option><option>SAR</option><option>USD</option></select></label>
      <label style="display:flex;gap:9px;align-items:center"><input name="is_public" type="checkbox"> نشر المشروع في الموقع</label>
      <button type="submit" style="border:0;border-radius:999px;padding:14px;background:linear-gradient(135deg,#d7aa4b,#f0d084);font-weight:700">حفظ المشروع</button>
      <small data-msg style="min-height:22px"></small>
    </form>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
    modal.querySelector('form').onsubmit=async e=>{
      e.preventDefault();
      const f=e.currentTarget,msg=f.querySelector('[data-msg]'),btn=f.querySelector('[type=submit]');
      const data=Object.fromEntries(new FormData(f).entries());
      data.progress=Number(data.progress||0);data.budget=Number(data.budget||0);data.beneficiaries_target=0;data.is_public=f.elements.is_public.checked;
      try{
        btn.disabled=true;msg.textContent='جاري حفظ المشروع...';
        await api('/api/projects',{method:'POST',body:data});
        msg.textContent='تم إنشاء المشروع بنجاح.';
        setTimeout(()=>{modal.remove();document.querySelector('[data-view="projects"]')?.click()},700);
      }catch(err){msg.textContent=err.message}finally{btn.disabled=false}
    };
  }

  function install(){
    const dash=document.getElementById('dash');
    if(!dash||document.getElementById('quickProjectBtn'))return;
    const btn=document.createElement('button');
    btn.id='quickProjectBtn';
    btn.type='button';
    btn.textContent='+ مشروع جديد';
    btn.style.cssText='position:fixed;left:18px;bottom:86px;z-index:9998;border:0;border-radius:999px;padding:14px 20px;background:linear-gradient(135deg,#d7aa4b,#f0d084);color:#211604;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none';
    btn.onclick=openProjectEditor;
    document.body.appendChild(btn);
    const sync=()=>{btn.style.display=dash.classList.contains('open')||dash.classList.contains('show')?'block':'none'};
    new MutationObserver(sync).observe(dash,{attributes:true,attributeFilter:['class']});
    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.openQuickProjectEditor=openProjectEditor;
})();