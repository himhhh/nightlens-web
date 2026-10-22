import {describePOI} from './poi_catalog.js';
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
/** Read all visible point patches locally; yield between small inference groups. */
export async function classifyLandmarks(cv,net,aligned,points,patterns,onProgress){
 if(!points.length)return [];
 const allocated=[],keep=item=>{allocated.push(item);return item;};
 try{
  const rgb=keep(new cv.Mat());if(aligned.channels()===4)cv.cvtColor(aligned,rgb,cv.COLOR_RGBA2RGB);else if(aligned.channels()===1)cv.cvtColor(aligned,rgb,cv.COLOR_GRAY2RGB);else aligned.copyTo(rgb);
  const standard=keep(new cv.Mat());cv.resize(rgb,standard,new cv.Size(750,750),0,0,cv.INTER_CUBIC);
  const result=[];
  for(let i=0;i<points.length;i++){
   const point=points[i],cx=Math.round(point.x*.75),cy=Math.round(point.y*.75),left=cx-32,top=cy-32;
   const x=Math.max(0,left),y=Math.max(0,top),right=Math.min(750,left+64),bottom=Math.min(750,top+64);
   if(right<=x||bottom<=y)continue;
   const roi=standard.roi(new cv.Rect(x,y,right-x,bottom-y)),crop=new cv.Mat();let blob,b,c;
   try{
    cv.copyMakeBorder(roi,crop,y-top,top+64-bottom,x-left,left+64-right,cv.BORDER_CONSTANT,new cv.Scalar());
    blob=cv.blobFromImage(crop,1/255,new cv.Size(64,64),new cv.Scalar(),false,false);net.setInput(blob);
    b=net.forward('base_logits');c=net.forward('corner_logits');
    if(b.data32F.length!==15||c.data32F.length!==12)throw Error('识别模型输出格式不符');
    const possible=patterns.flatMap(p=>p.pois.filter(q=>q.id===point.id).map(q=>q.rawType));
    const item=decodeLandmark(b.data32F,c.data32F,point,possible);if(item)result.push(item);
   }finally{roi.delete();crop.delete();blob?.delete();b?.delete();c?.delete();}
   if(i%6===0){onProgress?.(`正在自动读取据点和属性 ${i+1} / ${points.length}…`);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return result;
 }finally{for(const item of allocated.reverse())try{item.delete();}catch{}}
}
