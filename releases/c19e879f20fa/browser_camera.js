function cameraError(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return '没有相机权限。请在浏览器的网站设置中允许相机，然后重试。';
 if(error?.name==='NotFoundError')return '未找到可用相机，可以从相册导入地图。';
 if(error?.name==='NotReadableError')return '相机正被其他应用占用，请关闭后重试。';
 return '暂时无法打开相机，请重试或从相册导入。';
}
export function createCameraSession({mediaDevices,video,createCanvas,onState,onPhoto}){
 let generation=0,active=false,stream=null,capturing=false;
 const stop=value=>value?.getTracks().forEach(track=>track.stop());
 function release(){const previous=stream;stream=null;stop(previous);video.pause();video.srcObject=null;}
 function close(){generation++;active=false;capturing=false;release();onState({state:'closed'});}
 function pause(){generation++;active=false;capturing=false;release();onState({state:'paused',message:'相机已暂停，返回页面后自动恢复。'});}
 async function open(){
  const token=++generation;active=true;capturing=false;release();onState({state:'opening',message:'正在打开后置相机…'});
  try{
   if(!mediaDevices?.getUserMedia)throw Error('Camera API unavailable');
   const next=await mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}}});
   if(!active||token!==generation){stop(next);return;}
   stream=next;video.srcObject=next;await video.play();
   if(!active||token!==generation)return;
   if(!video.videoWidth||!video.videoHeight)throw Error('Camera frame unavailable');
   onState({state:'ready',message:''});
  }catch(error){if(active&&token===generation){release();onState({state:'error',message:cameraError(error)});}}
 }
 async function capture(){
  if(!active||!stream||capturing||!video.videoWidth||!video.videoHeight)return;
  const token=generation;capturing=true;onState({state:'capturing',message:'正在拍摄…'});
  try{
   const canvas=createCanvas(),scale=Math.min(1,4096/Math.max(video.videoWidth,video.videoHeight));
   canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Photo encoding failed')),'image/jpeg',.94));
   if(!active||token!==generation)return;
   const photo=new File([blob],'map-'+Date.now()+'.jpg',{type:'image/jpeg'});
   close();await onPhoto(photo);
  }catch{if(active&&token===generation){capturing=false;onState({state:'ready',message:'照片未能生成，请再拍一次。'});}}
 }
 return {open,capture,close,pause};
}
export function mountBrowserCamera({root=document,mediaDevices=navigator.mediaDevices,onPhoto,onGallery}){
 const dialog=root.getElementById('web-camera-dialog'),video=root.getElementById('web-camera-video'),shutter=root.getElementById('web-camera-shutter'),status=root.getElementById('web-camera-status'),retry=root.getElementById('web-camera-retry');
 let visible=false;
 video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');
 const session=createCameraSession({mediaDevices,video,createCanvas:()=>root.createElement('canvas'),onPhoto,onState:s=>{
  shutter.disabled=s.state!=='ready';status.textContent=s.message||'';status.hidden=!s.message;retry.hidden=s.state!=='error';
  dialog.dataset.state=s.state;if(s.state==='closed'){visible=false;if(dialog.open)dialog.close();}
 }});
 function close(){visible=false;session.close();}
 function open(){visible=true;if(!dialog.open)dialog.showModal();void session.open();}
 root.getElementById('web-camera-cancel').onclick=close;
 shutter.onclick=()=>void session.capture();retry.onclick=()=>void session.open();
 root.getElementById('web-camera-gallery').onclick=()=>{close();onGallery();};
 dialog.addEventListener('close',()=>{if(visible){visible=false;session.close();}});
 root.addEventListener('visibilitychange',()=>{
  if(!visible)return;
  if(root.visibilityState==='hidden')session.pause();else void session.open();
 });
 return {open,close};
}
