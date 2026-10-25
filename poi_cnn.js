import {describePOI} from './poi_catalog.js';
import {matchLandmarkBadge} from './landmark_badges.js';
const CLASS_GROUPS={empty:[0],fort:[1],greatchurch:[2],camp:[3],ruins:[4],forge:[5],marsh:[6],church:[7,8],mage:[9,10,11],village:[12],wuf:[13],euf:[14]};
const CORNER_PROPERTIES=[null,'bleed','frostbite','blight','madness','rot','poison','sleep','fire','magic','lightning','holy'];
export function softmax(values){const largest=Math.max(...values),exp=Array.from(values,x=>Math.exp(x-largest)),sum=exp.reduce((a,b)=>a+b,0);return exp.map(v=>v/sum);}
export function loadNetFromBytes(cv,bytes){const file='nightlens-poi-model.onnx';try{cv.FS_unlink('/'+file);}catch{}cv.FS_createDataFile('/',file,bytes,true,false,false);try{return cv.readNetFromONNX('/'+file);}finally{cv.FS_unlink('/'+file);}}
export function decodeLandmark(baseLogits,cornerLogits,point,rawTypes){
 const base=softmax(baseLogits),corner=softmax(cornerLogits);
 const categories=Object.entries(CLASS_GROUPS).map(([type,indices])=>({type,score:indices.reduce((sum,i)=>sum+base[i],0)})).sort((a,b)=>b.score-a.score);
 const best=categories[0],categoryMargin=best.score-categories[1].score;
 if(best.type==='empty'||best.score<.78||categoryMargin<.2)return null;
 const possible=[...new Set(rawTypes)].map(describePOI).filter(v=>v.type===best.type);
 // An impossible class is rejected, not replaced by a weaker class that fits a candidate.
 if(!possible.length)return null;
 const properties=corner.map((score,index)=>({attribute:CORNER_PROPERTIES[index],score})).sort((a,b)=>b.score-a.score),property=properties[0];
 const matches=possible.filter(v=>v.attribute===property.attribute);
 const precise=property.score>=(property.attribute===null?.92:.6)&&property.score-properties[1].score>=.12&&matches.length===1;
 const descriptor=precise?matches[0]:null;
 return {id:point.id,type:best.type,...(descriptor?{rawType:descriptor.rawType,attribute:descriptor.attribute,label:descriptor.label}:{label:describePOI(possible[0].rawType).label.split(' · ')[0]+(possible.some(v=>v.attribute)?'（属性未定）':'')}),score:best.score*(precise?property.score:.85),categoryScore:best.score,categoryMargin,attributeScore:property.score,variantMargin:property.score-properties[1].score,source:'auto',method:'poi-cnn'};
}
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
/** Each crop contributes one vote. Grayscale can support building shape, while
 * elemental badges always come from the original color crop. */
export function mergeLandmarkViews(views,point,rawTypes){
 const groups=new Map();
 for(const view of views){
  const rgb=decodeLandmark(view.base,view.corner,point,rawTypes),gray=view.grayBase&&decodeLandmark(view.grayBase,view.corner,point,rawTypes);
  if(rgb&&gray&&rgb.type!==gray.type)continue;
  const item=rgb||gray;
  if(!item)continue;
  const list=groups.get(item.type)||[];list.push(item);groups.set(item.type,list);
 }
 const ranked=[...groups.values()].sort((a,b)=>b.length-a.length),supported=ranked[0];
 const primary=views[0]&&decodeLandmark(views[0].base,views[0].corner,point,rawTypes);
 if(!supported)return null;
 if(supported.length<2)return primary&&primary.type===supported[0].type?primary:null;
 // Offset crops can miss the icon entirely. "Empty" in such a crop is not
 // evidence that the original point is empty; isolated positive crops still fail above.
 if(ranked[1]&&supported.length<ranked[1].length*2)return null;
 const rawGroups=new Map();for(const item of supported)if(item.rawType){const rows=rawGroups.get(item.rawType)||[];rows.push(item);rawGroups.set(item.rawType,rows);}
 const variants=[...rawGroups.values()].sort((a,b)=>b.length-a.length);
 const precise=variants[0]?.length>=2&&(!variants[1]||variants[0].length>=variants[1].length*2)&&median(variants[0].map(x=>x.score))>=.58,rows=precise?variants[0]:supported;
 const result={...rows[0],score:precise?median(rows.map(x=>x.score)):median(rows.map(x=>x.categoryScore))*.85,categoryScore:median(rows.map(x=>x.categoryScore)),categoryMargin:median(rows.map(x=>x.categoryMargin)),attributeScore:median(rows.map(x=>x.attributeScore)),variantMargin:median(rows.map(x=>x.variantMargin)),method:'poi-cnn-multiview',viewSupport:supported.length,viewCount:views.length,attributeSupport:precise?rows.length:0};
 if(!precise){delete result.rawType;delete result.attribute;const types=[...new Set(rawTypes)].map(describePOI).filter(x=>x.type===result.type);result.label=(types[0]?.label.split(' · ')[0]||result.label)+(types.some(x=>x.attribute)?'（属性未定）':'');}
 return result;
}
function inferLandmark(cv,net,crop){
 let blob,b,c;
 try{blob=cv.blobFromImage(crop,1/255,new cv.Size(64,64),new cv.Scalar(),false,false);net.setInput(blob);b=net.forward('base_logits');c=net.forward('corner_logits');if(b.data32F.length!==15||c.data32F.length!==12)throw Error('识别模型输出格式不符');return {base:Array.from(b.data32F),corner:Array.from(c.data32F)};}
 finally{blob?.delete();b?.delete();c?.delete();}
}
function landmarkCrop(cv,standard,cx,cy,side){
 const left=Math.round(cx-side/2),top=Math.round(cy-side/2),x=Math.max(0,left),y=Math.max(0,top),right=Math.min(standard.cols,left+side),bottom=Math.min(standard.rows,top+side);
 if(right<=x||bottom<=y)return null;
 const roi=standard.roi(new cv.Rect(x,y,right-x,bottom-y)),crop=new cv.Mat();
 try{cv.copyMakeBorder(roi,crop,y-top,top+side-bottom,x-left,left+side-right,cv.BORDER_CONSTANT,new cv.Scalar());return crop;}finally{roi.delete();}
}
function visibleEmptyLandmark(cv,standard,reference,point,views,rawTypes){
 if(!reference)return null;
 const types=[...new Set(rawTypes)].map(describePOI);
 if(!types.some(t=>t.type!=='empty')||types.some(t=>!Object.hasOwn(CLASS_GROUPS,t.type)))return null;
 const confidence=views.map(v=>softmax(v.base)[0]).filter(score=>score>=.92);if(confidence.length<2)return null;
 const cx=Math.round(point.x*.75),cy=Math.round(point.y*.75);
 // Verify the actual terrain texture, not merely the absence of a recognized
 // icon. Hidden underground areas, black margins and overlays must stay unknown.
 if(cx<32||cy<32||cx+32>750||cy+32>750)return null;
 const sample=standard.roi(new cv.Rect(cx-32,cy-32,64,64)),template=reference.roi(new cv.Rect(cx-20,cy-20,40,40)),gray=new cv.Mat(),scores=new cv.Mat(),mean=new cv.Mat(),std=new cv.Mat();
 try{
  cv.meanStdDev(template,mean,std);if(std.data64F[0]<9)return null;
  cv.cvtColor(sample,gray,cv.COLOR_RGB2GRAY);cv.matchTemplate(gray,template,scores,cv.TM_CCOEFF_NORMED);const match=cv.minMaxLoc(scores);
  const offset={x:match.maxLoc.x-12,y:match.maxLoc.y-12};
  if(Math.hypot(offset.x,offset.y)>6)return null;
  // Nearby graces and player markers may cover the outer patch. Verify two
  // textured INNER patches at the same displacement instead of lowering NCC.
  const inner=[];
  for(const side of [20,24]){
   const half=side/2,area=gray.roi(new cv.Rect(32-half-4,32-half-4,side+8,side+8)),core=reference.roi(new cv.Rect(cx-half,cy-half,side,side)),values=new cv.Mat(),m=new cv.Mat(),s=new cv.Mat();
   try{cv.meanStdDev(core,m,s);if(s.data64F[0]<9)break;cv.matchTemplate(area,core,values,cv.TM_CCOEFF_NORMED);const found=cv.minMaxLoc(values);inner.push({side,score:found.maxVal,x:found.maxLoc.x-4,y:found.maxLoc.y-4});}
   finally{area.delete();core.delete();values.delete();m.delete();s.delete();}
  }
  const verifiedCenter=confidence.length>=4&&inner.length===2&&inner[0].score>=.85&&inner[1].score>=.8&&match.maxVal>=.6&&inner.every(p=>Math.hypot(p.x,p.y)<=3&&Math.hypot(p.x-offset.x,p.y-offset.y)<=2)&&Math.hypot(inner[0].x-inner[1].x,inner[0].y-inner[1].y)<=2;
  if(match.maxVal<.8&&!verifiedCenter)return null;
  const backgroundScore=match.maxVal>=.8?match.maxVal:Math.sqrt(inner[0].score*inner[1].score);
  return {id:point.id,type:'empty',label:'此处无建筑',score:median(confidence)*backgroundScore,source:'auto',method:'visible-empty-terrain',backgroundScore,viewSupport:confidence.length,viewCount:views.length,...(verifiedCenter?{verifiedCenter:true,backgroundChecks:{context:match.maxVal,inner:inner[0].score,center:inner[1].score}}:{})};
 }finally{sample.delete();template.delete();gray.delete();scores.delete();mean.delete();std.delete();}
}
/** Read all visible point patches locally; yield between small inference groups. */
export async function classifyLandmarks(cv,net,aligned,points,patterns,onProgress,options={}){
 if(!points.length)return [];
 const allocated=[],keep=item=>{allocated.push(item);return item;};
 try{
  const rgb=keep(new cv.Mat());if(aligned.channels()===4)cv.cvtColor(aligned,rgb,cv.COLOR_RGBA2RGB);else if(aligned.channels()===1)cv.cvtColor(aligned,rgb,cv.COLOR_GRAY2RGB);else aligned.copyTo(rgb);
  const hollow=patterns.length&&patterns.every(p=>p.terrain==='Great Hollow');
  const standard=keep(new cv.Mat());cv.resize(rgb,standard,new cv.Size(750,750),0,0,cv.INTER_CUBIC);
  let background;
  if(hollow&&options.reference){const gray=keep(new cv.Mat()),ref=options.reference;if(ref.channels()===1)ref.copyTo(gray);else cv.cvtColor(ref,gray,ref.channels()===4?cv.COLOR_RGBA2GRAY:cv.COLOR_RGB2GRAY);background=keep(new cv.Mat());cv.resize(gray,background,new cv.Size(750,750),0,0,cv.INTER_CUBIC);}
  const result=[];
  for(let i=0;i<points.length;i++){
   const point=points[i],cx=Math.round(point.x*.75),cy=Math.round(point.y*.75),possible=patterns.flatMap(p=>p.pois.filter(q=>q.id===point.id).map(q=>q.rawType));
   const crop=landmarkCrop(cv,standard,cx,cy,64);if(!crop)continue;
   let primary;try{primary=inferLandmark(cv,net,crop);}finally{crop.delete();}
   let item=decodeLandmark(primary.base,primary.corner,point,possible);
   if(hollow){
    const views=[primary];
    for(const side of [48,40,64])for(const [dx,dy]of [[0,0],[-12,0],[12,0],[0,-12],[0,12]]){
     if(side===64&&dx===0&&dy===0)continue;
     // A crop must stay closest to its own slot, never borrow a nearby icon.
     const center={x:(cx+dx)/.75,y:(cy+dy)/.75},distance=Math.hypot(center.x-point.x,center.y-point.y);
     if(points.some(q=>q.id!==point.id&&Math.hypot(center.x-q.x,center.y-q.y)<distance))continue;
     const sample=landmarkCrop(cv,standard,cx+dx,cy+dy,side);if(!sample)continue;
     const gray=new cv.Mat(),shape=new cv.Mat();
     try{const rgbView=inferLandmark(cv,net,sample);cv.cvtColor(sample,gray,cv.COLOR_RGB2GRAY);cv.cvtColor(gray,shape,cv.COLOR_GRAY2RGB);views.push({...rgbView,grayBase:inferLandmark(cv,net,shape).base});}
     finally{sample.delete();gray.delete();shape.delete();}
    }
    item=mergeLandmarkViews(views,point,possible)||visibleEmptyLandmark(cv,standard,background,point,views,possible);
    if(item&&item.type!=='empty'&&options.badges?.length){
     const proof=matchLandmarkBadge(cv,aligned,point,item.type,options.badges);
     if(proof&&possible.includes(proof.rawType)){
      if(!item.rawType||item.rawType===proof.rawType){const descriptor=describePOI(proof.rawType);item={...item,rawType:descriptor.rawType,attribute:descriptor.attribute,label:descriptor.label,attributeVerification:proof};}
      else{delete item.rawType;delete item.attribute;item.score=item.categoryScore*.85;item.label=item.label.split(' · ')[0]+'（属性冲突）';item.attributeConflict=true;}
     }
    }
   }
   if(item)result.push(item);
   if(hollow||i%6===0){onProgress?.(`${hollow?'正在多尺度核对':'正在自动读取'}据点和属性 ${i+1} / ${points.length}…`);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return result;
 }finally{for(const item of allocated.reverse())try{item.delete();}catch{}}
}
