import { readFile } from 'node:fs/promises';

const requiredFiles = ['admin-v2/index.html', 'admin-v2/styles.css', 'admin-v2/app.js'];
for (const file of requiredFiles) {
  const content = await readFile(file, 'utf8');
  if (!content.trim()) throw new Error(`${file} is empty`);
}

const html = await readFile('admin-v2/index.html', 'utf8');
const js = await readFile('admin-v2/app.js', 'utf8');

const requiredHtmlIds = [
  'loginView', 'loginForm', 'loginMessage', 'appView', 'sidebar', 'adminNav',
  'menuButton', 'refreshButton', 'logoutButton', 'content', 'helpBadge', 'participationBadge'
];
for (const id of requiredHtmlIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required element: #${id}`);
}

const requiredRoutes = [
  '/api/auth/login', '/api/auth/me', '/api/dashboard', '/api/help/requests',
  '/api/requests', '/api/donations', '/api/projects', '/api/beneficiaries',
  '/api/volunteers', '/api/news'
];
for (const route of requiredRoutes) {
  if (!js.includes(route)) throw new Error(`Missing API route in admin-v2/app.js: ${route}`);
}

const requiredBehaviors = [
  'sessionStorage.setItem', 'sessionStorage.removeItem', 'AbortController',
  "addEventListener('submit'", "addEventListener('click'"
];
for (const behavior of requiredBehaviors) {
  if (!js.includes(behavior)) throw new Error(`Missing behavior: ${behavior}`);
}

const health = await fetch('https://api.bunyan-sudan.org/health', { signal: AbortSignal.timeout(15000) });
if (!health.ok) throw new Error(`API health failed with ${health.status}`);
const healthBody = await health.json();
if (!healthBody.ok) throw new Error('API health payload did not report ok=true');

for (const protectedRoute of ['/api/dashboard', '/api/help/requests', '/api/requests']) {
  const response = await fetch(`https://api.bunyan-sudan.org${protectedRoute}`, { signal: AbortSignal.timeout(15000) });
  if (response.status !== 401) {
    throw new Error(`Protected route ${protectedRoute} must return 401 without a token, got ${response.status}`);
  }
}

console.log('Admin V2 verification passed.');
