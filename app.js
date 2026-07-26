const $ = s => document.querySelector(s);
const API = window.BUNYAN_API_ORIGIN || 'https://api.bunyan-sudan.org';
const state = { token: sessionStorage.getItem('bunyan_token') || '' };

window.openDonateModal = function(projectName) {
  const modal = document.getElementById('donateModal');
  const projectInput = document.querySelector('#donateForm [name="projectName"]');
  if (projectInput && projectName) projectInput.value = projectName;
  if (modal) modal.classList.add('open');
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => v ? new Date(v).toLocaleDateString('ar-SD') : '—';

async function request(path, options = {}) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `خطأ في السيرفر (${res.status})`);
  return data;
}

async function renderProjects() {
  const grid = $('#projectGrid');
  if (!grid) return;
  try {
    const projects = await request('/api/public/projects');
    if (projects?.length) {
      grid.innerHTML = projects.map(p => `
        <article class="card">
          <span class="badge">${esc(p.category || 'مبادرة')}</span>
          <h3>${esc(p.name || p.title)}</h3>
          <p>${esc(p.summary || p.description)}</p>
          <button class="primary donate-trigger" onclick="openDonateModal('${esc(p.name || p.title)}')">ساهم في المشروع</button>
        </article>`).join('');
    }
  } catch { console.log('استخدام البيانات الافتراضية للمشاريع'); }
}

async function renderNews() {
  const grid = $('#newsGrid');
  if (!grid) return;
  try {
    const news = await request('/api/public/news');
    if (news?.length) {
      grid.innerHTML = news.map(n => `
        <article class="card">
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.body || n.content)}</p>
          <small>${date(n.published_at || n.created_at)}</small>
        </article>`).join('');
    }
  } catch { console.log('استخدام البيانات الافتراضية للأخبار'); }
}

async function openDashboard() {
  const summary = await request('/api/dashboard');
  const loginModal = $('#login');
  const dash = $('#dash');
  const dashContent = $('#dashContent');
  if (loginModal) loginModal.classList.remove('open');
  if (dash) dash.classList.add('open');
  if (dashContent) {
    dashContent.innerHTML = `
      <div class="grid programs">
        <article><strong>${summary.projects ?? 0}</strong><span>المشروعات</span></article>
        <article><strong>${summary.beneficiaries ?? 0}</strong><span>المستفيدون</span></article>
        <article><strong>${summary.volunteers ?? 0}</strong><span>المتطوعون</span></article>
        <article><strong>${summary.donations ?? 0}</strong><span>التبرعات</span></article>
        <article><strong>${summary.new_requests ?? 0}</strong><span>طلبات جديدة</span></article>
        <article><strong>${summary.verified_sdg ?? 0}</strong><span>إجمالي موثّق SDG</span></article>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderProjects();
  renderNews();

  const menu = $('#menu');
  const nav = $('#nav');
  if (menu && nav) menu.onclick = () => nav.classList.toggle('open');

  const adminBtn = $('#adminBtn');
  const loginModal = $('#login');
  const closeLogin = $('#close');
  if (adminBtn && loginModal) adminBtn.onclick = () => loginModal.classList.add('open');
  if (closeLogin && loginModal) closeLogin.onclick = () => loginModal.classList.remove('open');

  const logoutBtn = $('#logout');
  if (logoutBtn) logoutBtn.onclick = () => {
    state.token = '';
    sessionStorage.removeItem('bunyan_token');
    location.reload();
  };

  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.onsubmit = async e => {
      e.preventDefault();
      const msg = $('#loginMsg');
      const form = new FormData(loginForm);
      const body = {
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || '')
      };
      try {
        if (msg) msg.textContent = 'جاري التحقق...';
        const res = await request('/api/auth/login', { method: 'POST', body });
        state.token = res.token;
        sessionStorage.setItem('bunyan_token', res.token);
        if (msg) msg.textContent = '';
        await openDashboard();
      } catch (err) {
        if (msg) msg.textContent = err.message || 'فشل تسجيل الدخول';
      }
    };
  }

  if (state.token) openDashboard().catch(() => {
    state.token = '';
    sessionStorage.removeItem('bunyan_token');
  });

  const contactForm = $('#contactForm');
  if (contactForm) contactForm.onsubmit = async e => {
    e.preventDefault();
    const msg = $('#contactMsg');
    const body = Object.fromEntries(new FormData(contactForm).entries());
    try {
      if (msg) msg.textContent = 'جاري الإرسال...';
      await request('/api/public/contact', { method: 'POST', body });
      if (msg) msg.textContent = 'تم إرسال رسالتك بنجاح!';
      contactForm.reset();
    } catch (err) {
      if (msg) msg.textContent = err.message || 'تعذر إرسال الرسالة.';
    }
  };

  const joinForm = $('#joinForm');
  if (joinForm) joinForm.onsubmit = async e => {
    e.preventDefault();
    const msg = $('#joinMsg');
    const body = Object.fromEntries(new FormData(joinForm).entries());
    try {
      if (msg) msg.textContent = 'جاري الإرسال...';
      await request('/api/public/participation-requests', { method: 'POST', body });
      if (msg) msg.textContent = 'تم إرسال طلبك بنجاح!';
      joinForm.reset();
    } catch (err) {
      if (msg) msg.textContent = err.message || 'حدث خطأ أثناء إرسال الطلب.';
    }
  };

  const donateForm = $('#donateForm');
  const donateModal = $('#donateModal');
  const donateBtn = $('#donateBtn');
  const closeDonate = $('#closeDonate');
  if (donateBtn && donateModal) donateBtn.onclick = () => window.openDonateModal();
  if (closeDonate && donateModal) closeDonate.onclick = () => donateModal.classList.remove('open');

  if (donateForm) donateForm.onsubmit = async e => {
    e.preventDefault();
    const msg = $('#donateMsg');
    const formData = new FormData(donateForm);
    try {
      if (msg) msg.textContent = 'جاري تسجيل المساهمة وإرفاق الإشعار...';
      await request('/api/donations', { method: 'POST', body: formData });
      if (msg) msg.textContent = 'تم حفظ المساهمة بنجاح، شكراً لدعمك!';
      setTimeout(() => {
        if (donateModal) donateModal.classList.remove('open');
        donateForm.reset();
        if (msg) msg.textContent = '';
      }, 2000);
    } catch (err) {
      if (msg) msg.textContent = err.message || 'حدث خطأ في حفظ المساهمة.';
    }
  };
});