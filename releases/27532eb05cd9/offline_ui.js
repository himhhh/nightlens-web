export function offlinePresentation(status){
 const ready=status.state==='ready',error=status.state==='error',total=status.total||0,completed=status.completed||0;
 const percent=ready?100:Math.max(0,Math.min(99,status.percent||0));
 const update=status.state==='update-available',checking=status.state==='checking';
 const transfer=status.reused!=null?` · 复用 ${status.reused} 项 · 新下载 ${status.downloaded||0} 项`:'';
 return {percent,retry:error||update,label:ready?'离线资源已就绪':update?'发现新版本，待更新资源':error?'离线下载未完成':checking?'正在检查可复用资源':status.state==='downloading'?'正在下载离线资源':'正在连接离线下载',
  detail:ready?'地图、图鉴与识别资源已保存在本机。'+transfer:update?'需要更新本机缓存；未变化的资源自动复用，只下载变化部分。':error?(status.reason==='storage'?'本机存储空间不足，释放空间后重试。':'部分资源下载失败，请检查网络后重试。已下载的资源会保留。'):total?`已缓存 ${completed} / ${total} 项 · 百分比按文件数计算${transfer}`:'首次约 56MB，请保持页面打开。'};
}
export function connectOffline({serviceWorker,onStatus,timeoutMs=45000}){
 let registration,timer,disposed=false;
 function show(status){if(disposed)return;clearTimeout(timer);onStatus(status);}
 function request(worker,type='offline-status'){worker?.postMessage({type});}
 function watch(worker){if(!worker)return;if(worker.state==='activated')request(worker);else worker.addEventListener('statechange',()=>{if(worker.state==='activated')request(worker);});}
 const receive=event=>{
  if(event.data?.type!=='offline-progress')return;
  show(event.data);
  if(event.data.state==='idle')request(registration?.active||serviceWorker.controller,'offline-prepare');
 };
 const changed=()=>request(serviceWorker.controller);
 const check=()=>{void registration?.update?.()?.catch(()=>{});};
 const updateTimer=setInterval(check,5*60*1000);
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
 return {async retry(){await retry();request(registration?.active||serviceWorker.controller,'offline-prepare');},prepare(){request(registration?.active||serviceWorker.controller,'offline-prepare');},resume(){check();request(registration?.active||serviceWorker.controller);},dispose(){disposed=true;clearTimeout(timer);clearInterval(updateTimer);serviceWorker.removeEventListener('message',receive);serviceWorker.removeEventListener('controllerchange',changed);}};
}
