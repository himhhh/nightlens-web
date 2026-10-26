export function updateNoticeModel(status,pageRelease,pendingRelease){
 if(status.state==='update-available')return {phase:'available',title:'发现新版本',detail:'需要更新本机离线资源。未变化的资源会自动复用，只下载新增或修改的部分。',action:'更新离线资源'};
 if(status.state==='ready'&&status.release&&((pageRelease&&status.release!==pageRelease)||pendingRelease===status.release))return {phase:'ready',title:'更新已就绪',detail:'离线资源已更新，重新加载后即可使用新版本。请先完成当前操作，再重新加载。',action:'重新加载'};
 return null;
}
export function mountUpdateNotice({pageRelease,onPrepare,reload=()=>location.reload(),root=document}){
 const dialog=root.createElement('dialog');dialog.id='update-dialog';dialog.className='boss-detail-dialog update-dialog';
 dialog.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="稍后处理更新">×</button></form><div id="update-content"><div class="eyebrow">NIGHTLENS UPDATE</div><h2 id="update-title"></h2><p id="update-detail" class="data-note"></p><div class="update-actions"><button type="button" id="update-later" class="button secondary">稍后</button><button type="button" id="update-action" class="button primary"></button></div></div>';
 root.body.append(dialog);let current,pendingRelease;const dismissed=new Set();
 const close=()=>dialog.close();dialog.querySelector('#update-later').onclick=close;
 dialog.addEventListener('close',()=>{if(current)dismissed.add(current.release+':'+current.phase);});
 dialog.querySelector('#update-action').onclick=()=>{if(current?.phase==='ready')reload();else{pendingRelease=current?.release;close();onPrepare();}};
 return {update(status){const model=updateNoticeModel(status,pageRelease,pendingRelease);if(!model||dismissed.has(status.release+':'+model.phase))return;current={...model,release:status.release};dialog.querySelector('#update-title').textContent=model.title;dialog.querySelector('#update-detail').textContent=model.detail;dialog.querySelector('#update-action').textContent=model.action;if(!dialog.open)dialog.showModal();},dispose(){dialog.remove();}};
}
