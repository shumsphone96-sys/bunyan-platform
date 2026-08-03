const P_API_ORIGINS=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
const P_TOKEN_KEY='bunyan_v2_token';
const P_ORIGIN_KEY='bunyan_v2_origin';
const p$=s=>document.querySelector(s);
const pEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pStatusLabels={new:'جديد',review:'قيد المراجعة',accepted:'مقبول',rejected:'مرفوض',completed:'مكتمل'};
let participationRows=[];

async function pApi(path,options={}){
  const token=sessionStorage.getItem(P_TOKEN_KEY)||'';
  const preferred=sessionStorage.getItem(P_ORIGIN_KEY)||P_API_ORIGINS[0];
  const headers={...(options.headers||{})};
  if(token)headers.Authorization=`Bearer ${token}`;
  if(options.body){headers['Content-Type']='application/json';options={...options,body:typeof options.body==='string'?options.body:JSON.stringify(options.body)}}
  let lastError;
  for(const origin of [preferred,...P_API_ORIGINS.filter(x=>x!==preferred)]){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      const response=await fetch(origin+path,{...options,headers,cache:'no-store',signal:controller.signal});
      const text=await response.text();
      let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok){const error=new Error(data.error||`فشل الطلب (${response.status})`);error.status=response.status;throw error}
      sessionStorage.setItem(P_ORIGIN_KEY,origin);return data;
    }catch(error){lastError=error;if(error.status&&error.status<500)break}
    finally{clearTimeout(timer)}
  }
  throw lastError||new Error('تعذر الاتصال بالخادم');
}

function pDate(value){return value?new Date(value).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'—'}
function pPhone(value){return String(value||'').replace(/[^+\d]/g,'')}
function pField(label,value,wide=false){return `<div class="help-field ${wide?'wide':''}"><span>${pEsc(label)}</span><strong>${pEsc(value||'—')}</strong></div>`}
function pRole(row){return row.role||row.type||row.interest||row.category||row.participation_type||'—'}

function renderParticipation(filter='all'){
  const list=filter==='all'?participationRows:participationRows.filter(row=>(row.status||'new')===filter);
  p$('#content').innerHTML=`
    <section class="help-workspace">
      <div class="section-head"><div><h3>طلبات المشاركة</h3><p>راجع بيانات المتقدم، تواصل معه، ثم حدّث حالة الطلب.</p></div><span>${list.length} من ${participationRows.length}</span></div>
      <div class="help-filters" role="group" aria-label="تصفية طلبات المشاركة">
        ${[['all','الكل'],['new','جديد'],['review','قيد المراجعة'],['accepted','مقبول'],['rejected','مرفوض'],['completed','مكتمل']].map(([value,label])=>`<button data-participation-filter="${value}" class="${filter===value?'active':''}">${label}<small>${value==='all'?participationRows.length:participationRows.filter(x=>(x.status||'new')===value).length}</small></button>`).join('')}
      </div>
      ${list.length?`<div class="help-list">${list.map((row,index)=>{
        const phone=pPhone(row.phone);
        const current=row.status||'new';
        const reference=row.tracking_number||row.reference||`مشاركة ${index+1}`;
        return `<article class="help-card" data-participation-id="${pEsc(row.id)}">
          <header><div><span class="tracking">${pEsc(reference)}</span><h4>${pEsc(row.name||row.full_name||'بدون اسم')}</h4></div><span class="status status-${pEsc(current)}">${pEsc(pStatusLabels[current]||current)}</span></header>
          <div class="help-grid">
            ${pField('الهاتف',row.phone)}${pField('نوع المشاركة',pRole(row))}${pField('البريد الإلكتروني',row.email)}${pField('تاريخ الإرسال',pDate(row.created_at))}${pField('الرسالة أو التفاصيل',row.message||row.details||row.notes,true)}
          </div>
          <footer>
            <div class="help-contact">${phone?`<a class="ghost compact" href="tel:${pEsc(phone)}">اتصال</a><a class="ghost compact" href="https://wa.me/${pEsc(phone.replace(/^\+/,''))}" target="_blank" rel="noopener">واتساب</a>`:'<span>لا يوجد رقم اتصال</span>'}</div>
            <div class="help-status-control">
              <select aria-label="حالة طلب المشاركة">${Object.entries(pStatusLabels).map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('')}</select>
              <button class="primary compact" data-participation-save>حفظ الحالة</button>
              <span class="inline-message" role="status"></span>
            </div>
          </footer>
        </article>`}).join('')}</div>`:'<div class="empty">لا توجد طلبات بهذه الحالة.</div>'}
    </section>`;
}

async function openParticipation(){
  p$('#pageTitle').textContent='طلبات المشاركة';
  document.querySelectorAll('#adminNav [data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='participation'));
  p$('#sidebar').classList.remove('open');p$('#backdrop').classList.remove('show');p$('#backdrop').hidden=true;
  p$('#content').innerHTML='<div class="loading">جاري تحميل طلبات المشاركة...</div>';
  try{
    const data=await pApi('/api/requests');
    participationRows=Array.isArray(data)?data:[];
    p$('#participationBadge').textContent=participationRows.filter(x=>(x.status||'new')==='new').length;
    renderParticipation();
  }catch(error){
    if(error.status===401){sessionStorage.removeItem(P_TOKEN_KEY);location.reload();return}
    p$('#content').innerHTML=`<div class="error">${pEsc(error.message)}</div><button class="ghost" data-participation-retry>إعادة المحاولة</button>`;
  }
}

document.addEventListener('click',async event=>{
  const nav=event.target.closest('#adminNav [data-view="participation"]');
  if(nav){event.preventDefault();event.stopImmediatePropagation();await openParticipation();return}
  const filter=event.target.closest('[data-participation-filter]');
  if(filter){renderParticipation(filter.dataset.participationFilter);return}
  const retry=event.target.closest('[data-participation-retry]');
  if(retry){await openParticipation();return}
  const save=event.target.closest('[data-participation-save]');
  if(!save)return;
  const card=save.closest('.help-card');
  const message=card.querySelector('.inline-message');
  const status=card.querySelector('select').value;
  try{
    save.disabled=true;message.textContent='جاري الحفظ...';
    await pApi(`/api/requests/${card.dataset.participationId}`,{method:'PATCH',body:{status}});
    message.textContent='تم الحفظ بنجاح';
    await openParticipation();
  }catch(error){message.textContent=error.message;save.disabled=false}
},true);
