const $ = s => document.querySelector(s);
const API = window.BUNYAN_API_ORIGIN || 'https://api.bunyan-sudan.org';
const state = { token: sessionStorage.getItem('bunyan_token') || '', view: 'home' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = v => v ? new Date(v).toLocaleString('ar-SD') : '—';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') options.body = JSON.stringify(options.body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${API}${path}`, { ...options, headers, signal: controller.signal });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!res.ok) {
      if (res.status === 401 && state.token) {
        state.token = '';
        sessionStorage.removeItem('bunyan_token');
      }
      throw new Error(data.error || data.message || `خطأ في الخادم (${res.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.');
    if (err instanceof TypeError) throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.');
    throw err;
  } finally { clearTimeout(timer); }
}

window.openDonateModal = projectName => {
  const modal = $('#donateModal');
  const input = $('#donateForm [name="projectName"]');
  if (input && projectName) input.value = projectName;
  modal?.classList.add('open');
};

async function loadPublic() {
  try {
    const projects = await request('/api/public/projects');
    const grid = $('#projectGrid');
    if (grid && projects.length) grid.innerHTML = projects.map(p => `<article class="card"><span class="badge">${esc(p.status || 'مبادرة')}</span><h3>${esc(p.name)}</h3><p>${esc(p.summary || '')}</p><button class="primary" onclick='openDonateModal(${JSON.stringify(p.name)})'>ساهم في المشروع</button></article>`).join('');
  } catch (err) { console.warn('projects', err.message); }
  try {
    const news = await request('/api/public/news');
    const grid = $('#newsGrid');
    if (grid && news.length) grid.innerHTML = news.map(n => `<article class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body || '')}</p><small>${date(n.published_at || n.created_at)}</small></article>`).join('');
  } catch (err) { console.warn('news', err.message); }
}

function statCard(label, value) { return `<article class="card"><h3>${esc(label)}</h3><strong style="font-size:2rem">${esc(value)}</strong></article>`; }
async function loadDashboard(view = state.view) {
  state.view = view;
  const content = $('#dashContent');
  const title = $('#dashTitle');
  if (!content) return;
  content.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    if (view === 'home') {
      const d = await request('/api/dashboard');
      title.textContent = 'نظرة عامة';
      content.innerHTML = `<div class="grid projects">${statCard('المشروعات', d.projects)}${statCard('المستفيدون', d.beneficiaries)}${statCard('المتطوعون', d.volunteers)}${statCard('طلبات جديدة', d.new_requests)}${statCard('المساهمات', d.donations)}${statCard('الموثق بالجنيه', d.verified_sdg)}</div>`;
      return;
    }
    const labels = { projects:'المشروعات',beneficiaries:'المستفيدون',volunteers:'المتطوعون',donations:'التبرعات',news:'الأخبار',requests:'طلبات المشاركة' };
    const rows = await request(`/api/${view}`);
    title.textContent = labels[view] || view;
    if (!rows.length) { content.innerHTML = '<p>لا توجد سجلات حتى الآن.</p>'; return; }
    const cols = Object.keys(rows[0]).filter(k => !['password_hash','file_data'].includes(k));
    content.innerHTML = `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${cols.map(c=>`<th style="padding:9px;border-bottom:1px solid #ddd">${esc(c)}</th>`).join('')}${view==='donations'?'<th>الإيصال</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td style="padding:9px;border-bottom:1px solid #eee">${esc(typeof r[c]==='object'?JSON.stringify(r[c]):r[c])}</td>`).join('')}${view==='donations'?`<td><button class="outline" onclick="downloadReceipt('${r.id}')">عرض</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    content.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
    if (!state.token) $('#dash')?.classList.remove('open');
  }
}
window.loadDashboard = loadDashboard;

window.downloadReceipt = async donationId => {
  try {
    const meta = await request(`/api/donations/${donationId}/receipt`);
    if (!meta) return alert('لا يوجد إشعار تحويل لهذه المساهمة.');
    const res = await fetch(`${API}/api/donation-receipts/${meta.id}/download`, { headers:{ Authorization:`Bearer ${state.token}` } });
    if (!res.ok) throw new Error('تعذر تنزيل الإيصال');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=meta.file_name || 'receipt'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch (err) { alert(err.message); }
};

function installPasswordReset(loginModal) {
  const form = $('#loginForm'); if (!form || $('#forgotPasswordBtn')) return;
  const btn = document.createElement('button'); btn.type='button'; btn.id='forgotPasswordBtn'; btn.className='outline'; btn.textContent='نسيت كلمة السر؟'; form.appendChild(btn);
  const modal = document.createElement('div'); modal.className='modal'; modal.id='passwordResetModal'; modal.innerHTML=`<form id="passwordResetForm"><button type="button" id="closePasswordReset">×</button><h2>إعادة تعيين كلمة السر</h2><input name="email" type="email" placeholder="البريد المسجل" required><button type="button" class="primary" id="sendResetCode">إرسال الرمز</button><div id="resetFields" hidden><input name="code" inputmode="numeric" maxlength="6" placeholder="رمز من 6 أرقام"><input name="newPassword" type="password" minlength="10" placeholder="كلمة السر الجديدة"><input name="confirmPassword" type="password" minlength="10" placeholder="تأكيد كلمة السر"><button class="primary">حفظ كلمة السر</button></div><small id="resetMsg"></small></form>`; document.body.appendChild(modal);
  const rf=$('#passwordResetForm'), msg=$('#resetMsg'), fields=$('#resetFields');
  btn.onclick=()=>{loginModal?.classList.remove('open');modal.classList.add('open');};
  $('#closePasswordReset').onclick=()=>{modal.classList.remove('open');loginModal?.classList.add('open');};
  $('#sendResetCode').onclick=async()=>{try{msg.textContent='جاري الإرسال...';const email=rf.elements.email.value.trim();const r=await request('/api/auth/forgot-password',{method:'POST',body:{email}});fields.hidden=false;msg.textContent=r.message;}catch(e){msg.textContent=e.message;}};
  rf.onsubmit=async e=>{e.preventDefault();const email=rf.elements.email.value.trim(),code=rf.elements.code.value.trim(),newPassword=rf.elements.newPassword.value;if(newPassword!==rf.elements.confirmPassword.value)return msg.textContent='كلمتا السر غير متطابقتين.';try{msg.textContent='جاري الحفظ...';const r=await request('/api/auth/reset-password',{method:'POST',body:{email,code,newPassword}});msg.textContent=r.message;setTimeout(()=>{modal.classList.remove('open');loginModal?.classList.add('open');},1200);}catch(x){msg.textContent=x.message;}};
}

document.addEventListener('DOMContentLoaded', () => {
  loadPublic();
  const menu=$('#menu'),nav=$('#nav'); if(menu&&nav)menu.onclick=()=>nav.classList.toggle('open');
  const login=$('#login'); $('#adminBtn').onclick=()=>login.classList.add('open'); $('#close').onclick=()=>login.classList.remove('open'); installPasswordReset(login);
  $('#setupAdmin').onclick=async()=>{const f=$('#loginForm'),msg=$('#loginMsg');try{msg.textContent='جاري إنشاء المدير...';const body={name:f.elements.name.value.trim(),email:f.elements.email.value.trim(),password:f.elements.password.value};const r=await request('/api/setup',{method:'POST',body});state.token=r.token;sessionStorage.setItem('bunyan_token',r.token);login.classList.remove('open');$('#dash').classList.add('open');loadDashboard();}catch(e){msg.textContent=e.message;}};
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('#loginMsg');try{msg.textContent='جاري التحقق...';const r=await request('/api/auth/login',{method:'POST',body:{email:f.elements.email.value.trim(),password:f.elements.password.value}});state.token=r.token;sessionStorage.setItem('bunyan_token',r.token);login.classList.remove('open');$('#dash').classList.add('open');loadDashboard();}catch(x){msg.textContent=x.message;}};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>loadDashboard(b.dataset.view));
  $('#logout').onclick=()=>{state.token='';sessionStorage.removeItem('bunyan_token');$('#dash').classList.remove('open');};
  $('#site').onclick=()=>$('#dash').classList.remove('open');
  $('#backup').onclick=async()=>{try{const data={};for(const r of ['projects','beneficiaries','volunteers','donations','news','requests'])data[r]=await request(`/api/${r}`);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`bunyan-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();}catch(e){alert(e.message);}};
  $('#donateBtn').onclick=()=>openDonateModal(); $('#closeDonate').onclick=()=>$('#donateModal').classList.remove('open');
  $('#donateForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('#donateMsg'),btn=f.querySelector('button.primary');try{btn.disabled=true;msg.textContent='جاري حفظ المساهمة...';const fd=new FormData(f);const file=fd.get('receipt');if(file&&file.size>3*1024*1024)throw new Error('حجم الإشعار أكبر من 3 ميغابايت.');const r=await request('/api/public/donations',{method:'POST',body:fd,headers:{'X-Request-ID':crypto.randomUUID()}});msg.textContent=`تم حفظ المساهمة بنجاح. رقم العملية: ${r.id}`;f.reset();setTimeout(()=>$('#donateModal').classList.remove('open'),1500);}catch(x){msg.textContent=x.message;}finally{btn.disabled=false;}};
  $('#joinForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('#joinMsg');try{msg.textContent='جاري الإرسال...';await request('/api/public/participation-requests',{method:'POST',body:Object.fromEntries(new FormData(f).entries())});msg.textContent='تم إرسال طلبك بنجاح.';f.reset();}catch(x){msg.textContent=x.message;}};
  $('#contactForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,msg=$('#contactMsg');try{msg.textContent='جاري الإرسال...';await request('/api/public/contact',{method:'POST',body:Object.fromEntries(new FormData(f).entries())});msg.textContent='تم إرسال رسالتك بنجاح.';f.reset();}catch(x){msg.textContent=x.message;}};
  if(state.token){$('#dash').classList.add('open');loadDashboard();}
});
