/* CACHE, FILES, ASSET_META and RELEASE are generated with each release. */
let offlineJob=null,offlineSnapshot=null,lastOfflineNotice=0;
const absoluteOfflineURL=path=>new URL(path,self.registration.scope).href;
const assetMeta=typeof ASSET_META==='undefined'?{}:ASSET_META;
const releaseId=typeof RELEASE==='undefined'?CACHE:RELEASE;
function offlineState(state,completed=0,extra={}){
 return {type:'offline-progress',release:releaseId,state,completed,total:FILES.length,percent:state==='ready'?100:Math.min(99,Math.floor(completed/Math.max(1,FILES.length)*100)),...extra};
}
async function publishOffline(snapshot,force=false){
 offlineSnapshot=snapshot;
 const now=Date.now();if(!force&&now-lastOfflineNotice<200)return;lastOfflineNotice=now;
 for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage(snapshot);
}
async function previousCaches(){
 const result=[];
 for(const name of await caches.keys())if(name.startsWith('nightlens-')&&name!==CACHE){const cache=await caches.open(name);if(await cache.match(absoluteOfflineURL('./offline-ready.flag')))result.push({name,cache});}
 return result;
}
async function readOfflineStatus(){
 if(offlineSnapshot)return offlineSnapshot;
 const cache=await caches.open(CACHE),ready=await cache.match(absoluteOfflineURL('./offline-ready.flag'));
 if(ready){let extra={};try{extra=await ready.json();}catch{}return offlineState('ready',FILES.length,extra);}
 const keys=new Set((await cache.keys()).map(request=>request.url)),count=FILES.filter(path=>keys.has(absoluteOfflineURL(path))).length;
 return offlineState((await previousCaches()).length?'update-available':'idle',count);
}
async function digestResponse(response){
 const bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function fetchOfflineFile(cache,path){
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const url=absoluteOfflineURL(path),response=await fetch(url,{signal:controller.signal,cache:'no-cache'});
   if(!response.ok)throw Error('HTTP '+response.status);
   if(assetMeta[path]?.sha256&&await digestResponse(response.clone())!==assetMeta[path].sha256)throw Error('Resource revision mismatch');
   await cache.put(url,response);return;
  }catch(error){if(attempt===1||error.name==='QuotaExceededError')throw error;}
  finally{clearTimeout(timer);}
 }
}
async function reuseIndex(previous){
 const byHash=new Map(),legacy=[];
 for(const {cache}of previous){
  let metadata;try{metadata=await(await cache.match(absoluteOfflineURL('./offline-manifest.json')))?.json();}catch{}
  if(metadata){for(const [path,entry]of Object.entries(metadata))if(entry.sha256&&!byHash.has(entry.sha256))byHash.set(entry.sha256,{cache,path});}
  else legacy.push(cache);
 }
 return async path=>{
  const expected=assetMeta[path]?.sha256;if(!expected)return;
  const indexed=byHash.get(expected);if(indexed){const response=await indexed.cache.match(absoluteOfflineURL(indexed.path));if(response)return response;}
  // First migration from older versions: verify bytes, never trust a URL alone.
  const canonical=path.replace(/^\.\/releases\/[^/]+\//,'./');
  for(const cache of legacy)for(const candidate of new Set([path,canonical])){
   const response=await cache.match(absoluteOfflineURL(candidate));
   if(response&&await digestResponse(response.clone())===expected){byHash.set(expected,{cache,path:candidate});return response;}
  }
 };
}
async function prepareOffline(){
 if(offlineJob)return offlineJob;
 offlineJob=(async()=>{
  let completed=0;const stats={reused:0,downloaded:0,downloadedBytes:0};
  try{
   const cache=await caches.open(CACHE);
   if(await cache.match(absoluteOfflineURL('./offline-ready.flag'))){await publishOffline(await readOfflineStatus(),true);return;}
   const previous=await previousCaches(),reuse=await reuseIndex(previous),existing=new Set((await cache.keys()).map(request=>request.url));
   const missing=[];completed=FILES.filter(path=>existing.has(absoluteOfflineURL(path))).length;
   await publishOffline(offlineState('checking',completed,{...stats,update:previous.length>0}),true);
   let scan=0;const todo=FILES.filter(path=>!existing.has(absoluteOfflineURL(path)));
   async function copy(){while(scan<todo.length){const path=todo[scan++],response=await reuse(path);if(response){await cache.put(absoluteOfflineURL(path),response);completed++;stats.reused++;await publishOffline(offlineState('checking',completed,{...stats,update:previous.length>0}));}else missing.push(path);}}
   await Promise.all(Array.from({length:Math.min(4,todo.length)},()=>copy()));
   let next=0;const errors=[],downloadBytesTotal=missing.reduce((sum,path)=>sum+(assetMeta[path]?.bytes||0),0),extra=()=>({...stats,update:previous.length>0,changedFiles:missing.length,downloadBytesTotal});
   await publishOffline(offlineState('downloading',completed,extra()),true);
   async function download(){while(next<missing.length&&!errors.length){const path=missing[next++];try{await fetchOfflineFile(cache,path);completed++;stats.downloaded++;stats.downloadedBytes+=assetMeta[path]?.bytes||0;await publishOffline(offlineState('downloading',completed,extra()));}catch(error){errors.push(error);}}}
   await Promise.all(Array.from({length:Math.min(6,missing.length)},()=>download()));
   if(errors.length){await publishOffline(offlineState('error',completed,{...extra(),reason:errors.some(error=>error.name==='QuotaExceededError')?'storage':'network'}),true);return;}
   await cache.put(absoluteOfflineURL('./offline-manifest.json'),new Response(JSON.stringify(assetMeta)));
   await cache.put(absoluteOfflineURL('./offline-ready.flag'),new Response(JSON.stringify(extra())));
   await publishOffline(offlineState('ready',FILES.length,extra()),true);
   for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'offline-ready'});
   for(const key of await caches.keys())if(key.startsWith('nightlens-')&&key!==CACHE)await caches.delete(key);
  }catch(error){await publishOffline(offlineState('error',completed,{...stats,reason:error.name==='QuotaExceededError'?'storage':'network'}),true);}
 })().finally(()=>{offlineJob=null;});return offlineJob;
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();await publishOffline(await readOfflineStatus(),true);})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='offline-prepare')event.waitUntil(prepareOffline());
 else if(event.data?.type==='offline-status')event.waitUntil((async()=>{event.source?.postMessage(await readOfflineStatus());})());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),retry=url.searchParams.has('__nl_img_retry')&&/\/assets\/.+\.(png|jpe?g|webp)$/i.test(url.pathname),versionedUI=url.searchParams.has('__nl_asset')&&/\.(js|css)$/i.test(url.pathname);
  const cached=await cache.match(event.request,{ignoreSearch:retry||versionedUI});if(cached)return cached;
  try{return await fetch(event.request);}catch(error){
   if(event.request.mode==='navigate'){const current=await cache.match(absoluteOfflineURL('./index.html'));if(current)return current;}
   for(const key of await caches.keys())if(key.startsWith('nightlens-')&&key!==CACHE){const older=await caches.open(key),saved=await older.match(event.request,{ignoreSearch:retry||versionedUI})||(event.request.mode==='navigate'?await older.match(absoluteOfflineURL('./index.html')):undefined);if(saved)return saved;}
   throw error;
  }
 })());
});
