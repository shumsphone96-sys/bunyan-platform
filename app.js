const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const API='https://bunyan-api-qhkf.onrender.com';
const state={token:sessionStorage.getItem('bunyan_token')||'',projects:[],news:[],cache:{}};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const date=v=>v?new Date(v).toLocaleDateString('ar-SD'):'—';

async function request(path,options={}){
  const headers={'Content-Type':'application/json',...(options.headers||{})};
  if(state.token)headers.Authorization=`Bearer ${state.token}`;
  const res=await fetch(`${API}${path}`,{...options,headers});
  const text=await res.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
  if(!res.ok)throw new Error(data?.error||`فشل الاتصال (${res.status})`);
  return data;
}

function loading(el,msg='جارٍ التحميل...'){el.innerHTML=`<p class="empty">${msg}</p>`}
function showError(el,err){el.innerHTML=`<p class="empty">تعذر الاتصال بالخادم: ${esc(err.message)}</p>`}

async function loadPublic(){
  loading(projectGrid);loading(newsGrid);
  try{
    const [projects,news]=await Promise.all([request('/api/public/projects'),request('/api/public/news')]);
    state.projects=projects;state.news=news;renderProjects();renderNews();
  }catch(err){showError(projectGrid,err);showError(newsGrid,err)}
}
function renderProjects(){projectGrid.innerHTML=state.projects.length?state.projects.map(p=>`<article><span class="status">${esc(p.status)}</span><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p><div class="progress"><i style="width:${Math.max(0,Math.min(100,Number(p.progress)||0))}%"></i></div><div class="meta"><span>الإنجاز ${Number(p.progress)||0}%</span><span>${Number(p.beneficiaries_target)||0} مستفيد</span></div></article>`).join(''):'<p class="empty">لا توجد مشروعات منشورة بعد.</p>'}
function renderNews(){newsGrid.innerHTML=state.news.length?state.news.map(n=>`<article><span class="status">${date(n.published_at||n.created_at)}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join(''):'<p class="empty">لا توجد أخبار منشورة بعد.</p>'}

menu.onclick=()=>nav.classList.toggle('open');$$('nav a').forEach(a=>a.onclick=()=>nav.classList.remove('open'));
adminBtn.onclick=()=>login.classList.add('show');close.onclick=()=>login.classList.remove('show');
site.onclick=()=>dash.classList.remove('show');
logout.onclick=()=>{state.token='';sessionStorage.removeItem('bunyan_token');dash.classList.remove('show')};

loginForm.onsubmit=async e=>{
  e.preventDefault();loginMsg.textContent='جارٍ تسجيل الدخول...';
  const f=new FormData(e.target);
  try{
    const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});
    state.token=data.token;sessionStorage.setItem('bunyan_token',data.token);login.classList.remove('show');dash.classList.add('show');await view('home');loginMsg.textContent='';
  }catch(err){loginMsg.textContent=err.message}
};
setupAdmin.onclick=async()=>{
  const f=new FormData(loginForm);const name=String(f.get('name')||'').trim();
  if(name.length<2){loginMsg.textContent='اكتب اسم المدير أولاً.';return}
  loginMsg.textContent='جارٍ إنشاء أول مدير...';
  try{
    const data=await request('/api/setup',{method:'POST',body:JSON.stringify({name,email:f.get('email'),password:f.get('password')})});
    state.token=data.token;sessionStorage.setItem('bunyan_token',data.token);login.classList.remove('show');dash.classList.add('show');await view('home');loginMsg.textContent='';
  }catch(err){loginMsg.textContent=err.message}
};

joinForm.onsubmit=async e=>{
  e.preventDefault();joinMsg.textContent='جارٍ الإرسال...';
  const body=Object.fromEntries(new FormData(e.target));
  try{await request('/api/public/participation-requests',{method:'POST',body:JSON.stringify(body)});e.target.reset();joinMsg.textContent='تم استلام طلبك وحفظه في النظام بنجاح.'}
  catch(err){joinMsg.textContent=err.message}
};
donateBtn.onclick=()=>donateModal.classList.add('show');closeDonate.onclick=()=>donateModal.classList.remove('show');
donateForm.onsubmit=async e=>{
  e.preventDefault();donateMsg.textContent='جارٍ التسجيل...';
  const body=Object.fromEntries(new FormData(e.target));body.amount=Number(body.amount);
  Object.keys(body).forEach(k=>body[k]===''&&delete body[k]);
  try{await request('/api/public/donations',{method:'POST',body:JSON.stringify(body)});e.target.reset();donateMsg.textContent='تم تسجيل المساهمة بنجاح.';setTimeout(()=>donateModal.classList.remove('show'),900)}
  catch(err){donateMsg.textContent=err.message}
};

$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
const defs={
 beneficiaries:{title:'المستفيدون',cols:[['name','الاسم'],['phone','الهاتف'],['service','الخدمة'],['status','الحالة']],fields:[['name','الاسم'],['phone','الهاتف'],['service','الخدمة'],['status','الحالة']]},
 volunteers:{title:'المتطوعون',cols:[['name','الاسم'],['phone','الهاتف'],['skill','المهارة'],['hours','الساعات'],['status','الحالة']],fields:[['name','الاسم'],['phone','الهاتف'],['skill','المهارة'],['hours','الساعات'],['status','الحالة']]},
 donations:{title:'التبرعات',cols:[['donor','المتبرع'],['amount','المبلغ'],['currency','العملة'],['project_name','المشروع'],['method','الدفع'],['status','الحالة']],fields:[['donor','المتبرع'],['phone','الهاتف'],['amount','المبلغ'],['currency','العملة'],['project_name','المشروع'],['method','الدفع'],['reference','المرجع'],['status','الحالة']]},
 news:{title:'الأخبار',cols:[['title','العنوان'],['published_at','تاريخ النشر'],['is_public','منشور']],fields:[['title','العنوان'],['body','النص'],['published_at','تاريخ النشر بصيغة 2026-07-25T12:00:00Z'],['is_public','منشور؟ true أو false']]},
 requests:{title:'طلبات المشاركة',cols:[['name','الاسم'],['phone','الهاتف'],['role','المشاركة'],['status','الحالة'],['created_at','التاريخ']],fields:[]}
};
async function fetchRows(type){const rows=await request(`/api/${type}`);state.cache[type]=rows;return rows}
function cell(k,v){if(k.includes('_at'))return date(v);if(typeof v==='boolean')return v?'نعم':'لا';return esc(v)}
async function tableView(type){
  const d=defs[type];dashTitle.textContent=d.title;loading(dashContent);
  try{
    const rows=await fetchRows(type);
    dashContent.innerHTML=`<div class="dash-actions">${type!=='requests'?'<button class="primary" id="addRecord">إضافة سجل</button>':''}<span>${rows.length} سجل</span></div><div class="table"><table><tr>${d.cols.map(c=>`<th>${c[1]}</th>`).join('')}<th></th></tr>${rows.length?rows.map(r=>`<tr>${d.cols.map(c=>`<td>${cell(c[0],r[c[0]])}</td>`).join('')}<td><button class="danger" data-delete="${esc(r.id)}">حذف</button></td></tr>`).join(''):`<tr><td class="empty" colspan="${d.cols.length+1}">لا توجد سجلات بعد.</td></tr>`}</table></div>`;
    if(type!=='requests')$('#addRecord').onclick=()=>add(type);
    $$('[data-delete]').forEach(b=>b.onclick=()=>removeRecord(type,b.dataset.delete));
  }catch(err){showError(dashContent,err)}
}
async function add(type){
  const d=defs[type],body={};
  for(const [k,l] of d.fields){const v=prompt(l);if(v===null)return;body[k]=['amount','hours'].includes(k)?Number(v||0):k==='is_public'?v.toLowerCase()!=='false':v}
  try{await request(`/api/${type}`,{method:'POST',body:JSON.stringify(body)});if(type==='news')await loadPublic();await tableView(type)}catch(err){alert(err.message)}
}
async function removeRecord(type,id){if(!confirm('حذف السجل؟'))return;try{await request(`/api/${type}/${id}`,{method:'DELETE'});if(type==='news')await loadPublic();await tableView(type)}catch(err){alert(err.message)}}

async function projectView(){
  dashTitle.textContent='المشروعات';loading(dashContent);
  try{
    const rows=await fetchRows('projects');
    dashContent.innerHTML=`<div class="dash-actions"><button class="primary" id="addProject">إضافة مشروع</button><span>${rows.length} مشروع</span></div><div class="table"><table><tr><th>المشروع</th><th>الحالة</th><th>الإنجاز</th><th>المستفيدون</th><th>عام</th><th></th></tr>${rows.length?rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.status)}</td><td>${Number(x.progress)||0}%</td><td>${Number(x.beneficiaries_target)||0}</td><td>${x.is_public?'نعم':'لا'}</td><td><button class="danger" data-project-delete="${esc(x.id)}">حذف</button></td></tr>`).join(''):'<tr><td class="empty" colspan="6">لا توجد مشروعات بعد.</td></tr>'}</table></div>`;
    addProject.onclick=async()=>{const name=prompt('اسم المشروع');if(!name)return;const body={name,summary:prompt('الملخص')||'',status:prompt('الحالة','قيد التخطيط')||'قيد التخطيط',progress:Number(prompt('الإنجاز','0'))||0,beneficiaries_target:Number(prompt('المستفيدون المستهدفون','0'))||0,is_public:true};try{await request('/api/projects',{method:'POST',body:JSON.stringify(body)});await loadPublic();await projectView()}catch(err){alert(err.message)}};
    $$('[data-project-delete]').forEach(b=>b.onclick=()=>removeProject(b.dataset.projectDelete));
  }catch(err){showError(dashContent,err)}
}
async function removeProject(id){if(!confirm('حذف المشروع؟'))return;try{await request(`/api/projects/${id}`,{method:'DELETE'});await loadPublic();await projectView()}catch(err){alert(err.message)}}

async function view(v){
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  if(v==='home'){
    dashTitle.textContent='نظرة عامة';loading(dashContent);
    try{const x=await request('/api/dashboard');dashContent.innerHTML=`<div class="kpis"><div class="kpi">المشروعات<strong>${x.projects}</strong></div><div class="kpi">المستفيدون<strong>${x.beneficiaries}</strong></div><div class="kpi">المتطوعون<strong>${x.volunteers}</strong></div><div class="kpi">طلبات جديدة<strong>${x.new_requests}</strong></div><div class="kpi">التبرعات المسجلة<strong>${x.donations}</strong></div><div class="kpi">تبرعات SDG موثقة<strong>${x.verified_sdg}</strong></div></div>`}catch(err){showError(dashContent,err)}return;
  }
  if(v==='projects')return projectView();return tableView(v);
}
backup.onclick=async()=>{
  try{const data={};for(const k of ['projects','beneficiaries','volunteers','donations','requests','news'])data[k]=await request(`/api/${k}`);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bunyan-cloud-backup-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)}catch(err){alert(err.message)}
};

loadPublic();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});