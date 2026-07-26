const C='bunyan-v11-global-governance';
const ASSETS=['./','./index.html','./styles.css','./workflow.css','./auth-center.css','./global-upgrade.css','./global-admin.css','./app.js','./workflow.js','./auth-center.js','./donation-receipt.js','./global-upgrade.js','./global-admin.js','./manifest.json'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(C).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.url.startsWith('https://bunyan-api-qhkf.onrender.com'))return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(C).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
});
