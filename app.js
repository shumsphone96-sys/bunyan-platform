const $ = s => document.querySelector(s);
const API = window.BUNYAN_API_ORIGIN || 'https://api.bunyan-sudan.org';
const state = { token: sessionStorage.getItem('bunyan_token') || '' };

// ربط دالة فتح نافذة التبرع لتعمل من أي مكان في الصفحة
window.openDonateModal = function(projectName) {
  const modal = document.getElementById('donateModal');
  const projectInput = document.querySelector('#donateForm [name="projectName"]');
  if (projectInput && projectName) {
    projectInput.value = projectName;
  }
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => v ? new Date(v).toLocaleDateString('ar-SD') : '—';
const statusLabels = { new: 'جديد', review: 'قيد النظر', approved: 'مقبول', rejected: 'مرفوض', done: 'مكتمل' };
const statusText = v => statusLabels[v] || v || 'جديد';
const wa = v => { let p = String(v || '').replace(/\D/g, ''); return p ? `https://wa.me/${p}` : ''; };

// دالة الاتصال الشاملة والمطورة مع السيرفر
async function request(path, options = {}) {
  const headers = {};

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const finalOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  };

  try {
    const res = await fetch(`${API}${path}`, finalOptions);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { message: text }; }

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `خطأ في السيرفر (${res.status})`);
    }
    return data;
  } catch (err) {
    console.error(`[API Error] ${path}:`, err);
    throw err;
  }
}

function loading(el, msg = 'جاري التحميل...') {
  if (el) el.innerHTML = `<div class="loading">${msg}</div>`;
}

function showError(el, err) {
  if (el) el.innerHTML = `<div class="error-msg">${esc(err.message || err)}</div>`;
}

async function loadPublic() {
  renderProjects();
  renderNews();
}

async function renderProjects() {
  const grid = $('#projectGrid');
  if (!grid) return;
  try {
    const projects = await request('/api/projects');
    if (projects && projects.length > 0) {
      grid.innerHTML = projects.map(p => `
        <article class="card">
          <span class="badge">${esc(p.category || 'مبادرة')}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <button class="primary donate-trigger" onclick="openDonateModal('${esc(p.title)}')">ساهم في المشروع</button>
        </article>
      `).join('');
    }
  } catch (e) {
    console.log('استخدام البيانات الافتراضية للمشاريع');
  }
}

async function renderNews() {
  const grid = $('#newsGrid');
  if (!grid) return;
  try {
    const news = await request('/api/news');
    if (news && news.length > 0) {
      grid.innerHTML = news.map(n => `
        <article class="card">
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.content)}</p>
          <small>${date(n.created_at)}</small>
        </article>
      `).join('');
    }
  } catch (e) {
    console.log('استخدام البيانات الافتراضية للأخبار');
  }
}

function installPasswordResetUI(loginModal) {
  const loginForm = $('#loginForm');
  if (!loginForm || document.getElementById('forgotPasswordBtn')) return;

  const forgotBtn = document.createElement('button');
  forgotBtn.type = 'button';
  forgotBtn.id = 'forgotPasswordBtn';
  forgotBtn.className = 'outline';
  forgotBtn.textContent = 'نسيت كلمة السر؟';
  forgotBtn.style.width = '100%';
  forgotBtn.style.marginTop = '10px';
  loginForm.appendChild(forgotBtn);

  const resetModal = document.createElement('div');
  resetModal.className = 'modal';
  resetModal.id = 'passwordResetModal';
  resetModal.innerHTML = `
    <form id="passwordResetForm" autocomplete="off">
      <button type="button" id="closePasswordReset">×</button>
      <h2>إعادة تعيين كلمة السر</h2>
      <p id="passwordResetHelp">اكتب البريد المسجل ليصلك رمز من 6 أرقام.</p>
      <input name="email" type="email" placeholder="البريد الإلكتروني المسجل" required>
      <button class="primary" type="button" id="sendResetCode">إرسال رمز التحقق</button>
      <div id="resetCodeFields" style="display:none">
        <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="رمز التحقق المكوّن من 6 أرقام">
        <input name="newPassword" type="password" minlength="10" maxlength="128" placeholder="كلمة السر الجديدة (10 أحرف على الأقل)">
        <input name="confirmPassword" type="password" minlength="10" maxlength="128" placeholder="تأكيد كلمة السر الجديدة">
        <button class="primary" type="submit">حفظ كلمة السر الجديدة</button>
      </div>
      <small id="passwordResetMsg" aria-live="polite"></small>
    </form>`;
  document.body.appendChild(resetModal);

  const form = $('#passwordResetForm');
  const msg = $('#passwordResetMsg');
  const fields = $('#resetCodeFields');
  const sendCode = $('#sendResetCode');
  const closeReset = $('#closePasswordReset');

  forgotBtn.onclick = () => {
    if (loginModal) loginModal.classList.remove('open');
    resetModal.classList.add('open');
  };

  closeReset.onclick = () => {
    resetModal.classList.remove('open');
    if (loginModal) loginModal.classList.add('open');
  };

  sendCode.onclick = async () => {
    const email = form.elements.email.value.trim();
    if (!email) {
      msg.textContent = 'اكتب البريد الإلكتروني المسجل أولاً.';
      return;
    }
    try {
      sendCode.disabled = true;
      msg.textContent = 'جاري إرسال الرمز...';
      const result = await request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email }
      });
      fields.style.display = 'block';
      form.elements.code.required = true;
      form.elements.newPassword.required = true;
      form.elements.confirmPassword.required = true;
      msg.textContent = result.message || 'إذا كان البريد مسجلاً فسيصل رمز التحقق خلال دقائق.';
    } catch (err) {
      msg.textContent = err.message || 'تعذر إرسال رمز التحقق.';
    } finally {
      sendCode.disabled = false;
    }
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    const code = form.elements.code.value.trim();
    const newPassword = form.elements.newPassword.value;
    const confirmPassword = form.elements.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      msg.textContent = 'كلمتا السر غير متطابقتين.';
      return;
    }

    try {
      msg.textContent = 'جاري تعيين كلمة السر الجديدة...';
      const result = await request('/api/auth/reset-password', {
        method: 'POST',
        body: { email, code, newPassword }
      });
      msg.textContent = result.message || 'تم تعيين كلمة السر الجديدة بنجاح.';
      setTimeout(() => {
        resetModal.classList.remove('open');
        form.reset();
        fields.style.display = 'none';
        if (loginModal) loginModal.classList.add('open');
        const loginEmail = loginForm.elements.email;
        if (loginEmail) loginEmail.value = email;
        const loginMsg = $('#loginMsg');
        if (loginMsg) loginMsg.textContent = 'تم تغيير كلمة السر. سجّل الدخول بالكلمة الجديدة.';
      }, 1600);
    } catch (err) {
      msg.textContent = err.message || 'تعذر إعادة تعيين كلمة السر.';
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  loadPublic();

  const menu = $('#menu');
  const nav = $('#nav');
  if (menu && nav) {
    menu.onclick = () => nav.classList.toggle('open');
  }

  const adminBtn = $('#adminBtn');
  const loginModal = $('#login');
  const closeLogin = $('#close');
  if (adminBtn && loginModal) adminBtn.onclick = () => loginModal.classList.add('open');
  if (closeLogin && loginModal) closeLogin.onclick = () => loginModal.classList.remove('open');
  installPasswordResetUI(loginModal);

  const logoutBtn = $('#logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      state.token = '';
      sessionStorage.removeItem('bunyan_token');
      location.reload();
    };
  }

  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#loginMsg');
      const formData = new FormData(loginForm);
      const body = Object.fromEntries(formData.entries());

      try {
        if (msg) msg.textContent = 'جاري التحقق...';
        const res = await request('/api/auth/login', { method: 'POST', body });
        state.token = res.token;
        sessionStorage.setItem('bunyan_token', res.token);
        if (loginModal) loginModal.classList.remove('open');
        const dash = $('#dash');
        if (dash) dash.classList.add('open');
        if (typeof window.loadDashboard === 'function') window.loadDashboard();
      } catch (err) {
        if (msg) msg.textContent = err.message || 'فشل تسجيل الدخول';
      }
    };
  }

  const contactForm = $('#contactForm');
  if (contactForm) {
    contactForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#contactMsg');
      const formData = new FormData(contactForm);

      try {
        if (msg) msg.textContent = 'جاري الإرسال...';
        await request('/api/contact', {
          method: 'POST',
          body: formData
        });
        if (msg) msg.textContent = 'تم إرسال رسالتك بنجاح! شكراً لتواصلك.';
        contactForm.reset();
      } catch (err) {
        if (msg) msg.textContent = 'تعذر إرسال الرسالة، يرجى المحاولة لاحقاً.';
      }
    };
  }

  const joinForm = $('#joinForm');
  if (joinForm) {
    joinForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#joinMsg');
      const formData = new FormData(joinForm);

      try {
        if (msg) msg.textContent = 'جاري الإرسال...';
        await request('/api/join', {
          method: 'POST',
          body: formData
        });
        if (msg) msg.textContent = 'تم إرسال طلبك بنجاح!';
        joinForm.reset();
      } catch (err) {
        if (msg) msg.textContent = 'حدث خطأ أثناء إرسال الطلب.';
      }
    };
  }

  const donateForm = $('#donateForm');
  const donateModal = $('#donateModal');
  const donateBtn = $('#donateBtn');
  const closeDonate = $('#closeDonate');

  if (donateBtn && donateModal) donateBtn.onclick = () => window.openDonateModal();
  if (closeDonate && donateModal) closeDonate.onclick = () => {
    donateModal.classList.remove('open');
    donateModal.style.display = 'none';
  };

  if (donateForm) {
    donateForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#donateMsg');
      const formData = new FormData(donateForm);

      try {
        if (msg) msg.textContent = 'جاري تسجيل المساهمة وإرفاق الإشعار...';
        await request('/api/donations', {
          method: 'POST',
          body: formData
        });
        if (msg) msg.textContent = 'تم حفظ المساهمة بنجاح، شكراً لدعمك!';
        setTimeout(() => {
          if (donateModal) {
            donateModal.classList.remove('open');
            donateModal.style.display = 'none';
          }
          donateForm.reset();
          if (msg) msg.textContent = '';
        }, 2000);
      } catch (err) {
        if (msg) msg.textContent = err.message || 'حدث خطأ في حفظ المساهمة.';
      }
    };
  }
});