// Only bundled pictures may be retried. Never retain or rewrite user photo URLs.
export function assetRetryURL(source,attempt,base=globalThis.location?.href||'http://localhost/'){
 try{
  const url=new URL(source,base),origin=new URL(base);
  if(url.origin!==origin.origin||!/^https?:$/.test(url.protocol)||!/\/assets\/.+\.(png|jpe?g|webp)$/i.test(url.pathname))return null;
  url.searchParams.set('__nl_img_retry',String(attempt));return url.href;
 }catch{return null;}
}
export const imageRetryDelay=attempt=>attempt===1?200:800;

/** Capture also covers images inserted later by dialogs and catalog renderers. */
export function installImageRecovery(root=document){
 const states=new WeakMap(),host=root.defaultView||globalThis;
 let awaitingNative=false,recoverySequence=0;
 const placeholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="#26352e"/><text x="40" y="38" text-anchor="middle" fill="#d2b87c" font-size="25">↻</text><text x="40" y="61" text-anchor="middle" fill="#d2b87c" font-size="13">重载</text></svg>');
 function failed(image){
  if(image?.tagName!=='IMG')return;
  const source=image.getAttribute('src');let state=states.get(image);
  if(state?.expected===source&&state.pending)return;
  if(!state||state.expected!==source){
   if(!assetRetryURL(source,1))return;
   state={source,expected:source,attempt:0,title:image.getAttribute('title'),alt:image.getAttribute('alt')};states.set(image,state);
  }
  if(state.failed)return;
  if(state.attempt>=2){
   state.failed=true;state.expected=placeholder;
   image.dataset.imageState='failed';image.title='图片暂未载入，点此重试';image.alt='重载图片';image.src=placeholder;
   return;
  }
  const attempt=++state.attempt;state.pending=true;image.dataset.imageState='retrying';
  state.timer=setTimeout(()=>{
   state.pending=false;
   if(states.get(image)!==state||!image.isConnected||image.getAttribute('src')!==state.expected)return;
   state.expected=assetRetryURL(state.source,attempt);image.src=state.expected;
  },imageRetryDelay(attempt));
 }
 function requestNativeRepair(){
  if(!host.NightLensNative?.postMessage)return false;
  if(!awaitingNative){
   awaitingNative=true;
   try{host.NightLensNative.postMessage(JSON.stringify({action:'repairAssets'}));}
   catch{awaitingNative=false;return false;}
  }
  return true;
 }
 function reload(image){
  const old=states.get(image),source=old?.source||image.getAttribute('src');
  const next=assetRetryURL(source,'resume-'+Date.now()+'-'+(++recoverySequence));if(!next)return;
  clearTimeout(old?.timer);
  const state={source,expected:next,attempt:0,title:old?old.title:image.getAttribute('title'),alt:old?old.alt:image.getAttribute('alt')};
  states.set(image,state);image.dataset.imageState='retrying';image.src=next;
 }
 function assetsReady(){
  awaitingNative=false;
  for(const image of root.images||[]){
   const rect=image.getBoundingClientRect?.();
   const visible=rect&&rect.right>0&&rect.bottom>0&&rect.left<(host.innerWidth||0)&&rect.top<(host.innerHeight||0)&&image.getClientRects?.().length;
   if(states.has(image)||!image.complete||!image.naturalWidth||visible)reload(image);
  }
 }
 host.addEventListener?.('nightlens-assets-ready',assetsReady);
 root.addEventListener('error',event=>failed(event.target),true);
 root.addEventListener('load',event=>{
  const image=event.target,state=states.get(image);
  if(!state||state.failed||image.getAttribute('src')!==state.expected)return;
  clearTimeout(state.timer);
  delete image.dataset.imageState;
  for(const key of ['title','alt'])state[key]===null?image.removeAttribute(key):image.setAttribute(key,state[key]);
  states.delete(image);
 },true);
 root.addEventListener('click',event=>{
  const image=event.target,state=states.get(image);if(!state?.failed)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!requestNativeRepair())reload(image);
 },true);
 // Static images may have failed before the module finished loading; a resumed
 // WebView may also expose a failed request after its process was suspended.
 function revisit(){for(const image of root.images||[])if(image.complete&&!image.naturalWidth)failed(image);}
 revisit();
 root.addEventListener('visibilitychange',()=>{
  // The native lifecycle observer repairs the service first, then emits ready.
  // A visibility event alone can arrive before Dart's listener is usable.
  if(root.visibilityState==='visible'&&!host.NightLensNative)assetsReady();
 });
}
