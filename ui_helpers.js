export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sourceLink(source){const url=source?.url;return typeof url==='string'&&/^https:\/\//.test(url)?'<a href="'+escapeHTML(url)+'" target="_blank" rel="noopener">'+escapeHTML(source.title||source.id||'数据来源')+' ↗</a>':'';}
export const DAMAGE_NAMES={standard:'标准',strike:'打击',slash:'斩击',pierce:'突刺',magic:'魔力',fire:'火',lightning:'雷',holy:'圣'};
export function requestMapPhoto({nativeBridge,fallbackInput}){
 if(nativeBridge?.postMessage){nativeBridge.postMessage(JSON.stringify({action:'capturePhoto'}));return;}
 fallbackInput.click();
}
export function photoFromNative({base64,name}){
 if(typeof base64!=='string'||!base64.length||base64.length>56*1024*1024)throw Error('照片数据无效');
 const raw=atob(base64),bytes=new Uint8Array(raw.length);
 if(!raw.length||raw.length>40*1024*1024)throw Error('照片过大');
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new File([bytes],name||'map.jpg',{type:'image/jpeg'});
}
export function damageIcon(key){return ['magic','fire','lightning','holy'].includes(key)?'<img src="assets/icons/damage-'+key+'.png" alt="">':'<span class="damage-glyph" aria-hidden="true">'+escapeHTML(DAMAGE_NAMES[key]?.slice(0,1)||'·')+'</span>';}
