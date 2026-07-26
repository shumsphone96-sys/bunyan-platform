(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  let origin=sessionStorage.getItem('bunyan_api_origin')||origins[0];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';

  async function api(path,options={}){
    const headers={...(options.headers||{})};
    if(token())headers.Authorization=`Bearer ${token()}`;
    if(options.body&&!(options.body instanceof FormData)){
      headers['Content-Type']='application/json';
      if(typeof options.body==='object')options.body=JSON.stringify(options.body);
    }
    let last;
    for(const base of [origin,...origins.filter(x=>x!==origin)]){
      try{
        const res=await fetch(base+path,{...options,headers,cache:'no-store'});
        const text=await res.text(); let data={};
        try{data=text?JSON.parse(text):{}}catch{data={message:text}}
        if(!res.ok)throw new Error(data.error||data.message||`فشل الطلب (${res.status})`);
        origin=base;sessionStorage.setItem('bunyan_api_origin',base);return data;
      }catch(e){last=e}
    }
    throw last||new Error('تعذر الاتصال بالخادم');
  }

  const labels={projects:{title:'إدارة المشروعات',add:'مشروع جديد'},news:{title:'إدارة الأخبار',add:'خبر جديد'}};

  function projectCard(p){
    const progress=Math.max(0,Math.min(100,Number(p.progress||0)));
    return `<article class="pro-card"><div class="pro-card-top"><span class="pro-status">${esc(p.status||'جديد')}</span><span class="pro-public ${p.is_public?'on':''}">${p.is_public?'منشور':'مسودة'}</span></div><h3>${esc(p.name||'بدون اسم')}</h3><p>${esc(p.summary||'لا يوجد وصف')}</p><div class="pro-progress"><i style="width:${progress}%"></i></div><small>نسبة الإنجاز: ${progress}%</small><div class="pro-actions"><button data-edit-project="${p.id}" class="pro-btn">تعديل</button><button data-delete-project="${p.id}" class="pro-btn danger">حذف</button></div></article>`;
  }

  function newsCard(n){return `<article class="pro-card"><div class="pro-card-top"><span class="pro-status">${n.is_public?'منشور':'مسودة'}</span></div><h3>${esc(n.title||'بدون عنوان')}</h3><p>${esc(n.body||'لا يوجد محتوى')}</p><small>${n.published_at?new Date(n.published_at).toLocaleString('ar-SD'):'غير منشور'}</small><div class="pro-actions"><button data-edit-news="${n.id}" class="pro-btn">تعديل</button><button data-delete-news="${n.id}" class="pro-btn danger">حذف</button></div></article>`}

  async function renderManager(type){
    const content=$('#dashContent'),title=$('#dashTitle'); if(!content)return;
    title.textContent=labels[type].title; content.innerHTML='<div class="pro-loading">جاري التحميل...</div>';
    try{
      const rows=await api(`/api/${type}`);
      content.innerHTML=`<section class="pro-head"><div><span>BUNYAN GLOBAL OS</span><h3>${labels[type].title}</h3><p>إدارة كاملة من الهاتف: إنشاء، تعديل، نشر وحذف.</p></div><button id="proAdd" class="primary">+ ${labels[type].add}</button></section><div class="pro-grid">${rows.length?rows.map(type==='projects'?projectCard:newsCard).join(''):'<div class="pro-empty">لا توجد بيانات حتى الآن.</div>'}</div>`;
      $('#proAdd').onclick=()=>openEditor(type);
      $$(`[data-edit-${type==='projects'?'project':'news'}]`).forEach(b=>b.onclick=()=>openEditor(type,rows.find(x=>x.id===b.dataset[`edit${type==='projects'?'Project':'News'}`])));
      $$(`[data-delete-${type==='projects'?'project':'news'}]`).forEach(b=>b.onclick=()=>removeItem(type,b.dataset[`delete${type==='projects'?'Project':'News'}`]));
    }catch(e){content.innerHTML=`<div class="error-msg">${esc(e.message)}</div>`}
  }

  function openEditor(type,item={}){
    let modal=$('#proEditor'); if(modal)modal.remove();
    modal=document.createElement('div');modal.id='proEditor';modal.className='pro-modal';
    modal.innerHTML=type==='projects'?`<form><button type="button" class="pro-close">×</button><h2>${item.id?'تعديل المشروع':'إضافة مشروع جديد'}</h2><label>اسم المشروع<input name="name" value="${esc(item.name||'')}" required></label><label>الوصف<textarea name="summary" required>${esc(item.summary||'')}</textarea></label><div class="pro-two"><label>الحالة<input name="status" value="${esc(item.status||'active')}"></label><label>نسبة الإنجاز<input name="progress" type="number" min="0" max="100" value="${Number(item.progress||0)}"></label></div><div class="pro-two"><label>الميزانية<input name="budget" type="number" min="0" value="${item.budget||0}"></label><label>العملة<select name="currency"><option>SDG</option><option>SAR</option><option>USD</option></select></label></div><label class="pro-check"><input name="is_public" type="checkbox" ${item.is_public?'checked':''}> نشر المشروع في الموقع</label><button class="primary">حفظ المشروع</button><small class="pro-msg"></small></form>`:`<form><button type="button" class="pro-close">×</button><h2>${item.id?'تعديل الخبر':'إضافة خبر جديد'}</h2><label>عنوان الخبر<input name="title" value="${esc(item.title||'')}" required></label><label>المحتوى<textarea name="body" required>${esc(item.body||'')}</textarea></label><label class="pro-check"><input name="is_public" type="checkbox" ${item.is_public?'checked':''}> نشر الخبر في الموقع</label><button class="primary">حفظ الخبر</button><small class="pro-msg"></small></form>`;
    document.body.appendChild(modal);modal.classList.add('open');modal.querySelector('.pro-close').onclick=()=>modal.remove();
    if(type==='projects'&&item.currency)modal.querySelector('[name=currency]').value=item.currency;
    modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=f.querySelector('.pro-msg'),btn=f.querySelector('.primary');const d=Object.fromEntries(new FormData(f).entries());d.is_public=f.elements.is_public.checked;if(type==='projects'){d.progress=Number(d.progress||0);d.budget=Number(d.budget||0);d.beneficiaries_target=Number(item.beneficiaries_target||0)}else d.published_at=d.is_public?(item.published_at||new Date().toISOString()):null;try{btn.disabled=true;msg.textContent='جاري الحفظ...';await api(item.id?`/api/${type}/${item.id}`:`/api/${type}`,{method:item.id?'PATCH':'POST',body:d});modal.remove();renderManager(type)}catch(x){msg.textContent=x.message}finally{btn.disabled=false}};
  }

  async function removeItem(type,id){if(!confirm('هل تريد حذف هذا السجل نهائياً؟'))return;try{await api(`/api/${type}/${id}`,{method:'DELETE'});renderManager(type)}catch(e){alert(e.message)}}

  function installQuickAction(){
    const content=$('#dashContent');
    if(!content||$('#quickNewProject'))return;
    const bar=document.createElement('div');
    bar.className='global-quick-actions';
    bar.innerHTML='<button id="quickNewProject" class="primary">+ إنشاء مشروع جديد</button><button id="quickManageProjects" class="pro-btn">إدارة المشروعات</button>';
    content.prepend(bar);
    $('#quickNewProject').onclick=()=>openEditor('projects');
    $('#quickManageProjects').onclick=()=>renderManager('projects');
  }

  const timer=setInterval(()=>{
    const dash=$('#dash');if(!dash)return;
    const p=$('[data-view="projects"]'),n=$('[data-view="news"]');
    if(p)p.onclick=()=>renderManager('projects');
    if(n)n.onclick=()=>renderManager('news');
    if(dash.classList.contains('open'))installQuickAction();
  },400);
})();