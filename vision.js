import {projectPoint, validateQuad, homographyFromPoints, TERRAIN_NAMES} from './core.js';
import {classifyLandmarks,loadNetFromBytes} from './poi_cnn.js';
import {matchNightlord,loadNightlordTemplates} from './nightlord.js';
import {assetRetryURL,imageRetryDelay} from './image_recovery.js';
let runtimePromise;
const imageCache=new Map();
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
export function loadOpenCV(){
 if(runtimePromise)return runtimePromise;
 runtimePromise=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('识别引擎初始化超时，请重试。手动点位筛选仍可使用。')),60000);
  const script=document.createElement('script');script.src='vendor/opencv.js';
  script.onload=async()=>{try{const cv=await Promise.resolve(window.cv);if(!cv?.Mat)throw Error('识别引擎未能启动');clearTimeout(timer);resolve(cv);}catch(e){clearTimeout(timer);reject(e);}};
  script.onerror=()=>{clearTimeout(timer);reject(Error('无法载入离线识别引擎，请刷新后重试'));};
  document.head.appendChild(script);
 }).catch(e=>{runtimePromise=null;throw e;});
 return runtimePromise;
}
export function loadImage(url){
 const create=()=>new Promise((resolve,reject)=>{
  const im=new Image();let attempt=0;im.onload=()=>resolve(im);
  im.onerror=()=>{const retry=attempt<2&&assetRetryURL(url,attempt+1);if(retry){attempt++;setTimeout(()=>im.src=retry,imageRetryDelay(attempt));return;}imageCache.delete(url);reject(Error('地图资源未载入：'+url));};im.src=url;
 });
 // Camera originals can be much larger than working canvases; never retain them.
 if(url.startsWith('blob:')||url.startsWith('data:'))return create();
 if(!imageCache.has(url))imageCache.set(url,create());
 return imageCache.get(url);
}
export function mapPath(terrain){return 'assets/maps/'+({'Default':'default.jpg','Mountaintop':'mountaintop.jpg','Crater':'crater.jpg','Rotted Woods':'rotted-woods.jpg','Noklateo':'noklateo.jpg','Great Hollow':'great-hollow.webp'}[terrain]||'default.jpg');}
export function imageCanvas(image,maxSide=1500){
 const canvas=document.createElement('canvas'),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 if(!w||!h)throw Error('照片没有有效尺寸');const scale=Math.min(1,maxSide/Math.max(w,h));
 canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;
}
function grayMat(cv,source){const dst=new cv.Mat();if(source.channels()===1)source.copyTo(dst);else cv.cvtColor(source,dst,source.channels()===4?cv.COLOR_RGBA2GRAY:cv.COLOR_RGB2GRAY);return dst;}
function hullArea(points){
 if(points.length<3)return 0;const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 const lo=[],hi=[];for(const p of sorted){while(lo.length>=2&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(const p of sorted.slice().reverse()){while(hi.length>=2&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}const hull=[...lo.slice(0,-1),...hi.slice(0,-1)];return Math.abs(hull.reduce((sum,p,i)=>{const q=hull[(i+1)%hull.length];return sum+p.x*q.y-p.y*q.x;},0))/2;
}
/** ORB/Hamming/RANSAC only establishes geometry, never a map pattern ID. */
export function estimateAlignment(cv,photo,reference){
 const allocated=[];const keep=o=>{allocated.push(o);return o;};
 try{
  if(Math.min(photo.cols,photo.rows)<200)return {ok:false,reason:'照片分辨率太低，请让完整地图占据更多画面'};
  const src=keep(grayMat(cv,photo)),dst=keep(grayMat(cv,reference));
  const statsMean=keep(new cv.Mat()),statsStd=keep(new cv.Mat());cv.meanStdDev(src,statsMean,statsStd);
  if(statsStd.data64F[0]<9)return {ok:false,reason:'画面缺少清晰的地图纹理，请重新拍摄'};
  const orb=keep(new cv.ORB(2600,1.2,8,23,0,2,0,23,12));
  const aKeys=keep(new cv.KeyPointVector()),bKeys=keep(new cv.KeyPointVector()),aDesc=keep(new cv.Mat()),bDesc=keep(new cv.Mat()),empty=keep(new cv.Mat());
  orb.detectAndCompute(src,empty,aKeys,aDesc);orb.detectAndCompute(dst,empty,bKeys,bDesc);
  if(aDesc.rows<20||bDesc.rows<20)return {ok:false,reason:'可辨认地标不足，请避开反光并拍清地图'};
  const matcher=keep(new cv.BFMatcher(cv.NORM_HAMMING,false)),knn=keep(new cv.DMatchVectorVector());matcher.knnMatch(aDesc,bDesc,knn,2);
  const sourcePoints=[],destPoints=[];
  for(let i=0;i<knn.size();i++){
   const pair=knn.get(i);
   try{if(pair.size()<2)continue;const m=pair.get(0),n=pair.get(1);if(m.distance<.76*n.distance&&m.distance<72){const p=aKeys.get(m.queryIdx).pt,q=bKeys.get(m.trainIdx).pt;sourcePoints.push(p.x,p.y);destPoints.push(q.x,q.y);}}
   finally{pair.delete();}
  }
  if(sourcePoints.length<36)return {ok:false,reason:'自动对齐证据不足，可以使用四点手动对齐',matches:sourcePoints.length/2};
  const a=keep(cv.matFromArray(sourcePoints.length/2,1,cv.CV_32FC2,sourcePoints)),b=keep(cv.matFromArray(destPoints.length/2,1,cv.CV_32FC2,destPoints)),mask=keep(new cv.Mat());
  const h=keep(cv.findHomography(a,b,cv.RANSAC,4,mask,2500,.995));
  if(h.empty())return {ok:false,reason:'地图变形无法可靠校正，请手动对齐'};
  const matrix=Array.from(h.data64F);if(matrix.length!==9||matrix.some(x=>!Number.isFinite(x)))return {ok:false,reason:'地图对齐失败，请手动校正'};
  let inliers=0,error=0;const inlierPoints=[];
  for(let i=0;i<mask.rows;i++)if(mask.data[i]){inliers++;const p={x:sourcePoints[2*i],y:sourcePoints[2*i+1]},q={x:destPoints[2*i],y:destPoints[2*i+1]},v=projectPoint(matrix,p);error+=Math.hypot(v.x-q.x,v.y-q.y);inlierPoints.push(q);}
  const coverage=hullArea(inlierPoints)/(reference.cols*reference.rows),ratio=inliers/(sourcePoints.length/2);
  if(inliers<18||ratio<.27||coverage<.035||error/Math.max(inliers,1)>4)return {ok:false,reason:'有效地标分布过于集中，请拍摄完整地图或手动对齐',inliers,coverage};
  const inverse=keep(new cv.Mat());cv.invert(h,inverse);
  const quad=[{x:0,y:0},{x:reference.cols,y:0},{x:reference.cols,y:reference.rows},{x:0,y:reference.rows}].map(p=>projectPoint(Array.from(inverse.data64F),p));
  if(!validateQuad(quad)||quad.some(p=>p.x< -photo.cols*.35||p.x>photo.cols*1.35||p.y< -photo.rows*.35||p.y>photo.rows*1.35))return {ok:false,reason:'地图边缘不完整或对齐不稳定，请拍摄完整地图或手动对齐'};
  return {ok:true,matrix,inliers,matches:sourcePoints.length/2,coverage,meanError:error/inliers};
 }catch(error){return {ok:false,reason:'无法自动对齐，可使用四点校正后继续',debug:String(error)};}
 finally{for(const item of allocated.reverse())try{item.delete();}catch{/* release remaining objects */}}
}
let modelPromise;
async function localModel(cv){
 if(!modelPromise)modelPromise=(async()=>{const response=await fetch('assets/models/poi-cnn.onnx');if(!response.ok)throw Error('本地据点识别模型未载入');return loadNetFromBytes(cv,new Uint8Array(await response.arrayBuffer()));})().catch(error=>{modelPromise=null;throw error;});
 return modelPromise;
}
export async function recognizePhoto(photoCanvas,terrain,slots,onProgress,manual,options={}){
 onProgress?.('正在启动本机识别引擎…');const cv=await loadOpenCV();await pause();
 const photo=cv.imread(photoCanvas);let warped,h;
 try{
  const mapTypes=terrain&&terrain!=='Auto'?[terrain]:Object.keys(TERRAIN_NAMES),alignments=[];
  for(let i=0;i<mapTypes.length;i++){
   const name=mapTypes[i];onProgress?.(`正在自动判断地图 ${i+1} / ${mapTypes.length}…`);await pause();
   const image=await loadImage(mapPath(name)),canvas=document.createElement('canvas');canvas.width=canvas.height=1000;canvas.getContext('2d').drawImage(image,0,0,1000,1000);
   const reference=cv.imread(canvas);let result;try{result=manual?{ok:true,matrix:homographyFromPoints(manual.from,manual.to),manual:true}:estimateAlignment(cv,photo,reference);}finally{reference.delete();}
   if(result.ok){const quality=result.manual?100000:result.inliers*Math.pow(result.inliers/Math.max(result.matches,1),1.3)*Math.sqrt(result.coverage);alignments.push({...result,terrain:name,quality});}
  }
  alignments.sort((a,b)=>b.quality-a.quality);const alignment=alignments[0];
  if(!alignment)return {ok:false,reason:'没有找到足够清晰的地图地标，请拍摄完整地图并避开反光'};
  h=cv.matFromArray(3,3,cv.CV_64F,alignment.matrix);warped=new cv.Mat();cv.warpPerspective(photo,warped,h,new cv.Size(1000,1000),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar());
  const alignedCanvas=document.createElement('canvas');cv.imshow(alignedCanvas,warped);
  const pool=(options.patterns||[]).filter(p=>p.terrain===alignment.terrain);
  const points=pool.length?[...new Map(pool.flatMap(p=>p.pois).map(p=>[p.id,p])).values()]:slots;
  if(!pool.length)throw Error('缺少当前地图的据点分类数据');
  onProgress?.('正在读取左下角夜王头像…');await pause();
  let nightlord;try{nightlord=matchNightlord(cv,warped,await loadNightlordTemplates(cv));}catch(error){nightlord={id:null,method:'portrait-template',reason:'夜王图标资源无法读取：'+error.message};}
  const net=await localModel(cv),observations=await classifyLandmarks(cv,net,warped,points,pool,onProgress);
  return {...alignment,observations,nightlord,alignedCanvas,engine:'local-poi-cnn',mapCandidates:alignments.map(a=>({terrain:a.terrain,inliers:a.inliers,quality:a.quality}))};
 }finally{photo.delete();warped?.delete();h?.delete();}
}
export function isLocalIconMatch(location,roiOrigin,width,height,point){return Math.hypot(roiOrigin.x+location.x+width/2-point.x,roiOrigin.y+location.y+height/2-point.y)<=20;}
