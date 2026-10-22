from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parents[1];w=r/'web_app'
paths=sorted(str(p.relative_to(w)) for p in w.rglob('*') if p.is_file() and p.name not in ['asset-manifest.json','sw.js','.DS_Store'])
(w/'asset-manifest.json').write_text(json.dumps(paths,ensure_ascii=False))
fingerprint=hashlib.sha256(''.join(hashlib.sha256((w/p).read_bytes()).hexdigest() for p in paths).encode()).hexdigest()[:12]
files=json.dumps(['./'+p for p in paths],ensure_ascii=False)
sw="""const CACHE='nightlens-%s';
const FILES=%s;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await cache.addAll(FILES);await cache.put('./offline-ready.flag',new Response('ready'));await self.skipWaiting();}
 catch(e){await caches.delete(CACHE);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('nightlens-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();for(const client of await self.clients.matchAll())client.postMessage({type:'offline-ready'});
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const retry=url.searchParams.has('__nl_img_retry')&&/\\/assets\\/.+\\.(png|jpe?g|webp)$/i.test(url.pathname);const cached=await cache.match(event.request,{ignoreSearch:retry});if(cached)return cached;
 try{return await fetch(event.request);}catch(e){if(event.request.mode==='navigate')return await cache.match('./index.html');throw e;}})());
});
"""%(fingerprint,files)
(w/'sw.js').write_text(sw)
print('Packaged',len(paths),'assets; fingerprint',fingerprint,'total MB',round(sum((w/p).stat().st_size for p in paths)/1e6,1))

# Keep the overnight preview daemon in sync, outside macOS protected Documents.
import shutil
preview=Path.home()/".local/share/nightlens/preview/web_app"
if preview.exists():shutil.copytree(w,preview,dirs_exist_ok=True)
