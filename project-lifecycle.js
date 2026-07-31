(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';
  let base=sessionStorage.getItem('bunyan_api_origin')||origins[0];
  async function api(path,options={}){
    const headers={...(options.headers||{})};
    if(token())headers.Authorization=`Bearer ${token()}`;
    if(options.body){headers['Content-Type']='application/json';if(typeof options.body==='object')options.body=JSON.stringify(options.body)}
    let last;
    for(const origin of [base,...origins.filter(x=>x!==base)]){
      try{
        const r=await fetch(origin+path,{...options,headers,cache:'no-store'});
        const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={message:text}}
        if(!r.ok){const e=new Error(data.error||data.message||`فشل الطلب (${r.status})`);e.status=r.status;throw e}
        base=origin;sessionStorage.setItem('bunyan_api_origin',origin);return data;
      }catch(e){last=e;if(e.status&&e.status>=400&&e.status<500&&!([401,403].includes(e.status)))throw e}
    }
    throw last||new Error('تعذر الاتصال بالخادم');
  }
  const stats=rows=>({
    total:rows.length,
    public:rows.filter(x=>x.is_public).length,
    hidden:rows.filter(x=>!x.is_public).length,
    active:rows.filter(x=>x.status==='active').length,
    completed:rows.filter(x=>x.status==='completed').length,
    archived:rows.filter(x=>x.status==='paused').length
  });
  function statCards(s){return `<section class="pl-stats"><article><small>كل المشروعات</small><strong>${s.total}</strong></article><article><small>المنشورة</small><strong>${s.public}</strong></article><article><small>المسودات</small><strong>${s.hidden}</strong></article><article><small>النشطة</small><strong>${s.active}</strong></article><article><small>المكتملة</small><strong>${s.completed}</strong></article><article><small>المؤرشفة</small><strong>${s.archived}</strong></article></section>`}
  function reorder(rows,mode){
    const grid=$('#pv4Grid');if(!grid)return;
    const ordered=[...rows];
    if(mode==='oldest')ordered.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    else if(mode==='progress')ordered.sort((a,b)=>Number(b.progress||0)-Number(a.progress||0));
    else if(mode==='budget')ordered.sort((a,b)=>Number(b.budget||0)-Number(a.budget||0));
    else ordered.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    ordered.forEach(p=>{const card=$(`[data-edit="${p.id}"]`)?.closest('.pv4-card');if(card)grid.appendChild(card)});
  }
  async function enhance(){
    const grid=$('#pv4Grid'),head=$('.pv4-head'),tools=$('.pv4-tools');
    if(!grid||!head||head.dataset.lifecycleReady)return;
    head.dataset.lifecycleReady='1';
    try{
      const rows=await api('/api/projects');
      head.insertAdjacentHTML('afterend',statCards(stats(rows)));
      if(tools){
        const archived=document.createElement('option');archived.value='paused';archived.textContent='المؤرشفة / المتوقفة';$('#pv4Filter')?.appendChild(archived);
        const sort=document.createElement('select');sort.id='plSort';sort.innerHTML='<option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option><option value="progress">الأعلى إنجازاً</option><option value="budget">الأعلى ميزانية</option>';
        tools.insertBefore(sort,tools.querySelector('.count-badge'));
        sort.onchange=()=>reorder(rows,sort.value);
      }
      rows.forEach(p=>{
        const actions=$(`[data-edit="${p.id}"]`)?.closest('.pv4-actions');
        if(!actions||actions.querySelector('[data-archive]'))return;
        const btn=document.createElement('button');btn.dataset.archive=p.id;btn.textContent=p.status==='paused'?'إعادة تنشيط':'أرشفة';
        btn.onclick=async()=>{
          const next=p.status==='paused'?'active':'paused';
          if(next==='paused'&&!confirm('أرشفة المشروع وإيقاف ظهوره كمشروع نشط؟'))return;
          btn.disabled=true;
          try{await api(`/api/projects/${p.id}`,{method:'PATCH',body:{status:next,is_public:next==='paused'?false:p.is_public}});window.openProjectCenter?.()}catch(e){alert(e.message)}finally{btn.disabled=false}
        };
        actions.insertBefore(btn,actions.querySelector('.danger'));
      });
    }catch(e){console.warn('Project lifecycle enhancement:',e.message)}
  }
  const observer=new MutationObserver(()=>setTimeout(enhance,40));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();