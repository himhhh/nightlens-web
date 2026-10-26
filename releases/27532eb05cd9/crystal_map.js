import { filterCrystalGroups } from './crystals.js';

/** Percentages of the square surface map. The inset is a separate map layer. */
export const CRYSTAL_COMPOSITE=Object.freeze({
 background:'assets/maps/great-hollow-top-crop.webp',
 inset:Object.freeze({
  x:58,y:58,width:40,height:40,
  image:'assets/maps/great-hollow-bot-crop.webp',
  label:'地下',
 }),
});

/** Project display coordinates only; preserve the source identity and layer. */
export function projectCrystalPoint(point){
 if(!['top','bottom'].includes(point.zone)||![point.x,point.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)){
  throw new RangeError('水晶坐标或图层无效');
 }
 if(point.zone==='top')return {...point};
 const {x,y,width,height}=CRYSTAL_COMPOSITE.inset;
 return {...point,x:x+point.x*width/100,y:y+point.y*height/100};
}

// Percent-to-percent registration of the public crystal crops to our bundled
// 1536px full layout background, which already includes the underground area.
// See docs/verification/crystal-layout-registration.json for asset hashes and fit.
const LAYOUT_REGISTRATION=Object.freeze({
 top:[.6065734669,.0000218804,19.4414533066,-.0000218804,.6065734669,20.8512675418],
 bottom:[.2819452452,-.0000221437,66.1162471624,.0000221437,.2819452452,68.8674547420],
});
function projectLayoutPoint(point){
 projectCrystalPoint(point); // Validate the source coordinates and layer.
 const [a,b,c,d,e,f]=LAYOUT_REGISTRATION[point.zone];
 return {...point,x:a*point.x+b*point.y+c,y:d*point.x+e*point.y+f};
}

/** All markers share one display plane; filtering still uses original IDs. */
export function createCrystalMapView(data,observations={},{layout=false}={}){
 const groups=filterCrystalGroups(data.groups,observations);
 const possible=new Set(groups.flatMap(group=>group.crystalIds));
 return {
  ...(layout?{background:'assets/maps/great-hollow.webp',inset:null}:CRYSTAL_COMPOSITE),
  groups,
  points:data.points.map(point=>({
   ...(layout?projectLayoutPoint(point):projectCrystalPoint(point)),
   observation:observations[point.id],
   possible:possible.has(point.id),
  })),
 };
}
