(function(){
  const api=async(path,options={})=>{
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    if(state?.token)headers.Authorization=`Bearer ${state.token}`;
    const res=await fetch(`${API}${path}`,{...options,headers});
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
    if(!res.ok)throw new Error(data?.error||`فشل الاتصال (${res.status})`);return data;
  };
  const strength=password=>{
    let score=0;if(password.length>=10)score++;if(/[A-Z]/.test(password))score++;if(/[a-z]/.test(password))score++;if(/\d/.test(password))score++;if(/[^A-Za-z0-9]/.test(password))score++;
    return {score,label:['ضعيفة جداً','ضعيفة','متوسطة','جيدة','قوية','قوية جداً'][score]};
  };
  function addToggle(input){
    if(!input||input.parentElement?.classList.contains('password-wrap'))return;
    const wrap=document.createElement('div');wrap.className='password-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const b=document.createElement('button');b.type='button';b.className='password-toggle';b.textContent='إظهار';b.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'إخفاء':'إظهار'};wrap.appendChild(b);
  }
  function buildRecovery(){
    if($('#forgotPassword'))return;
    const password=loginForm.querySelector('input[name="password"]');addToggle(password);
    const remembered=localStorage.getItem('bunyan_admin_email');const emailInput=loginForm.querySelector('input[name="email"]');if(remembered&&!emailInput.value)emailInput.value=remembered;
    const remember=document.createElement('label');remember.className='remember-row';remember.innerHTML='<input type="checkbox" id="rememberEmail" checked> تذكّر البريد على هذا الجهاز';password.parentElement.after(remember);
    const forgot=document.createElement('button');forgot.type='button';forgot.id='forgotPassword';forgot.className='text-button';forgot.textContent='نسيت كلمة السر؟';remember.after(forgot);
    loginForm.addEventListener('submit',()=>{if($('#rememberEmail')?.checked)localStorage.setItem('bunyan_admin_email',emailInput.value.trim());else localStorage.removeItem('bunyan_admin_email')});
    document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="recoveryModal"><form id="recoveryForm" class="security-form"><button type="button" class="modal-x" id="closeRecovery">×</button><h2>استعادة حساب الإدارة</h2><div id="recoveryStep1"><p>اكتب بريد الإدارة وسنرسل رمزاً من 6 أرقام صالحاً لمدة 15 دقيقة.</p><input name="email" type="email" placeholder="البريد الإلكتروني" required><button class="primary" type="submit">إرسال رمز التحقق</button></div><div id="recoveryStep2" hidden><p>أدخل الرمز المرسل إلى بريدك، ثم اختر كلمة سر جديدة.</p><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="رمز التحقق المكوّن من 6 أرقام"><div class="password-wrap"><input name="newPassword" type="password" minlength="10" placeholder="كلمة السر الجديدة"><button type="button" class="password-toggle" data-toggle="newPassword">إظهار</button></div><div class="strength"><i id="resetStrength"></i><span id="resetStrengthText">استخدم 10 أحرف على الأقل مع رقم ورمز.</span></div><div class="password-wrap"><input name="confirmPassword" type="password" minlength="10" placeholder="تأكيد كلمة السر الجديدة"><button type="button" class="password-toggle" data-toggle="confirmPassword">إظهار</button></div><button class="primary" type="button" id="confirmReset">تعيين كلمة السر الجديدة</button><button class="text-button" type="button" id="resendCode">إرسال رمز جديد</button></div><p id="recoveryMsg"></p></form></div>`);
    forgot.onclick=()=>{const m=$('#recoveryModal');m.classList.add('show');m.querySelector('input[name="email"]').value=emailInput.value||remembered||''};
    $('#closeRecovery').onclick=()=>$('#recoveryModal').classList.remove('show');
    $$('[data-toggle]').forEach(b=>b.onclick=()=>{const i=$(`#recoveryForm input[name="${b.dataset.toggle}"]`);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'إخفاء':'إظهار'});
    const np=$('#recoveryForm input[name="newPassword"]');np.oninput=()=>{const s=strength(np.value);$('#resetStrength').style.width=`${s.score*20}%`;$('#resetStrengthText').textContent=s.label};
    recoveryForm.onsubmit=async e=>{e.preventDefault();const email=new FormData(e.target).get('email');recoveryMsg.textContent='جارٍ إرسال الرمز...';try{const d=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});$('#recoveryStep1').hidden=true;$('#recoveryStep2').hidden=false;recoveryMsg.textContent=d.message}catch(err){recoveryMsg.textContent=err.message}};
    $('#resendCode').onclick=()=>{ $('#recoveryStep1').hidden=false;$('#recoveryStep2').hidden=true;recoveryMsg.textContent=''; };
    $('#confirmReset').onclick=async()=>{const f=new FormData(recoveryForm),email=f.get('email'),code=String(f.get('code')||''),newPassword=String(f.get('newPassword')||''),confirm=String(f.get('confirmPassword')||'');if(newPassword!==confirm){recoveryMsg.textContent='كلمتا السر غير متطابقتين';return}recoveryMsg.textContent='جارٍ تعيين كلمة السر...';try{const d=await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({email,code,newPassword})});recoveryMsg.textContent=d.message;setTimeout(()=>{$('#recoveryModal').classList.remove('show');emailInput.value=email;password.value=''},1400)}catch(err){recoveryMsg.textContent=err.message}};
  }
  function buildAccountSecurity(){
    if($('#accountSecurity'))return;
    const btn=document.createElement('button');btn.id='accountSecurity';btn.textContent='أمان الحساب';const logoutBtn=$('#logout');logoutBtn.parentNode.insertBefore(btn,logoutBtn);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="securityModal"><form id="securityForm" class="security-form"><button type="button" class="modal-x" id="closeSecurity">×</button><h2>أمان حساب الإدارة</h2><div id="accountInfo" class="account-info">جارٍ تحميل بيانات الحساب...</div><h3>تغيير كلمة السر</h3><div class="password-wrap"><input name="currentPassword" type="password" placeholder="كلمة السر الحالية" required><button type="button" class="password-toggle" data-sec="currentPassword">إظهار</button></div><div class="password-wrap"><input name="newPassword" type="password" minlength="10" placeholder="كلمة السر الجديدة" required><button type="button" class="password-toggle" data-sec="newPassword">إظهار</button></div><div class="strength"><i id="changeStrength"></i><span id="changeStrengthText">استخدم 10 أحرف على الأقل مع رقم ورمز.</span></div><div class="password-wrap"><input name="confirmPassword" type="password" minlength="10" placeholder="تأكيد كلمة السر الجديدة" required><button type="button" class="password-toggle" data-sec="confirmPassword">إظهار</button></div><button class="primary">حفظ كلمة السر الجديدة</button><p id="securityMsg"></p></form></div>`);
    btn.onclick=async()=>{$('#securityModal').classList.add('show');try{const me=await api('/api/auth/me');$('#accountInfo').innerHTML=`<strong>${esc(me.name)}</strong><span>${esc(me.email)}</span><small>الصلاحية: ${esc(me.role)} • آخر تحديث: ${date(me.updated_at)}</small>`}catch(err){$('#accountInfo').textContent=err.message}};
    $('#closeSecurity').onclick=()=>$('#securityModal').classList.remove('show');
    $$('[data-sec]').forEach(b=>b.onclick=()=>{const i=$(`#securityForm input[name="${b.dataset.sec}"]`);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'إخفاء':'إظهار'});
    const np=$('#securityForm input[name="newPassword"]');np.oninput=()=>{const s=strength(np.value);$('#changeStrength').style.width=`${s.score*20}%`;$('#changeStrengthText').textContent=s.label};
    securityForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),currentPassword=String(f.get('currentPassword')||''),newPassword=String(f.get('newPassword')||''),confirm=String(f.get('confirmPassword')||'');if(newPassword!==confirm){securityMsg.textContent='كلمتا السر غير متطابقتين';return}securityMsg.textContent='جارٍ الحفظ...';try{const d=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});securityMsg.textContent=d.message;setTimeout(()=>{state.token='';sessionStorage.removeItem('bunyan_token');$('#securityModal').classList.remove('show');dash.classList.remove('show');login.classList.add('show');securityForm.reset()},1300)}catch(err){securityMsg.textContent=err.message}};
  }
  buildRecovery();buildAccountSecurity();
})();
