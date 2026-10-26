export function offlinePresentation(status){
 const ready=status.state==='ready',error=status.state==='error',total=status.total||0,completed=status.completed||0;
 const percent=ready?100:Math.max(0,Math.min(99,status.percent||0));
 return {percent,retry:error,label:ready?'离线资源已就绪':error?'离线下载未完成':status.state==='downloading'?'正在下载离线资源':'正在连接离线下载',
  detail:ready?'地图、图鉴与识别资源已保存在本机。':error?(status.reason==='storage'?'本机存储空间不足，释放空间后重试。':'部分资源下载失败，请检查网络后重试。已下载的资源会保留。'):total?`已缓存 ${completed} / ${total} 项 · 百分比按文件数计算`:'首次约 56MB，请保持页面打开。'};
}
export function connectOffline({serviceWorker,onStatus,timeoutMs=45000}){
 let registration,timer,disposed=false;
 function show(status){if(disposed)return;clearTimeout(timer);onStatus(status);}
 function request(worker){worker?.postMessage({type:'offline-prepare'});}
 function watch(worker){if(!worker)return;if(worker.state==='activated')request(worker);else worker.addEventListener('statechange',()=>{if(worker.state==='activated')request(worker);});}
 const receive=event=>{
  if(event.data?.type!=='offline-progress')return;
  show(event.data);
  if(event.data.state==='idle')request(registration?.active||serviceWorker.controller);
 };
 const changed=()=>request(serviceWorker.controller);
 serviceWorker.addEventListener('message',receive);serviceWorker.addEventListener('controllerchange',changed);
 async function retry(){
  if(disposed)return;
  show({state:'connecting',percent:0});
  timer=setTimeout(()=>show({state:'error',reason:'network',percent:0}),timeoutMs);
  try{
   registration=await serviceWorker.register('sw.js',{updateViaCache:'none'});
   if(disposed)return;
   watch(registration.installing);watch(registration.waiting);
   registration.addEventListener('updatefound',()=>watch(registration.installing));
   request(registration.active);
  }catch{show({state:'error',reason:'network',percent:0});}
 }
 void retry();
 return {retry,resume(){request(registration?.active||serviceWorker.controller);},dispose(){disposed=true;clearTimeout(timer);serviceWorker.removeEventListener('message',receive);serviceWorker.removeEventListener('controllerchange',changed);}};
}
