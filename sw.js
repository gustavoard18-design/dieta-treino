// Service worker: guarda o app para abrir sem internet e permite notificações no Android
const CACHE='dieta-v2';
const ARQS=['./','index.html','alimentos.js','icon.svg','manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// Rede primeiro (pega versões novas); sem rede, usa o cache. Chamadas ao Supabase não passam pelo cache.
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow('./')))});
