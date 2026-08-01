const API_ORIGINS=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
const state={token:sessionStorage.getItem('bunyan_v2_token')||'',origin:sessionStorage.getItem('bunyan_v2_origin')||API_ORIGINS[0],view:'dashboard'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'—';
const statusLabels={new:'جديد',review:'قيد المراجعة',approved:'معتمد',accepted:'مقبول',rejected:'مرفوض',completed:'مكتمل',pending:'قيد المراجعة',verified:'موثق',active:'نشط',inactive:'متوقف',draft:'مسودة',published:'منشور'};

async function request(path,options={}){
  const requestOptions={...options};
  const headers={...(requestOptions.headers||{})};
  if(state.token)headers.Authorization=`Bearer ${state.token}`;
  if(requestOptions.body&&!(requestOptions.body instanceof FormData)){
    headers['Content-Type']='application/json';
    if(typeof requestOptions.body!=='string')requestOptions.body=JSON.stringify(requestOptions.body);
  }
  let lastError;
  for(const origin of [state.origin,...API_ORIGINS.filter(x=>x!==state.origin)]){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(origin+path,{...requestOptions,headers,cache:'no-store',signal:controller.signal});
      const text=await response.text();
      let data={};
      try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok){
        const error=new Error(data.error||`فشل الطلب (${response.status})`);
        error.status=response.status;
        throw error;
      }
      state.origin=origin;
      sessionStorage.setItem('bunyan_v2_origin',origin);
      return data;
    }catch(error){
      lastError=error;
      if(error.status&&error.status<500)break;
    }finally{clearTimeout(timer)}
  }
  if(lastError?.name==='AbortError')throw new Error('انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.');
  throw lastError||new Error('تعذر الاتصال بالخادم');
}

function showLogin(message=''){$('#appView').hidden=true;$('#loginView').hidden=false;$('#loginMessage').textContent=message}
function showApp(){$('#loginView').hidden=true;$('#appView').hidden=false}
function clearSession(){state.token='';sessionStorage.removeItem('bunyan_v2_token')}
function closeMenu(){$('#sidebar').classList.remove('open');$('#backdrop').classList.remove('show');$('#backdrop').hidden=true}
function openMenu(){$('#sidebar').classList.add('open');$('#backdrop').hidden=false;$('#backdrop').classList.add('show')}

const titles={dashboard:'نظرة عامة',help:'طلبات المساعدة',participation:'طلبات المشاركة',donations:'التبرعات',projects:'المشروعات',beneficiaries:'المستفيدون',volunteers:'المتطوعون',news:'الأخبار'};
const endpoints={help:'/api/help/requests',participation:'/api/requests',donations:'/api/donations',projects:'/api/projects',beneficiaries:'/api/beneficiaries',volunteers:'/api/volunteers',news:'/api/news'};
const configs={
  help:[['tracking_number','رقم التتبع'],['full_name','الاسم'],['phone','الهاتف'],['case_type','نوع الحالة'],['location','الموقع'],['description','وصف الحالة'],['status','الحالة',v=>statusLabels[v]||v],['created_at','تاريخ الإرسال',fmtDate]],
  participation:[['name','الاسم'],['phone','الهاتف'],['role','نوع المشاركة'],['message','الرسالة'],['status','الحالة',v=>statusLabels[v]||v],['created_at','تاريخ الإرسال',fmtDate]],
  donations:[['donor','المساهم'],['phone','الهاتف'],['amount','المبلغ',(v,r)=>`${v??0} ${r.currency||''}`],['project_name','المشروع'],['status','الحالة',v=>statusLabels[v]||v],['created_at','التاريخ',fmtDate]],
  projects:[['name','المشروع'],['summary','الملخص'],['status','الحالة',v=>statusLabels[v]||v],['progress','الإنجاز',v=>`${v??0}%`],['budget','الميزانية',(v,r)=>`${v??0} ${r.currency||''}`],['created_at','تاريخ الإنشاء',fmtDate]],
  beneficiaries:[['name','الاسم'],['phone','الهاتف'],['service','الخدمة'],['status','الحالة',v=>statusLabels[v]||v],['notes','الملاحظات'],['created_at','التاريخ',fmtDate]],
  volunteers:[['name','الاسم'],['phone','الهاتف'],['email','البريد'],['skill','المهارة'],['hours','الساعات'],['status','الحالة',v=>statusLabels[v]||v]],
  news:[['title','العنوان'],['body','المحتوى'],['published_at','تاريخ النشر',fmtDate],['created_at','تاريخ الإنشاء',fmtDate]]
};

function field(label,value){return `<div class="field"><span>${esc(label)}</span><strong>${esc(value??'—')}</strong></div>`}
function statusEditor(view,row){
  if(!['help','participation'].includes(view))return '';
  const options=view==='help'
    ?[['new','جديد'],['review','قيد المراجعة'],['approved','معتمد'],['rejected','مرفوض'],['completed','مكتمل']]
    :[['new','جديد'],['review','قيد المراجعة'],['accepted','مقبول'],['rejected','مرفوض'],['completed','مكتمل']];
  return `<div class="record-actions"><select data-status>${options.map(([value,label])=>`<option value="${value}" ${row.status===value?'selected':''}>${label}</option>`).join('')}</select><button class="primary compact" data-save-status data-id="${esc(row.id)}" data-view="${view}">حفظ الحالة</button><span class="inline-message" role="status"></span></div>`;
}
function recordsView(view,title,rows,fields){return `<div class="section-head"><h3>${esc(title)}</h3><span>${rows.length} سجل</span></div>${rows.length?`<div class="records">${rows.map(row=>`<article class="record">${fields.map(([key,label,format])=>field(label,format?format(row[key],row):row[key])).join('')}${statusEditor(view,row)}</article>`).join('')}</div>`:'<div class="empty">لا توجد سجلات حتى الآن.</div>'}`}

async function loadDashboard(){
  const content=$('#content');content.innerHTML='<div class="loading">جاري تحميل المؤشرات...</div>';
  const [dashboard,help,participation]=await Promise.all([request('/api/dashboard'),request('/api/help/requests'),request('/api/requests')]);
  const newHelp=Array.isArray(help)?help.filter(x=>x.status==='new').length:0;
  const newParticipation=Array.isArray(participation)?participation.filter(x=>x.status==='new').length:0;
  $('#helpBadge').textContent=newHelp;$('#participationBadge').textContent=newParticipation;
  content.innerHTML=`<div class="kpis"><article class="kpi"><span>المشروعات</span><strong>${esc(dashboard.projects||0)}</strong></article><article class="kpi"><span>المستفيدون</span><strong>${esc(dashboard.beneficiaries||0)}</strong></article><article class="kpi"><span>المتطوعون</span><strong>${esc(dashboard.volunteers||0)}</strong></article><article class="kpi"><span>طلبات المساعدة الجديدة</span><strong>${newHelp}</strong></article><article class="kpi"><span>طلبات المشاركة الجديدة</span><strong>${newParticipation}</strong></article><article class="kpi"><span>التبرعات</span><strong>${esc(dashboard.donations||0)}</strong></article></div>`;
}

async function loadList(view){
  const rows=await request(endpoints[view]);
  const safeRows=Array.isArray(rows)?rows:[];
  $('#content').innerHTML=recordsView(view,titles[view],safeRows,configs[view]);
  if(view==='help')$('#helpBadge').textContent=safeRows.filter(x=>x.status==='new').length;
  if(view==='participation')$('#participationBadge').textContent=safeRows.filter(x=>x.status==='new').length;
}

async function saveStatus(button){
  const record=button.closest('.record');
  const message=record.querySelector('.inline-message');
  const status=record.querySelector('[data-status]').value;
  const view=button.dataset.view;
  const path=view==='help'?`/api/help/requests/${button.dataset.id}`:`/api/requests/${button.dataset.id}`;
  try{
    button.disabled=true;message.textContent='جاري الحفظ...';
    await request(path,{method:'PATCH',body:{status}});
    message.textContent='تم الحفظ';
    await load(view);
  }catch(error){message.textContent=error.message;button.disabled=false}
}

async function load(view=state.view){
  state.view=view;$('#pageTitle').textContent=titles[view]||view;
  document.querySelectorAll('#adminNav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#content').innerHTML='<div class="loading">جاري التحميل...</div>';closeMenu();
  try{if(view==='dashboard')await loadDashboard();else await loadList(view)}catch(error){
    if(error.status===401){clearSession();showLogin('انتهت الجلسة. سجّل الدخول من جديد.');return}
    $('#content').innerHTML=`<div class="error">${esc(error.message)}</div><button class="ghost" id="retryButton">إعادة المحاولة</button>`;
    $('#retryButton')?.addEventListener('click',()=>load(view));
  }
}

$('#loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const message=$('#loginMessage');const button=form.querySelector('button[type="submit"]');
  if(!form.reportValidity())return;
  try{button.disabled=true;message.textContent='جاري التحقق...';const result=await request('/api/auth/login',{method:'POST',body:{email:form.elements.email.value.trim(),password:form.elements.password.value}});state.token=result.token;sessionStorage.setItem('bunyan_v2_token',result.token);form.reset();showApp();await load('dashboard')}
  catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#adminNav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)load(button.dataset.view)});
$('#content').addEventListener('click',event=>{const button=event.target.closest('[data-save-status]');if(button)saveStatus(button)});
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.contains('open')?closeMenu():openMenu());
$('#backdrop').addEventListener('click',closeMenu);
$('#refreshButton').addEventListener('click',()=>load(state.view));
$('#logoutButton').addEventListener('click',()=>{clearSession();showLogin('تم تسجيل الخروج.')});

(async()=>{if(!state.token)return showLogin();try{await request('/api/auth/me');showApp();await load('dashboard')}catch{clearSession();showLogin('سجّل الدخول إلى لوحة الإدارة الجديدة.')}})();
