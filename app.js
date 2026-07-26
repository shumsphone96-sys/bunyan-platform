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

  // إضافة Authorization Token إن وجد
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  // إذا لم تكن البيانات مبعوثة كـ FormData، نضع JSON Content-Type تلقائياً
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

// تحميل المشاريع والأخبار للواجهة العامة
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

// الأحداث والتفاعل
document.addEventListener('DOMContentLoaded', () => {
  loadPublic();

  // القائمة والتنقل
  const menu = $('#menu');
  const nav = $('#nav');
  if (menu && nav) {
    menu.onclick = () => nav.classList.toggle('open');
  }

  // لوحة الإدارة والدخول
  const adminBtn = $('#adminBtn');
  const loginModal = $('#login');
  const closeLogin = $('#close');
  if (adminBtn && loginModal) adminBtn.onclick = () => loginModal.classList.add('open');
  if (closeLogin && loginModal) closeLogin.onclick = () => loginModal.classList.remove('open');

  const logoutBtn = $('#logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      state.token = '';
      sessionStorage.removeItem('bunyan_token');
      location.reload();
    };
  }

  // نموذج الدخول
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#loginMsg');
      const formData = new FormData(loginForm);
      const body = Object.fromEntries(formData.entries());

      try {
        if (msg) msg.textContent = 'جاري التحقق...';
        const res = await request('/api/admin/login', { method: 'POST', body });
        state.token = res.token;
        sessionStorage.setItem('bunyan_token', res.token);
        if (loginModal) loginModal.classList.remove('open');
        $('#dash').classList.add('open');
      } catch (err) {
        if (msg) msg.textContent = err.message || 'فشل تسجيل الدخول';
      }
    };
  }

  // نموذج التواصل (Contact Form)
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

  // نموذج طلبات المشاركة والتطوع
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

  // نموذج التبرع والمساهمة (Donate Form)
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