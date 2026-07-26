(function(){
  const originalRenderTable=renderTable;
  const originalView=view;

  function api(path,options={}){
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    if(state.token)headers.Authorization=`Bearer ${state.token}`;
    return fetch(`${API}${path}`,{...options,headers}).then(async res=>{
      const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
      if(!res.ok)throw new Error(data?.error||`فشل الاتصال (${res.status})`);return data;
    });
  }

  function csvEscape(value){const s=String(value??'');return `"${s.replace(/"/g,'""')}"`}
  function exportCsv(type,rows){
    const d=defs[type];if(!d)return;
    const filtered=filterRows(type,rows);
    const headers=d.cols.map(c=>c[1]);
    const body=filtered.map(row=>d.cols.map(c=>csvEscape(c[0]==='status'?statusText(row[c[0]]):row[c[0]])).join(','));
    const csv='\ufeff'+[headers.map(csvEscape).join(','),...body].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=`bunyan-${type}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  async function changeDonationStatus(id,status){
    const select=document.querySelector(`[data-donation-status="${id}"]`);if(select)select.disabled=true;
    try{await api(`/api/donations/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});await tableView('donations');await refreshDashboardSilently()}
    catch(err){alert(err.message);if(select)select.disabled=false}
  }

  renderTable=function(type,rows){
    originalRenderTable(type,rows);
    const actions=$('#dashContent .dash-actions');
    if(actions&&!actions.querySelector('[data-export-csv]')){
      const b=document.createElement('button');b.className='outline export-btn';b.textContent='تصدير CSV';b.dataset.exportCsv=type;b.onclick=()=>exportCsv(type,rows);actions.appendChild(b);
    }
    if(type==='donations'){
      const current=filterRows(type,rows);
      const trs=$$('#dashContent table tr').slice(1);
      trs.forEach((tr,index)=>{
        const row=current[index];if(!row)return;
        const actionsCell=tr.querySelector('.row-actions');if(!actionsCell)return;
        if(!actionsCell.querySelector('[data-donation-status]')){
          const s=document.createElement('select');s.className='status-select';s.dataset.donationStatus=row.id;
          s.innerHTML=`<option value="pending" ${row.status==='pending'?'selected':''}>قيد المراجعة</option><option value="verified" ${row.status==='verified'?'selected':''}>موثقة</option><option value="rejected" ${row.status==='rejected'?'selected':''}>مرفوضة</option>`;
          s.onchange=()=>changeDonationStatus(row.id,s.value);actionsCell.prepend(s);
        }
      });
    }
  };

  async function executiveHome(){
    dashTitle.textContent='نظرة عامة';loading(dashContent);
    try{
      const [x,r,s]=await Promise.all([api('/api/dashboard'),api('/api/reports/summary'),api('/api/system/status')]);
      const totals={};r.currencies.forEach(c=>{if(c.status==='verified')totals[c.currency]=(Number(totals[c.currency]||0)+Number(c.total||0))});
      dashContent.innerHTML=`<div class="welcome-card"><div><span class="tag dark">مركز التحكم العالمي</span><h3>بُنْيَان — لوحة التنفيذ والشفافية</h3><p>متابعة فورية للطلبات والمساهمات والمستندات وصحة النظام.</p></div><span class="system-live">● النظام يعمل</span></div>
      <div class="kpis"><div class="kpi">المشروعات<strong>${x.projects}</strong></div><div class="kpi attention">طلبات جديدة<strong>${x.new_requests}</strong></div><div class="kpi">إجمالي المساهمات<strong>${r.donations_total}</strong></div><div class="kpi attention">بانتظار المراجعة<strong>${r.donations_pending}</strong></div><div class="kpi">مساهمات موثقة<strong>${r.donations_verified}</strong></div><div class="kpi">إشعارات تحويل<strong>${r.receipts_total}</strong></div></div>
      <section class="executive-grid"><article><h3>إجمالي المبالغ الموثقة</h3>${Object.keys(totals).length?Object.entries(totals).map(([currency,total])=>`<div class="money-row"><span>${esc(currency)}</span><strong>${Number(total).toLocaleString('en-GB')}</strong></div>`).join(''):'<p class="empty">لا توجد مساهمات موثقة بعد.</p>'}</article><article><h3>صحة النظام</h3><div class="health-row"><span>قاعدة البيانات</span><strong>${esc(s.database)}</strong></div><div class="health-row"><span>زمن الاستجابة</span><strong>${Number(s.totalLatencyMs)} ms</strong></div><div class="health-row"><span>الإصدار</span><strong>${esc(s.version)}</strong></div><div class="health-row"><span>آخر فحص</span><strong>${date(s.time)}</strong></div></article></section>`;
    }catch(err){showError(dashContent,err)}
  }

  view=async function(v){
    $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    if(v==='home')return executiveHome();
    return originalView(v);
  };
})();
