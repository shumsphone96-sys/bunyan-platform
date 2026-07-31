(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let base=sessionStorage.getItem('bunyan_api_origin')||origins[0],requests=[],beneficiaries=[],projects=[];
  const statusText={new:'جديد',review:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض',completed:'مكتمل',active:'نشط',inactive:'موقوف'};

  async function api(path,options={}){
    const headers={...(options.headers||{})};
    if(token())headers.Authorization=`Bearer ${token()}`;
    if(options.body&&!(options.body instanceof FormData)){
      headers['Content-Type']='application/json';
      if(typeof options.body==='object')options.body=JSON.stringify(options.body);
    }
    let last;
    for(const origin of [base,...origins.filter(x=>x!==base)]){
      try{
        const r=await fetch(origin+path,{...options,headers,cache:'no-store'});
        const text=await r.text();let data={};
        try{data=text?JSON.parse(text):{}}catch{data={message:text}}
        if(!r.ok){const e=new Error(data.error||data.message||`فشل الطلب (${r.status})`);e.status=r.status;throw e}
        base=origin;sessionStorage.setItem('bunyan_api_origin',origin);return data;
      }catch(e){last=e;if(e.status&&e.status>=400&&e.status<500&&![401,403].includes(e.status))throw e}
    }
    throw last||new Error('تعذر الاتصال بالخادم');
  }

  const date=v=>v?new Date(v).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'—';
  const money=(v,c)=>v===null||v===undefined||v===''?'—':`${Number(v).toLocaleString('en-GB')} ${esc(c||'SDG')}`;
  const projectName=id=>projects.find(p=>String(p.id)===String(id))?.name||'غير مرتبط بمشروع';

  function ensureHelpButton(){
    const aside=$('#dash aside');if(!aside)return null;
    let btn=$('[data-view="helpRequests"]');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.dataset.view='helpRequests';btn.textContent='طلبات المساعدة';
      const beneficiaryBtn=$('[data-view="beneficiaries"]');
      beneficiaryBtn?.insertAdjacentElement('beforebegin',btn);
    }
    return btn;
  }

  function kpis(){
    const count=s=>requests.filter(r=>r.status===s).length;
    return `<div class="bv5-kpis"><article class="bv5-kpi"><span>إجمالي الطلبات</span><strong>${requests.length}</strong></article><article class="bv5-kpi"><span>طلبات جديدة</span><strong>${count('new')}</strong></article><article class="bv5-kpi"><span>قيد المراجعة</span><strong>${count('review')}</strong></article><article class="bv5-kpi"><span>طلبات معتمدة</span><strong>${count('approved')}</strong></article><article class="bv5-kpi"><span>إجمالي المستفيدين</span><strong>${beneficiaries.length}</strong></article></div>`;
  }

  function requestCard(r){
    const s=statusText[r.status]||r.status;
    return `<article class="bv5-request" data-id="${esc(r.id)}" data-search="${esc(`${r.tracking_number||''} ${r.full_name||''} ${r.phone||''} ${r.location||''} ${r.case_type||''}`.toLowerCase())}" data-status="${esc(r.status||'new')}"><div class="bv5-row"><div><span class="bv5-badge ${esc(r.status||'new')}">${esc(s)}</span><h4>${esc(r.full_name)}</h4></div><strong>${esc(r.tracking_number||'بدون رقم')}</strong></div><div class="bv5-meta"><span>الهاتف: ${esc(r.phone)}</span><span>الموقع: ${esc(r.location)}</span><span>نوع الحالة: ${esc(r.case_type)}</span><span>المبلغ: ${money(r.requested_amount,r.currency)}</span><span>${date(r.created_at)}</span></div><p>${esc(r.description)}</p>${r.admin_notes?`<div class="bv5-note"><strong>ملاحظات الإدارة:</strong><br>${esc(r.admin_notes)}</div>`:''}<div class="bv5-actions"><button data-status-set="review" data-request="${r.id}">قيد المراجعة</button><button class="primary" data-convert="${r.id}">اعتماد وتحويل لمستفيد</button><button data-status-set="completed" data-request="${r.id}">مكتمل</button><button class="danger" data-status-set="rejected" data-request="${r.id}">رفض</button><button data-notes="${r.id}">إضافة ملاحظة</button></div></article>`;
  }

  async function renderRequests(){
    const content=$('#dashContent'),title=$('#dashTitle');if(!content)return;
    if(title)title.textContent='طلبات المساعدة';
    content.innerHTML='<div class="loading">جاري تحميل الطلبات...</div>';
    try{
      [requests,beneficiaries,projects]=await Promise.all([api('/api/help/requests'),api('/api/beneficiaries'),api('/api/projects')]);
      content.innerHTML=`<section class="bv5-head"><div><span class="tag">المرحلة الخامسة</span><h3>صندوق طلبات المساعدة</h3><p>مراجعة الطلبات وتحويل المعتمد منها إلى مستفيد مرتبط بمشروع.</p></div><button class="primary bv5-add" id="bv5Refresh">تحديث</button></section>${kpis()}<div class="bv5-tools"><input id="bv5RequestSearch" placeholder="ابحث بالاسم أو الهاتف أو رقم التتبع"><select id="bv5RequestFilter"><option value="all">كل الحالات</option><option value="new">جديد</option><option value="review">قيد المراجعة</option><option value="approved">معتمد</option><option value="rejected">مرفوض</option><option value="completed">مكتمل</option></select><span class="count-badge">${requests.length} طلب</span></div><div class="bv5-list" id="bv5RequestList">${requests.length?requests.map(requestCard).join(''):'<div class="bv5-empty">لا توجد طلبات مساعدة بعد.</div>'}</div>`;
      $('#bv5Refresh').onclick=renderRequests;$('#bv5RequestSearch').oninput=filterRequests;$('#bv5RequestFilter').onchange=filterRequests;
      $$('[data-status-set]').forEach(b=>b.onclick=()=>setRequestStatus(b.dataset.request,b.dataset.statusSet));
      $$('[data-convert]').forEach(b=>b.onclick=()=>openConvert(requests.find(r=>String(r.id)===b.dataset.convert)));
      $$('[data-notes]').forEach(b=>b.onclick=()=>openNotes(requests.find(r=>String(r.id)===b.dataset.notes)));
    }catch(e){content.innerHTML=`<div class="error-msg">${esc(e.message)}</div>`}
  }

  function filterRequests(){const q=$('#bv5RequestSearch')?.value.trim().toLowerCase()||'',f=$('#bv5RequestFilter')?.value||'all';$$('.bv5-request').forEach(c=>{c.hidden=!((!q||c.dataset.search.includes(q))&&(f==='all'||c.dataset.status===f))})}

  async function setRequestStatus(id,status,adminNotes){
    try{await api(`/api/help/requests/${id}`,{method:'PATCH',body:{status,...(adminNotes!==undefined?{adminNotes}:{})}});await renderRequests()}catch(e){alert(e.message)}
  }

  function openNotes(r){if(!r)return;const m=document.createElement('div');m.className='bv5-modal';m.innerHTML=`<form class="bv5-form"><button type="button" class="bv5-close">×</button><h2>ملاحظات الطلب</h2><p class="bv5-note">${esc(r.tracking_number)} — ${esc(r.full_name)}</p><label>ملاحظات الإدارة<textarea name="notes" rows="6" maxlength="4000">${esc(r.admin_notes||'')}</textarea></label><div class="bv5-submit"><button type="button" class="bv5-cancel">إلغاء</button><button class="primary">حفظ الملاحظة</button></div><small class="bv5-msg"></small></form>`;document.body.appendChild(m);const close=()=>m.remove();$('.bv5-close',m).onclick=close;$('.bv5-cancel',m).onclick=close;m.onclick=e=>{if(e.target===m)close()};$('form',m).onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('.bv5-msg',f),btn=$('.primary',f);try{btn.disabled=true;msg.textContent='جاري الحفظ...';await api(`/api/help/requests/${r.id}`,{method:'PATCH',body:{adminNotes:f.elements.notes.value}});close();renderRequests()}catch(x){msg.textContent=x.message}finally{btn.disabled=false}}}

  function openConvert(r){if(!r)return;const m=document.createElement('div');m.className='bv5-modal';const options=projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');m.innerHTML=`<form class="bv5-form"><button type="button" class="bv5-close">×</button><h2>اعتماد الطلب وتحويله إلى مستفيد</h2><div class="bv5-note"><strong>${esc(r.tracking_number)}</strong><br>${esc(r.full_name)} — ${esc(r.case_type)} — ${esc(r.location)}</div><label>المشروع<select name="project_id"><option value="">بدون مشروع حاليًا</option>${options}</select></label><label>الخدمة المقدمة<input name="service" value="${esc(r.case_type||'دعم إنساني')}" required></label><label>حالة المستفيد<select name="status"><option value="active">نشط</option><option value="completed">مكتمل</option><option value="inactive">موقوف</option></select></label><label>ملاحظات المتابعة<textarea name="notes" rows="5">رقم الطلب: ${esc(r.tracking_number)}\nالموقع: ${esc(r.location)}\nالوصف: ${esc(r.description)}</textarea></label><div class="bv5-submit"><button type="button" class="bv5-cancel">إلغاء</button><button class="primary">اعتماد وإنشاء المستفيد</button></div><small class="bv5-msg"></small></form>`;document.body.appendChild(m);const close=()=>m.remove();$('.bv5-close',m).onclick=close;$('.bv5-cancel',m).onclick=close;m.onclick=e=>{if(e.target===m)close()};$('form',m).onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('.bv5-msg',f),btn=$('.primary',f),fd=new FormData(f);const body={name:r.full_name,phone:r.phone,service:fd.get('service'),status:fd.get('status'),project_id:fd.get('project_id')||null,notes:fd.get('notes')};try{btn.disabled=true;msg.textContent='جاري إنشاء سجل المستفيد...';await api('/api/beneficiaries',{method:'POST',body});msg.textContent='جاري اعتماد الطلب...';await api(`/api/help/requests/${r.id}`,{method:'PATCH',body:{status:'approved',adminNotes:`تم تحويل الطلب إلى مستفيد بتاريخ ${new Date().toLocaleString('ar-SD')}`}});close();renderRequests()}catch(x){msg.textContent=x.message}finally{btn.disabled=false}}}

  function beneficiaryCard(b){return `<article class="bv5-beneficiary" data-search="${esc(`${b.name||''} ${b.phone||''} ${b.service||''} ${projectName(b.project_id)}`.toLowerCase())}" data-status="${esc(b.status||'active')}"><div class="bv5-row"><div><span class="bv5-badge ${esc(b.status||'active')}">${esc(statusText[b.status]||b.status||'نشط')}</span><h4>${esc(b.name)}</h4></div><strong>${esc(projectName(b.project_id))}</strong></div><div class="bv5-meta"><span>الهاتف: ${esc(b.phone||'—')}</span><span>الخدمة: ${esc(b.service||'—')}</span><span>تاريخ التسجيل: ${date(b.created_at)}</span></div>${b.notes?`<p>${esc(b.notes)}</p>`:''}<div class="bv5-actions"><button data-beneficiary-edit="${b.id}">تعديل</button><button data-beneficiary-status="${b.id}" data-next="completed">إكمال</button><button data-beneficiary-status="${b.id}" data-next="inactive">إيقاف</button><button class="danger" data-beneficiary-delete="${b.id}">حذف</button></div></article>`}

  async function renderBeneficiaries(){
    const content=$('#dashContent'),title=$('#dashTitle');if(!content)return;if(title)title.textContent='إدارة المستفيدين';content.innerHTML='<div class="loading">جاري تحميل المستفيدين...</div>';
    try{[beneficiaries,projects,requests]=await Promise.all([api('/api/beneficiaries'),api('/api/projects'),api('/api/help/requests')]);content.innerHTML=`<section class="bv5-head"><div><span class="tag">المرحلة الخامسة</span><h3>مركز إدارة المستفيدين</h3><p>إدارة السجلات وربط كل مستفيد بالمشروع والخدمة المناسبة.</p></div><button class="primary bv5-add" id="bv5AddBeneficiary">+ مستفيد جديد</button></section>${kpis()}<div class="bv5-tools"><input id="bv5BeneficiarySearch" placeholder="ابحث بالاسم أو الهاتف أو المشروع"><select id="bv5BeneficiaryFilter"><option value="all">كل الحالات</option><option value="active">نشط</option><option value="completed">مكتمل</option><option value="inactive">موقوف</option></select><span class="count-badge">${beneficiaries.length} مستفيد</span></div><div class="bv5-list">${beneficiaries.length?beneficiaries.map(beneficiaryCard).join(''):'<div class="bv5-empty">لا توجد سجلات مستفيدين بعد.</div>'}</div>`;$('#bv5AddBeneficiary').onclick=()=>openBeneficiary();$('#bv5BeneficiarySearch').oninput=filterBeneficiaries;$('#bv5BeneficiaryFilter').onchange=filterBeneficiaries;$$('[data-beneficiary-edit]').forEach(b=>b.onclick=()=>openBeneficiary(beneficiaries.find(x=>String(x.id)===b.dataset.beneficiaryEdit)));$$('[data-beneficiary-status]').forEach(b=>b.onclick=()=>updateBeneficiary(b.dataset.beneficiaryStatus,{status:b.dataset.next}));$$('[data-beneficiary-delete]').forEach(b=>b.onclick=()=>deleteBeneficiary(b.dataset.beneficiaryDelete))}catch(e){content.innerHTML=`<div class="error-msg">${esc(e.message)}</div>`}
  }

  function filterBeneficiaries(){const q=$('#bv5BeneficiarySearch')?.value.trim().toLowerCase()||'',f=$('#bv5BeneficiaryFilter')?.value||'all';$$('.bv5-beneficiary').forEach(c=>{c.hidden=!((!q||c.dataset.search.includes(q))&&(f==='all'||c.dataset.status===f))})}

  function openBeneficiary(item={}){const m=document.createElement('div');m.className='bv5-modal';const options=projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');m.innerHTML=`<form class="bv5-form"><button type="button" class="bv5-close">×</button><h2>${item.id?'تعديل المستفيد':'إضافة مستفيد جديد'}</h2><div class="bv5-two"><label>الاسم<input name="name" value="${esc(item.name||'')}" required></label><label>الهاتف<input name="phone" value="${esc(item.phone||'')}"></label></div><label>الخدمة<input name="service" value="${esc(item.service||'')}" required></label><div class="bv5-two"><label>المشروع<select name="project_id"><option value="">بدون مشروع</option>${options}</select></label><label>الحالة<select name="status"><option value="active">نشط</option><option value="completed">مكتمل</option><option value="inactive">موقوف</option></select></label></div><label>ملاحظات<textarea name="notes" rows="5">${esc(item.notes||'')}</textarea></label><div class="bv5-submit"><button type="button" class="bv5-cancel">إلغاء</button><button class="primary">حفظ</button></div><small class="bv5-msg"></small></form>`;document.body.appendChild(m);if(item.project_id)$('[name=project_id]',m).value=item.project_id;if(item.status)$('[name=status]',m).value=item.status;const close=()=>m.remove();$('.bv5-close',m).onclick=close;$('.bv5-cancel',m).onclick=close;m.onclick=e=>{if(e.target===m)close()};$('form',m).onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('.bv5-msg',f),btn=$('.primary',f),fd=new FormData(f),body={name:fd.get('name'),phone:fd.get('phone')||null,service:fd.get('service'),status:fd.get('status'),project_id:fd.get('project_id')||null,notes:fd.get('notes')||null};try{btn.disabled=true;msg.textContent='جاري الحفظ...';await api(item.id?`/api/beneficiaries/${item.id}`:'/api/beneficiaries',{method:item.id?'PATCH':'POST',body});close();renderBeneficiaries()}catch(x){msg.textContent=x.message}finally{btn.disabled=false}}}

  async function updateBeneficiary(id,body){try{await api(`/api/beneficiaries/${id}`,{method:'PATCH',body});renderBeneficiaries()}catch(e){alert(e.message)}}
  async function deleteBeneficiary(id){if(!confirm('حذف سجل المستفيد نهائيًا؟'))return;try{await api(`/api/beneficiaries/${id}`,{method:'DELETE'});renderBeneficiaries()}catch(e){alert(e.message)}}

  function install(){
    const help=ensureHelpButton(),beneficiaryBtn=$('[data-view="beneficiaries"]');
    if(help&&!help.dataset.bv5){help.dataset.bv5='1';help.addEventListener('click',e=>{e.preventDefault();renderRequests()},true)}
    if(beneficiaryBtn&&!beneficiaryBtn.dataset.bv5){beneficiaryBtn.dataset.bv5='1';beneficiaryBtn.addEventListener('click',e=>{e.preventDefault();renderBeneficiaries()},true)}
    window.openHelpRequestsV5=renderRequests;window.openBeneficiariesV5=renderBeneficiaries;
  }
  const timer=setInterval(()=>{if($('#dash')){install();if($('[data-view="beneficiaries"]'))clearInterval(timer)}},300);
})();