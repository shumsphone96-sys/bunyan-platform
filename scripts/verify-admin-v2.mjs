import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'admin-v2/index.html','admin-v2/styles.css','admin-v2/app.js',
  'admin-v2/finance.js','admin-v2/finance.css',
  'admin-v2/news.js','admin-v2/news.css',
  'admin-v2/users.js','admin-v2/users.css',
  'admin-v2/audit.js','admin-v2/audit.css',
  'admin-v2/backup.js','admin-v2/backup.css',
  'admin-v2/settings.js','admin-v2/settings.css',
  'backend/src/bootstrap.js','backend/src/bootstrap-v2.js','backend/package.json'
];
for (const file of requiredFiles) {
  const content = await readFile(file, 'utf8');
  if (!content.trim()) throw new Error(`${file} is empty`);
}

const html = await readFile('admin-v2/index.html', 'utf8');
const js = await readFile('admin-v2/app.js', 'utf8');
const financeJs = await readFile('admin-v2/finance.js', 'utf8');
const newsJs = await readFile('admin-v2/news.js', 'utf8');
const usersJs = await readFile('admin-v2/users.js', 'utf8');
const auditJs = await readFile('admin-v2/audit.js', 'utf8');
const backupJs = await readFile('admin-v2/backup.js', 'utf8');
const settingsJs = await readFile('admin-v2/settings.js', 'utf8');
const bootstrap = await readFile('backend/src/bootstrap.js', 'utf8');
const bootstrapV2 = await readFile('backend/src/bootstrap-v2.js', 'utf8');
const packageJson = await readFile('backend/package.json', 'utf8');

const requiredHtmlIds = ['loginView','loginForm','loginMessage','appView','sidebar','adminNav','menuButton','refreshButton','logoutButton','content','helpBadge','participationBadge'];
for (const id of requiredHtmlIds) if (!html.includes(`id="${id}"`)) throw new Error(`Missing required element: #${id}`);

for (const [name,assets,view] of [
  ['Finance',['./finance.css','./finance.js'],'finance'],
  ['News',['./news.css','./news.js'],'news'],
  ['Users',['./users.css','./users.js'],'users'],
  ['Audit',['./audit.css','./audit.js'],'audit'],
  ['Backup',['./backup.css','./backup.js'],'backup'],
  ['Settings',['./settings.css','./settings.js'],'settings']
]) {
  for (const asset of assets) if (!html.includes(asset)) throw new Error(`${name} asset is not wired: ${asset}`);
  if (!html.includes(`data-view="${view}"`)) throw new Error(`${name} navigation entry is missing`);
}

const requiredRoutes = ['/api/auth/login','/api/auth/me','/api/dashboard','/api/dashboard/insights','/api/help/requests','/api/requests','/api/donations','/api/projects','/api/beneficiaries','/api/volunteers','/api/news'];
for (const route of requiredRoutes) if (!js.includes(route)) throw new Error(`Missing API route in admin-v2/app.js: ${route}`);

for (const route of ['/api/finance/entries','/api/projects']) if (!financeJs.includes(route)) throw new Error(`Missing API route in finance workspace: ${route}`);
for (const behavior of ['POST','PATCH','DELETE','data-finance-filter','data-finance-edit']) if (!financeJs.includes(behavior)) throw new Error(`Missing finance behavior: ${behavior}`);

if (!newsJs.includes('/api/admin/news')) throw new Error('News workspace must use protected admin news endpoint');
for (const behavior of ['POST','PATCH','DELETE','data-news-filter','data-news-edit','data-news-toggle']) if (!newsJs.includes(behavior)) throw new Error(`Missing news behavior: ${behavior}`);
for (const signature of ["app.get('/api/admin/news',auth","app.post('/api/admin/news',auth","app.patch('/api/admin/news/:id',auth","app.delete('/api/admin/news/:id',auth"]) if (!bootstrap.includes(signature)) throw new Error(`Missing protected news API contract: ${signature}`);

if (!usersJs.includes('/api/admin/users')) throw new Error('Users workspace must use protected admin users endpoint');
for (const behavior of ['POST','PATCH','data-user-filter','data-user-save','data-user-new']) if (!usersJs.includes(behavior)) throw new Error(`Missing users behavior: ${behavior}`);
for (const signature of ["app.get('/api/admin/users',auth,allow('admin')","app.post('/api/admin/users',auth,allow('admin')","app.patch('/api/admin/users/:id',auth,allow('admin')"]) if (!bootstrap.includes(signature)) throw new Error(`Missing protected users API contract: ${signature}`);
for (const guard of ['لا يمكنك تعطيل حسابك الحالي','لا يمكنك خفض صلاحية حسابك الحالي','bcrypt.hash']) if (!bootstrap.includes(guard)) throw new Error(`Missing users safety guard: ${guard}`);

if (!auditJs.includes('/api/audit-logs')) throw new Error('Audit workspace must use the protected audit endpoint');
for (const behavior of ['summarize','renderAudit','data-view="audit"']) if (!auditJs.includes(behavior) && !html.includes(behavior)) throw new Error(`Missing audit behavior: ${behavior}`);

for (const route of ['/api/admin/backup/status','/api/admin/backup/export','/api/admin/backup/import']) {
  if (!backupJs.includes(route)) throw new Error(`Backup workspace missing route: ${route}`);
  if (!bootstrapV2.includes(route)) throw new Error(`Backup backend missing route: ${route}`);
}
for (const guard of ['RESTORE_BUNYAN','adminOnly','BEGIN','ROLLBACK','COMMIT']) if (!bootstrapV2.includes(guard)) throw new Error(`Backup restore guard missing: ${guard}`);
if (!packageJson.includes('src/bootstrap-v2.js')) throw new Error('Backend start script must use bootstrap-v2.js');

if (!settingsJs.includes('/api/admin/settings')) throw new Error('Settings workspace missing route: /api/admin/settings');
for (const signature of ["app.get('/api/admin/settings',auth,adminOnly","app.patch('/api/admin/settings',auth,adminOnly","app.get('/api/dashboard/insights',auth"]) if (!bootstrapV2.includes(signature)) throw new Error(`Missing V2 API contract: ${signature}`);
if (!bootstrapV2.includes('CREATE TABLE IF NOT EXISTS system_settings')) throw new Error('System settings storage is missing');

const requiredBehaviors = ['sessionStorage.setItem','sessionStorage.removeItem','AbortController',"addEventListener('submit'", "addEventListener('click'"];
for (const behavior of requiredBehaviors) if (!js.includes(behavior)) throw new Error(`Missing behavior: ${behavior}`);

// Production smoke checks only cover routes known to be deployed already.
// New rebuild-v2 endpoints are verified statically above and should be exercised
// against a preview/staging deployment before merging to main.
const productionOrigin = process.env.BUNYAN_SMOKE_ORIGIN || 'https://api.bunyan-sudan.org';
const health = await fetch(`${productionOrigin}/health`, { signal: AbortSignal.timeout(15000) });
if (!health.ok) throw new Error(`API health failed with ${health.status}`);
const healthBody = await health.json();
if (!healthBody.ok) throw new Error('API health payload did not report ok=true');

for (const protectedRoute of ['/api/dashboard','/api/help/requests','/api/requests','/api/finance/entries','/api/audit-logs']) {
  const response = await fetch(`${productionOrigin}${protectedRoute}`, { signal: AbortSignal.timeout(15000) });
  if (response.status !== 401) throw new Error(`Protected deployed route ${protectedRoute} must return 401 without a token, got ${response.status}`);
}

console.log('Admin V2 branch contracts and deployed API smoke checks passed.');
