(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let base=sessionStorage.getItem('bunyan_api_origin')||origins[0],rendering=false;
  async function api(path){let last;for(const origin of [base,...origins.filter(x=>x!==base)]){try{const r=await fetch(origin+path,{cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${token()}`}}),text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={message:text}}if(!r.ok){const e=new Error(data.error||data.message||`فشل الطلب (${r.status})`);e.status=r.status;throw e}base=origin;sessionStorage.setItem('bunyan_api_origin',origin);return data}catch(e){last=e;if(e.status&&e.status>=400&&e.status<500&&![401,403].includes(e.status))throw e}}throw last||new Error('تعذر الاتصال بالخادم')}
  const money=(v,c='SDG')=>`${Number(v||0).toLocaleString('en-GB')} ${c}`;
  const date=v=>v?new Date(v).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'—';
  const safe=async(path,fallback=[])=>{try{return await api(path)}catch{return fallback}};
  async function render(){
    if(rendering)return;rendering=true;
    const content=$('#dashContent'),title=$('#dashTitle');if(!content){rendering=false;return}
    $$('.global-quick-actions').forEach(x=>x.remove());
    if(title)title.textContent='لوحة المؤشرات التنفيذية';
    content.dataset.executiveDashboard='1';
    content.innerHTML='<div class="loading">جاري تجميع مؤشرات المؤسسة...</div>';
    try{
      const [projects,beneficiaries,volunteers,requests,news,finance,help,audit]=await Promise.all([
        safe('/api/projects'),safe('/api/beneficiaries'),safe('/api/volunteers'),safe('/api/requests'),safe('/api/news'),safe('/api/finance/entries'),safe('/api/help/requests'),safe('/api/audit-logs')
      ]);
      const p=Array.isArray(projects)?projects:[],b=Array.isArray(beneficiaries)?beneficiaries:[],v=Array.isArray(volunteers)?volunteers:[],r=Array.isArray(requests)?requests:[],n=Array.isArray(news)?news:[],f=Array.isArray(finance)?finance:[],h=Array.isArray(help)?help:[],a=Array.isArray(audit)?audit:[];
      const income=f.filter(x=>x.entry_type==='income').reduce((s,x)=>s+Number(x.amount||0),0),expense=f.filter(x=>x.entry_type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
      const alerts=[];
      const newHelp=h.filter(x=>x.status==='new');if(newHelp.length)alerts.push({level:'danger',title:`${newHelp.length} طلب مساعدة جديد`,text:'تحتاج للمراجعة والاتصال بأصحابها.'});
      const newJoin=r.filter(x=>['new','pending'].includes(x.status||'new'));if(newJoin.length)alerts.push({title:`${newJoin.length} طلب مشاركة جديد`,text:'راجع طلبات التطوع والمشاركة.'});
      const paused=p.filter(x=>x.status==='paused');if(paused.length)alerts.push({level:'danger',title:`${paused.length} مشروع متوقف`,text:'تحتاج الإدارة إلى قرار أو تحديث.'});
      const stale=p.filter(x=>Number(x.progress||0)<25&&x.status==='active');if(stale.length)alerts.push({title:`${stale.length} مشروع منخفض الإنجاز`,text:'نسبة الإنجاز أقل من 25%.'});
      const published=n.filter(x=>x.is_public||x.published_at).length,recent=[...a].slice(0,8);
      content.innerHTML=`<section class="ev9-root"><section class="ev9-head"><div><span>المرحلة التاسعة</span><h3>لوحة المؤشرات التنفيذية</h3><p>صورة لحظية لما يحدث داخل بُنْيَان وما يحتاج تدخلًا الآن.</p><div class="ev9-time">آخر تحديث: ${date(new Date())}</div></div><div class="ev9-actions"><button id="ev9Refresh">تحديث</button><button id="ev9Print" class="primary">طباعة الملخص</button></div></section><div class="ev9-kpis"><article class="ev9-kpi"><span>المشروعات</span><strong>${p.length}</strong></article><article class="ev9-kpi"><span>المستفيدون</span><strong>${b.length}</strong></article><article class="ev9-kpi"><span>المتطوعون</span><strong>${v.length}</strong></article><article class="ev9-kpi"><span>طلبات المساعدة الجديدة</span><strong>${newHelp.length}</strong></article><article class="ev9-kpi"><span>الإيرادات</span><strong>${money(income)}</strong></article><article class="ev9-kpi"><span>المصروفات</span><strong>${money(expense)}</strong></article><article class="ev9-kpi"><span>الرصيد</span><strong>${money(income-expense)}</strong></article><article class="ev9-kpi"><span>الأخبار المنشورة</span><strong>${published}</strong></article></div><div class="ev9-grid"><div><article class="ev9-panel"><h4>ما يحتاج تدخلًا الآن</h4><div class="ev9-list">${alerts.length?alerts.map(x=>`<div class="ev9-item ev9-alert ${x.level||''}"><strong>${esc(x.title)}</strong><small>${esc(x.text)}</small></div>`).join(''):'<div class="ev9-empty">لا توجد تنبيهات عاجلة الآن.</div>'}</div></article><article class="ev9-panel" style="margin-top:16px"><h4>أداء المشروعات</h4><div class="ev9-bars">${p.length?p.slice(0,10).map(x=>`<div class="ev9-bar-row"><span>${esc(x.name||'مشروع')}</span><div class="ev9-bar"><i style="width:${Math.max(0,Math.min(100,Number(x.progress||0)))}%"></i></div><strong>${Number(x.progress||0)}%</strong></div>`).join(''):'<div class="ev9-empty">لا توجد مشروعات بعد.</div>'}</div></article></div><div><article class="ev9-panel"><h4>ملخص الحالة</h4><div class="ev9-list"><div class="ev9-item"><strong>المشروعات المنشورة</strong><small>${p.filter(x=>x.is_public).length} من ${p.length}</small></div><div class="ev9-item"><strong>المستفيدون النشطون</strong><small>${b.filter(x=>['active','new'].includes(x.status)).length}</small></div><div class="ev9-item"><strong>المتطوعون النشطون</strong><small>${v.filter(x=>x.status==='active').length}</small></div><div class="ev9-item"><strong>طلبات المشاركة المفتوحة</strong><small>${newJoin.length}</small></div></div></article><article class="ev9-panel" style="margin-top:16px"><h4>آخر العمليات</h4><div class="ev9-list">${recent.length?recent.map(x=>`<div class="ev9-item"><strong>${esc(x.action||'عملية')}</strong><small>${esc(x.entity_type||'')} · ${date(x.created_at)}</small></div>`).join(''):'<div class="ev9-empty">لا توجد عمليات مسجلة بعد.</div>'}</div></article></div></div><div class="ev9-print-only"><p>تم إنشاء هذا الملخص من منصة بُنْيَان بتاريخ ${date(new Date())}.</p></div></section>`;
      $('#ev9Refresh').onclick=render;$('#ev9Print').onclick=()=>window.print();
    } finally {rendering=false}
  }
  function route(e){if(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}render();return false}
  function bind(){const btn=$('[data-view="overview"]');if(!btn)return;btn.onclick=route;if(!btn.dataset.ev9Bound){btn.addEventListener('click',route,true);btn.dataset.ev9Bound='1'}}
  function install(){bind();window.openExecutiveDashboard=render;const timer=setInterval(()=>{bind();const content=$('#dashContent');if(content?.dataset.executiveDashboard==='1')$$('.global-quick-actions').forEach(x=>x.remove())},350);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();