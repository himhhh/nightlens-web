/** Independent recognition of the lower-left expedition portrait; never uses layout IDs. */
export function decideNightlord(scores){
 const grouped=new Map();for(const item of scores){if(!Number.isFinite(item.score))continue;const old=grouped.get(item.id);if(!old||item.score>old.score)grouped.set(item.id,item);}
 const ranked=[...grouped.values()].sort((a,b)=>b.score-a.score),first=ranked[0],second=ranked[1];
 const score=first?.score||0,margin=second?score-second.score:score;
 const ok=!!first?.id&&score>=.72&&margin>=.12;
 return {id:ok?first.id:null,score,margin,variant:ok?first.variant:undefined,box:ok?first.box:undefined,form:'unknown',method:'portrait-template',reason:ok?undefined:'夜王头像不清晰、未显示或存在相近候选',candidates:ranked.slice(0,3).map(({id,score})=>({id,score}))};
}
const foregroundMasks=new WeakMap();
function foregroundMask(template){
 if(!template)return [];
 if(foregroundMasks.has(template))return foregroundMasks.get(template);
 let mask=[];
 try{const bytes=atob(template.foregroundMask);if(bytes.length===512)for(let i=0;i<4096;i++)if(bytes.charCodeAt(i>>3)&(1<<(i&7)))mask.push(i);}catch{/* Reject missing or incompatible feature data. */}
 foregroundMasks.set(template,mask);return mask;
}
/** Compare the portrait foreground to its ordinary reference. Purple needs both
 * red and blue to rise relative to green; a blue-only TV cast is insufficient. */
export function classifyPortraitChroma(chroma,normal){
 if(![chroma,normal].every(v=>v?.length===2&&v.every(Number.isFinite))||Math.hypot(...chroma)<.012)return {form:'unknown'};
 const formPurpleScore=Math.min(chroma[0]-normal[0],chroma[1]-normal[1]),formThreshold=.04;
 return {form:formPurpleScore>formThreshold?'everdark':'normal',formPurpleScore,formThreshold};
}
function portraitForm(cv,aligned,identity,templates){
 if(!identity.id)return {form:'unknown'};
 // This boss has no Everdark form, regardless of generic purple art in a template pack.
 if(identity.id==='Heolstor')return {form:'normal',formSource:'known-single-form'};
 if(!identity.box||![3,4].includes(aligned.channels()))return {form:'unknown',formReason:'头像配色不可用'};
 const normal=templates.find(t=>t.id===identity.id&&t.variant==='normal');
 const mask=foregroundMask(normal);
 if(!mask?.length||!normal.foregroundChroma)return {form:'unknown',formReason:'本地头像配色特征不完整'};
 const {x,y,width,height}=identity.box,area=aligned.roi(new cv.Rect(x,y,width,height)),patch=new cv.Mat();
 try{
  cv.resize(area,patch,new cv.Size(64,64),0,0,cv.INTER_AREA);
  const channels=patch.channels(),values=patch.data;let n=0,rg=0,bg=0;
  for(const pixel of mask){const i=pixel*channels,r=values[i],g=values[i+1],b=values[i+2],sum=r+g+b;if(sum<=90||Math.max(r,g,b)>=250)continue;rg+=(r-g)/sum;bg+=(b-g)/sum;n++;}
  if(n<Math.max(128,mask.length*.6))return {form:'unknown',formReason:'头像过暗、反光或遮挡'};
  const decision=classifyPortraitChroma([rg/n,bg/n],normal.foregroundChroma),ok=decision.form!=='unknown';
  return {...decision,formSource:ok?'portrait-color':undefined,formReason:ok?undefined:'头像配色不足以区分普通／永夜王'};
 }finally{patch.delete();area.delete();}
}
export function matchNightlord(cv,aligned,templates){
 const gray=new cv.Mat();let region;
 try{
  if(aligned.channels()===4)cv.cvtColor(aligned,gray,cv.COLOR_RGBA2GRAY);else if(aligned.channels()===3)cv.cvtColor(aligned,gray,cv.COLOR_RGB2GRAY);else aligned.copyTo(gray);
  if(gray.cols!==1000||gray.rows!==1000)throw Error('夜王识别需要已对齐的标准地图');
  region=gray.roi(new cv.Rect(10,790,230,200));
  const scores=[];
  for(const template of templates){
   let best={score:-1};
   for(let side=42;side<=106;side+=4){
    const scaled=new cv.Mat(),result=new cv.Mat();
    try{cv.resize(template.mat,scaled,new cv.Size(side,side),0,0,cv.INTER_AREA);cv.matchTemplate(region,scaled,result,cv.TM_CCOEFF_NORMED);const found=cv.minMaxLoc(result);if(found.maxVal>best.score)best={score:found.maxVal,box:{x:found.maxLoc.x+10,y:found.maxLoc.y+790,width:side,height:side}};}
    finally{scaled.delete();result.delete();}
   }
   scores.push({id:template.id,variant:template.variant,...best});
  }
  const identity=decideNightlord(scores);
  return {...identity,...portraitForm(cv,aligned,identity,templates)};
 }finally{region?.delete();gray.delete();}
}
let templatePromise;
export async function loadNightlordTemplates(cv){
 if(!templatePromise)templatePromise=(async()=>{
  const responses=await Promise.all([fetch('assets/data/nightlords.json'),fetch('assets/models/nightlord-templates.bin')]);if(responses.some(r=>!r.ok))throw Error('本地夜王图标资源未载入');
  const metadata=await responses[0].json(),bytes=new Uint8Array(await responses[1].arrayBuffer()),size=metadata.side**2,items=[];
  try{for(const entry of metadata.templates){if(entry.offset+size>bytes.length)throw Error('夜王图标资源不完整');items.push({...entry,mat:cv.matFromArray(metadata.side,metadata.side,cv.CV_8UC1,bytes.slice(entry.offset,entry.offset+size))});}return items;}
  catch(error){for(const item of items)item.mat.delete();throw error;}
 })().catch(error=>{templatePromise=null;throw error;});
 return templatePromise;
}
