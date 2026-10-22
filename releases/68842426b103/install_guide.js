export function installGuideModel({userAgent='',maxTouchPoints=0,standalone=false,native=false}={}){
 const ios=/iPhone|iPad|iPod/i.test(userAgent)||/Macintosh/i.test(userAgent)&&maxTouchPoints>1;
 const android=/Android/i.test(userAgent),platform=ios?'ios':android?'android':'desktop';
 const embedded=/MicroMessenger|QQ\/|FBAN|FBAV|Instagram/i.test(userAgent);
 return {show:!native&&!standalone&&(ios||android),platform,
  steps:ios?[embedded?'先复制网址，在 Safari 中打开。':'请使用 Safari 打开这个网址。','轻点 Safari 的“分享”按钮，选择“添加到主屏幕”。','按提示点“添加”；如有“作为网页 App 打开”，请保持开启。','回到手机主屏幕，点“黑夜地图镜”图标进入。']:['在 Chrome 或支持安装的浏览器中打开本站。','点击下方安装按钮；没有按钮时，打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。','回到手机主屏幕，点“黑夜地图镜”图标进入。']};
}
export function mountInstallGuide({root=document,host=window}={}){
 const model=installGuideModel({userAgent:host.navigator.userAgent,maxTouchPoints:host.navigator.maxTouchPoints,standalone:host.navigator.standalone===true||host.matchMedia('(display-mode: standalone)').matches,native:!!host.NightLensNative});
 if(!model.show)return;
 const hint=root.getElementById('install-hint'),dialog=root.getElementById('install-guide-dialog'),button=root.getElementById('install-app-button');let installPrompt=null;
 hint.hidden=false;
 root.getElementById('install-guide-steps').replaceChildren(...model.steps.map(text=>{const li=root.createElement('li');li.textContent=text;return li;}));
 const open=()=>{if(!dialog.open)dialog.showModal();};
 root.getElementById('install-guide-open').onclick=open;root.getElementById('install-guide-later').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{try{host.localStorage.setItem('nightlens.install-guide.seen','1');}catch{}});
 host.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=false;});
 button.onclick=async()=>{if(!installPrompt)return;const current=installPrompt;installPrompt=null;button.hidden=true;await current.prompt();const choice=await current.userChoice;if(choice.outcome==='accepted'){dialog.close();hint.hidden=true;}};
 host.addEventListener('appinstalled',()=>{hint.hidden=true;if(dialog.open)dialog.close();});
 let seen=false;try{seen=host.localStorage.getItem('nightlens.install-guide.seen')==='1';}catch{}
 if(!seen)open();
}
