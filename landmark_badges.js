/** A second, local check of tiny elemental badges against public icon art.
 * Building identity still comes from the building classifier. */
export function readBadgeTemplates(cv,metadata,bytes){
 const templates=[];
 try{
  for(const entry of metadata.templates){
   if(entry.length!==entry.width*entry.height*3||entry.offset<0||entry.offset+entry.length>bytes.length)throw Error('据点角标参考数据不完整');
   const rgb=cv.matFromArray(entry.height,entry.width,cv.CV_8UC3,bytes.slice(entry.offset,entry.offset+entry.length)),gray=new cv.Mat();
   templates.push({...entry,rgb,gray});cv.cvtColor(rgb,gray,cv.COLOR_RGB2GRAY);
  }
  return templates;
 }catch(error){for(const template of templates){template.rgb.delete();template.gray.delete();}throw error;}
}
function colorAgreement(template,sample){
 let n=0,tr=0,tg=0,tb=0,sr=0,sg=0,sb=0;
 // Read rows explicitly: an ROI can retain its parent's row stride.
 for(let y=0;y<template.rows;y++)for(let x=0;x<template.cols;x++){
  const t=template.ucharPtr(y,x),s=sample.ucharPtr(y,x),sum=t[0]+t[1]+t[2],normal=sum+1;
  if(sum<=90||(Math.max(t[0],t[1],t[2])-Math.min(t[0],t[1],t[2]))/normal<=.12)continue;
  const sampleSum=s[0]+s[1]+s[2]+1;
  tr+=t[0]/normal;tg+=t[1]/normal;tb+=t[2]/normal;
  sr+=s[0]/sampleSum;sg+=s[1]/sampleSum;sb+=s[2]/sampleSum;n++;
 }
 if(n<6||Math.hypot(sr/n-sg/n,sb/n-sg/n)<.03)return 0;
 return Math.max(0,1-3*Math.hypot((tr-sr)/n,(tg-sg)/n,(tb-sb)/n));
}
export function matchLandmarkBadge(cv,aligned,point,type,templates){
 const available=templates.filter(t=>t.type===type);if(available.length<2||![3,4].includes(aligned.channels()))return null;
 const x=Math.round(point.x)-3,y=Math.round(point.y)-3;
 if(x<0||y<0||x+38>aligned.cols||y+38>aligned.rows)return null;
 const area=aligned.roi(new cv.Rect(x,y,38,38)),rgb=new cv.Mat(),gray=new cv.Mat(),ranked=[];
 try{
  if(area.channels()===4)cv.cvtColor(area,rgb,cv.COLOR_RGBA2RGB);else area.copyTo(rgb);cv.cvtColor(rgb,gray,cv.COLOR_RGB2GRAY);
  for(const template of available){
   let best=null;
   for(let side=12;side<=20;side++){
    const scaled=new cv.Mat(),scores=new cv.Mat();
    try{cv.resize(template.gray,scaled,new cv.Size(side,side),0,0,cv.INTER_AREA);cv.matchTemplate(gray,scaled,scores,cv.TM_CCOEFF_NORMED);const match=cv.minMaxLoc(scores);if(Number.isFinite(match.maxVal)&&(!best||match.maxVal>best.shapeScore))best={shapeScore:match.maxVal,side,loc:match.maxLoc};}
    finally{scaled.delete();scores.delete();}
   }
   if(!best)continue;
   const scaled=new cv.Mat(),sample=rgb.roi(new cv.Rect(best.loc.x,best.loc.y,best.side,best.side));
   try{
    cv.resize(template.rgb,scaled,new cv.Size(best.side,best.side),0,0,cv.INTER_AREA);const colorScore=colorAgreement(scaled,sample);
    ranked.push({rawType:template.rawType,attribute:template.attribute,score:.65*best.shapeScore+.35*colorScore,shapeScore:best.shapeScore,colorScore,side:best.side,box:{x:x+best.loc.x,y:y+best.loc.y,width:best.side,height:best.side}});
   }finally{scaled.delete();sample.delete();}
  }
  ranked.sort((a,b)=>b.score-a.score);const first=ranked[0],margin=first?first.score-(ranked[1]?.score||0):0;
  if(!first||first.score<.65||first.shapeScore<.55||first.colorScore<.65||margin<.1)return null;
  return {...first,margin,method:'public-badge-shape-color'};
 }finally{area.delete();rgb.delete();gray.delete();}
}
let promise;
export async function loadBadgeTemplates(cv){
 if(!promise)promise=(async()=>{const responses=await Promise.all([fetch('assets/data/poi-badges.json'),fetch('assets/models/poi-badges.bin')]);if(responses.some(r=>!r.ok))throw Error('据点角标参考未载入');return readBadgeTemplates(cv,await responses[0].json(),new Uint8Array(await responses[1].arrayBuffer()));})().catch(error=>{promise=null;throw error;});
 return promise;
}
