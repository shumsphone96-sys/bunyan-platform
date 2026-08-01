const API_ORIGINS=['https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
const state={token:sessionStorage.getItem('bunyan_v2_token')||'',origin:sessionStorage.getItem('bunyan_v2_origin')||API_ORIGINS[0],view:'dashboard'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'—';

async function request(path,options={}){
  const headers={...(options.headers||{})};
  if(state.token)headers.Authorization=`Bearer ${state.token}`;
  if(options.body&&!(options.body instanceof FormData)){headers['Content-Type']='application/json';options.body=JSON.stringify(options.body)}
  let last;
  for(const origin of [state.origin,...API_ORIGINS.filter(x=>x!==state.origin)]){
    try{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
      const response=await fetch(origin+path,{...options,headers,cache:'no-store',signal:controller.signal});clearTimeout(timer);
      const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok){const e=new Error(data.error||`فشل الطلب (${response.status})`);e.status=response.status;throw e}
      state.origin=origin;sessionStorage.setItem('bunyan_v2_origin',origin);return data;
    }catch(error){last=error;if(error.status&&error.status<500)break}
  }
  throw last||new Error('تعذر الاتصال بالخادم');
}

function showLogin(message=''){$('#appView').hidden=true;$('#loginView').hidden=false;$('#loginMessage').textContent=message}
function showApp(){$('#loginView').hidden=true;$('#appView').hidden=false}
function closeMenu(){$('#sidebar').classList.remove('open');$('#backdrop').classList.remove('show');$('#backdrop').hidden=true}
function openMenu(){$('#sidebar').classList.add('open');$('#backdrop').hidden=false;$('#backdrop').classList.add('show')}

const titles={dashboard:'نظرة عامة',help:'طلبات المساعدة',participation:'طلبات المشاركة',donations:'التبرعات',projects:'المشروعات',beneficiaries:'المستفيدون',volunteers:'المتطوعون',news:'الأخبار'};
const endpoints={help:'/api/help/requests',participation:'/api/requests',donations:'/api/donations',projects:'/api/projects',beneficiaries:'/api/beneficiaries',volunteers:'/api/volunteers',news:'/api/news'};

function field(label,value){return `<div class="field"><span>${esc(label)}</span><strong>${esc(value??'—')}</strong></div>`}
function recordsView(title,rows,fields){return `<div class="section-head"><h3>${esc(title)}</h3><span>${rows.length} سجل</span></div>${rows.length?`<div class="records">${rows.map(row=>`<article class="record">${fields.map(([key,label,format])=>field(label,format?format(row[key],row):row[key])).join('')}</article>`).join('')}</div>`:'<div class="empty">لا توجد سجلات حتى الآن.</div>'}`}

async function loadDashboard(){
  const content=$('#content');content.innerHTML='<div class="loading">جاري تحميل المؤشرات...</div>';
  const [dashboard,help,participation]=await Promise.all([request('/api/dashboard'),request('/api/help/requests'),request('/api/requests')]);
  const newHelp=Array.isArray(help)?help.filter(x=>x.status==='new').length:0;
  const newParticipation=Array.isArray(participation)?participation.filter(x=>x.status==='new').length:0;
  $('#helpBadge').textContent=newHelp;$('#participationBadge').textContent=newParticipation;
  content.innerHTML=`<div class="kpis">
    <article class="kpi"><span>المشروعات</span><strong>${esc(dashboard.projects||0)}</strong></article>
    <article class="kpi"><span>المستفيدون</span><strong>${esc(dashboard.beneficiaries||0)}</strong></article>
    <article class="kpi"><span>المتطوعون</span><strong>${esc(dashboard.volunteers||0)}</strong></article>
    <article class="kpi"><span>طلبات المساعدة الجديدة</span><strong>${newHelp}</strong></article>
    <article class="kpi"><span>طلبات المشاركة الجديدة</span><strong>${newParticipation}</strong></article>
    <article class="kpi"><span>التبرعات</span><strong>${esc(dashboard.donations||0)}</strong></article>
  </div>`;
}

async function loadList(view){
  const rows=await request(endpoints[view]);
  const configs={
    help:[['tracking_number','رقم التتبع'],['full_name','الاسم'],['phone','الهاتف'],['case_type','نوع الحالة'],['location','الموقع'],['status','الحالة'],['created_at','تاريخ الإرسال',fmtDate]],
    participation:[['name','الاسم'],['phone','الهاتف'],['role','نوع المشاركة'],['message','الرسالة'],['status','الحالة'],['created_at','تاريخ الإرسال',fmtDate]],
    donations:[['donor','المساهم'],['phone','الهاتف'],['amount','المبلغ',(v,r)=>`${v??0} ${r.currency||''}`],['project_name','المشروع'],['status','الحالة'],['created_at','التاريخ',fmtDate]],
    projects:[['name','المشروع'],['summary','الملخص'],['status','الحالة'],['progress','الإنجاز',v=>`${v??0}%`],['budget','الميزانية',(v,r)=>`${v??0} ${r.currency||''}`],['created_at','تاريخ الإنشاء',fmtDate]],
    beneficiaries:[['name','الاسم'],['phone','الهاتف'],['service','الخدمة'],['status','الحالة'],['notes','الملاحظات'],['created_at','التاريخ',fmtDate]],
    volunteers:[['name','الاسم'],['phone','الهاتف'],['email','البريد'],['skill','المهارة'],['hours','الساعات'],['status','الحالة']],
    news:[['title','العنوان'],['body','المحتوى'],['published_at','تاريخ النشر',fmtDate],['created_at','تاريخ الإنشاء',fmtDate]]
  };
  $('#content').innerHTML=recordsView(titles[view],Array.isArray(rows)?rows:[],configs[view]);
  if(view==='help')$('#helpBadge').textContent=(rows||[]).filter(x=>x.status==='new').length;
  if(view==='participation')$('#participationBadge').textContent=(rows||[]).filter(x=>x.status==='new').length;
}

async function load(view=state.view){
  state.view=view;$('#pageTitle').textContent=titles[view]||view;
  document.querySelectorAll('#adminNav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#content').innerHTML='<div class="loading">جاري التحميل...</div>';closeMenu();
  try{if(view==='dashboard')await loadDashboard();else await loadList(view)}catch(error){
    if(error.status===401){state.token='';sessionStorage.removeItem('bunyan_v2_token');showLogin('انتهت الجلسة. سجّل الدخول من جديد.');return}
    $('#content').innerHTML=`<div class="error">${esc(error.message)}</div>`;
  }
}

$('#loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const message=$('#loginMessage');const button=form.querySelector('button[type="submit"]');
  try{button.disabled=true;message.textContent='جاري التحقق...';const result=await request('/api/auth/login',{method:'POST',body:{email:form.elements.email.value.trim(),password:form.elements.password.value}});state.token=result.token;sessionStorage.setItem('bunyan_v2_token',result.token);showApp();await load('dashboard')}
  catch(error){message.textContent=error.message}finally{button.disabled=false}
});
$('#adminNav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)load(button.dataset.view)});
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.contains('open')?closeMenu():openMenu());
$('#backdrop').addEventListener('click',closeMenu);
$('#refreshButton').addEventListener('click',()=>load(state.view));
$('#logoutButton').addEventListener('click',()=>{state.token='';sessionStorage.removeItem('bunyan_v2_token');showLogin('تم تسجيل الخروج.')});

(async()=>{if(!state.token)return showLogin();try{await request('/api/auth/me');showApp();await load('dashboard')}catch{state.token='';sessionStorage.removeItem('bunyan_v2_token');showLogin('سجّل الدخول إلى لوحة الإدارة الجديدة.')}})();
