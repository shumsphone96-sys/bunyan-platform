(function(){
  const oldRenderTable=renderTable;
  function api(path,options={}){
    const headers={...(options.headers||{})};
    if(!options.raw)headers['Content-Type']='application/json';
    if(state.token)headers.Authorization=`Bearer ${state.token}`;
    return fetch(`${API}${path}`,{...options,headers}).then(async res=>{
      if(options.raw){if(!res.ok)throw new Error(`فشل تنزيل الملف (${res.status})`);return res}
      const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
      if(!res.ok)throw new Error(data?.error||`فشل الاتصال (${res.status})`);return data;
    });
  }
  function ensureModal(){
    if($('#requestDetailsModal'))return;
    document.body.insertAdjacentHTML('beforeend','<div class="modal request-modal" id="requestDetailsModal"><div class="request-panel"><button class="modal-close" id="closeRequestDetails">×</button><div id="requestDetailsContent"></div></div></div>');
    $('#closeRequestDetails').onclick=()=>$('#requestDetailsModal').classList.remove('show');
  }
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('تعذر قراءة الملف'));r.readAsDataURL(file)})}
  async function downloadAttachment(id,name){
    try{const res=await api(`/api/attachments/${id}/download`,{raw:true});const blob=await res.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'attachment';a.click();URL.revokeObjectURL(a.href)}catch(err){alert(err.message)}
  }
  async function openDetails(row){
    ensureModal();const modal=$('#requestDetailsModal'),content=$('#requestDetailsContent');modal.classList.add('show');loading(content,'جارٍ تحميل تفاصيل الطلب...');
    try{
      const [notes,files]=await Promise.all([api(`/api/requests/${row.id}/notes`),api(`/api/requests/${row.id}/attachments`)]);
      content.innerHTML=`<div class="request-head"><span class="status-pill s-${esc(row.status)}">${esc(statusText(row.status))}</span><h2>${esc(row.name)}</h2><p>${esc(row.role)} • ${esc(row.phone)}</p><p class="request-message">${esc(row.message||'لا توجد رسالة')}</p></div>
      <div class="request-section"><h3>الملاحظات الداخلية</h3><form id="noteForm" class="inline-form"><textarea name="note" maxlength="2000" placeholder="اكتب ملاحظة داخلية لا يراها مقدم الطلب" required></textarea><button class="primary">حفظ الملاحظة</button></form><div class="note-list">${notes.length?notes.map(n=>`<article><p>${esc(n.note)}</p><small>${esc(n.author||'مستخدم')} • ${date(n.created_at)}</small></article>`).join(''):'<p class="empty">لا توجد ملاحظات بعد.</p>'}</div></div>
      <div class="request-section"><h3>المستندات</h3><form id="fileForm" class="upload-form"><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" required><small>الحد الأقصى 2 ميغابايت.</small><button class="primary">رفع المستند</button></form><div class="file-list">${files.length?files.map(f=>`<article><div><strong>${esc(f.file_name)}</strong><small>${Math.ceil(Number(f.size_bytes)/1024)} كيلوبايت • ${date(f.created_at)}</small></div><div><button class="mini details" data-download="${esc(f.id)}" data-name="${esc(f.file_name)}">تنزيل</button><button class="danger mini" data-file-delete="${esc(f.id)}">حذف</button></div></article>`).join(''):'<p class="empty">لا توجد مستندات مرفوعة.</p>'}</div></div>`;
      $('#noteForm').onsubmit=async e=>{e.preventDefault();const note=new FormData(e.target).get('note');try{await api(`/api/requests/${row.id}/notes`,{method:'POST',body:JSON.stringify({note})});await openDetails(row)}catch(err){alert(err.message)}};
      $('#fileForm').onsubmit=async e=>{e.preventDefault();const file=e.target.file.files[0];if(!file)return;if(file.size>2*1024*1024){alert('حجم الملف يجب ألا يتجاوز 2 ميغابايت');return}try{const base64=await fileToBase64(file);await api(`/api/requests/${row.id}/attachments`,{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:file.type,base64})});await openDetails(row)}catch(err){alert(err.message)}};
      $$('[data-download]').forEach(b=>b.onclick=()=>downloadAttachment(b.dataset.download,b.dataset.name));
      $$('[data-file-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف المستند؟'))return;try{await api(`/api/attachments/${b.dataset.fileDelete}`,{method:'DELETE'});await openDetails(row)}catch(err){alert(err.message)}});
    }catch(err){showError(content,err)}
  }
  renderTable=function(type,rows){
    oldRenderTable(type,rows);
    if(type!=='requests')return;
    const current=filterRows(type,rows);
    const trs=$$('#dashContent tbody tr, #dashContent table tr').slice(1);
    trs.forEach((tr,index)=>{
      const row=current[index];if(!row)return;
      const actions=tr.querySelector('.row-actions');
      if(actions&&!actions.querySelector('[data-details]')){
        const b=document.createElement('button');b.className='mini details';b.textContent='تفاصيل';b.dataset.details=row.id;b.onclick=()=>openDetails(row);actions.insertBefore(b,actions.querySelector('.status-select'));
      }
    });
  };
})();
