const C='bunyan-v20-unified';
const ASSETS=['./','./index.html','./styles.css','./workflow.css','./auth-center.css','./global-upgrade.css','./global-admin.css','./contact.css','./api-domain.js','./app.js?v=20','./manifest.json'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(C).then(cache=>cache.addAll(ASSETS).catch(()=>undefined)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin==='https://api.bunyan-sudan.org')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(C).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
