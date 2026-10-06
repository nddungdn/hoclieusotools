const CACHE='lhp-tkb-shell-v1.3.1';
const FILES=['./','./index.html','./styles.css?v=1.3.1','./app.js?v=1.3.1','./auth.js','./countdown.js','./request.js','./notes.js','./core.js','./config.js?v=1.2.3','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lhp-tkb-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('Authorization')||url.pathname.includes('/api/'))return;
  const allowed=new Set(FILES.map(f=>new URL(f,self.registration.scope).pathname));if(!allowed.has(url.pathname))return;
  // Chỉ lưu giao diện. Dữ liệu học sinh/giáo viên và phiên đăng nhập không được đưa vào Cache Storage.
  event.respondWith(fetch(request).then(response=>{if(response.ok&&response.type!=='opaque'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));}return response;}).catch(async()=>await caches.match(url.pathname)||await caches.match(request)));
});
