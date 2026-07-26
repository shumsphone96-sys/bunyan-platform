(function(){
  const fileToBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('تعذر قراءة الملف'));reader.readAsDataURL(file)});
  const api=async(path,options={})=>{
    const headers={...(options.headers||{})};
    if(!options.raw)headers['Content-Type']='application/json';
    if(state.token)headers.Authorization=`Bearer ${state.token}`;
    const res=await fetch(`${API}${path}`,{...options,headers});
    if(options.raw){if(!res.ok)throw new Error(`فشل تنزيل الملف (${res.status})`);return res}
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
    if(!res.ok)throw new Error(data?.error||`فشل الاتصال (${res.status})`);return data;
  };

  donateForm.onsubmit=async e=>{
    e.preventDefault();
    donateMsg.textContent='جارٍ حفظ المساهمة...';
    const form=new FormData(e.target),file=form.get('receipt');
    const body={donor:form.get('donor'),phone:form.get('phone'),amount:Number(form.get('amount')),currency:form.get('currency'),projectName:form.get('projectName'),method:form.get('method'),reference:form.get('reference')};
    Object.keys(body).forEach(k=>body[k]===''&&delete body[k]);
    try{
      if(file&&file.size){
        if(file.size>3*1024*1024)throw new Error('حجم إشعار التحويل يجب ألا يتجاوز 3 ميغابايت');
        if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('المسموح صورة JPG أو PNG أو WEBP أو ملف PDF');
      }
      const donation=await request('/api/public/donations',{method:'POST',body:JSON.stringify(body)});
      if(file&&file.size){
        donateMsg.textContent='تم حفظ المساهمة، جارٍ رفع إشعار التحويل...';
        const base64=await fileToBase64(file);
        await api(`/api/public/donations/${donation.id}/receipt`,{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:file.type,base64})});
      }
      e.target.reset();
      donateMsg.textContent=file&&file.size?'تم تسجيل المساهمة وإرفاق إشعار التحويل بنجاح.':'تم تسجيل المساهمة بنجاح.';
      setTimeout(()=>donateModal.classList.remove('show'),1400);
    }catch(err){donateMsg.textContent=err.message}
  };

  async function downloadReceipt(donationId){
    try{
      const receipt=await api(`/api/donations/${donationId}/receipt`);
      if(!receipt){alert('لا يوجد إشعار تحويل مرفق لهذه المساهمة.');return}
      const res=await api(`/api/donation-receipts/${receipt.id}/download`,{raw:true});
      const blob=await res.blob(),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download=receipt.file_name||'transfer-receipt';a.click();URL.revokeObjectURL(a.href);
    }catch(err){alert(err.message)}
  }

  const previousRenderTable=renderTable;
  renderTable=function(type,rows){
    previousRenderTable(type,rows);
    if(type!=='donations')return;
    const current=filterRows(type,rows);
    const trs=$$('#dashContent table tr').slice(1);
    trs.forEach((tr,index)=>{
      const row=current[index];if(!row)return;
      const actions=tr.querySelector('.row-actions');
      if(actions&&!actions.querySelector('[data-receipt]')){
        const button=document.createElement('button');
        button.className='mini details';button.textContent='إشعار التحويل';button.dataset.receipt=row.id;
        button.onclick=()=>downloadReceipt(row.id);
        actions.insertBefore(button,actions.firstChild);
      }
    });
  };
})();
