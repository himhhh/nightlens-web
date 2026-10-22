import {CATEGORY_NAMES} from './poi_catalog.js';
/** Deterministic inference shared by the UI and automated acceptance tests. */
export const POI_TYPES = ['church', 'mage', 'village', 'greatchurch', 'fort', 'ruins', 'camp', 'marsh', 'forge', 'wuf', 'euf', 'merchant', 'empty', 'other'];
export const TERRAIN_NAMES = {'Default':'宁姆韦福','Mountaintop':'山顶','Crater':'火山口','Rotted Woods':'腐败森林','Noklateo':'隐城','Great Hollow':'大空洞'};
export const isSingleFormNightlord=id=>['Heolstor','Straghess'].includes(id);
export const NIGHTLORD_NAMES = {Gladius:'格拉狄乌斯 · 黑夜野兽',Adel:'艾德雷 · 黑夜之爵',Gnoster:'格诺斯塔 · 黑夜之智',Maris:'玛丽斯 · 深海黑夜',Libra:'利普拉 · 黑夜之魔',Fulghor:'弗格尔 · 黑夜光骑士',Caligo:'卡莉果 · 黑夜雾霾',Heolstor:'布德奇冥 · 黑夜王',Harmonia:'哈尔莫妮亚 · 安定者',Straghess:'史柴格斯 · 废弃物之王'};
export const TYPE_NAMES = {...CATEGORY_NAMES,unknown:'未确认'};

export function resolveNightlordFilter({autoNightlord=true,manualNightlord='',detection=null}={}){
 return autoNightlord?(NIGHTLORD_NAMES[detection?.id]?detection.id:''):(NIGHTLORD_NAMES[manualNightlord]?manualNightlord:'');
}

export function normalizeObservations(observations) {
 const byId = new Map();
 for (const observation of observations) {
  if (!Number.isInteger(observation.id) || !POI_TYPES.includes(observation.type)) continue;
  if (observation.source !== 'manual' && (!Number.isFinite(observation.score) || observation.score < .58)) continue;
  const old = byId.get(observation.id);
  if (old?.source === 'manual' && observation.source !== 'manual') continue;
  byId.set(observation.id, {...observation});
 }
 return [...byId.values()];
}
export function pointType(pattern, id) { return pattern.pois.find(p=>p.id===id)?.type || 'other'; }
export function filterPatterns(patterns, filters={}, observations=[]) {
 const evidence=normalizeObservations(observations);
 const manual=evidence.filter(o=>o.source==='manual');
 const automatic=evidence.filter(o=>o.source!=='manual');
 return patterns.filter(p=>(!filters.terrain||p.terrain===filters.terrain)&&(!filters.nightlord||p.nightlord===filters.nightlord)&&(!filters.spawn||p.spawn===filters.spawn)&&manual.every(o=>pointType(p,o.id)===o.type&&(!o.rawType||p.pois.find(point=>point.id===o.id)?.rawType===o.rawType))).map(p=>{
  const support=automatic.reduce((sum,o)=>{
   const q=p.pois.find(q=>q.id===o.id),same=q?.type===o.type;
   const precise=!!o.rawType;
   return sum+(same?(precise?(q.rawType===o.rawType?1.5:-.65):.7):-.85)*o.score;
  },0);
  const matches=automatic.filter(o=>{const q=p.pois.find(q=>q.id===o.id);return q?.type===o.type&&(!o.rawType||q.rawType===o.rawType);}).length;
  return {...p,rankScore:support,autoMatches:matches,autoCompared:automatic.length};
 }).sort((a,b)=>b.rankScore-a.rankScore||a.id-b.id);
}
export function summarizeEvidence(candidates, observations) {
 const evidence=normalizeObservations(observations),manual=evidence.filter(o=>o.source==='manual');
 if (!evidence.length) return {state:'no-evidence',manualCount:0,autoCount:0};
 if (!candidates.length) return {state:'conflict',manualCount:manual.length,autoCount:evidence.length-manual.length};
 const base={manualCount:manual.length,autoCount:evidence.length-manual.length};
 if(candidates.length===1&&manual.length>=2)return {state:'confirmed',...base};
 const automatic=evidence.filter(o=>o.source!=='manual'),strong=automatic.filter(o=>o.score>=.68);
 if(automatic.length>=4&&strong.length>=3){
  const first=candidates[0],second=candidates[1],margin=second?first.rankScore-second.rankScore:Infinity;
  const matchFraction=(first.autoMatches||0)/automatic.length;
  const matches=(pattern,o)=>{const q=pattern.pois.find(q=>q.id===o.id);return q?.type===o.type&&(!o.rawType||q.rawType===o.rawType);};
  const rivals=candidates.slice(1).map(pattern=>({id:pattern.id,margin:first.rankScore-pattern.rankScore,distinguishing:strong.filter(o=>matches(first,o)&&!matches(pattern,o)).length}));
  const blockers=rivals.filter(r=>r.margin<2||r.distinguishing<2);
  const distinguishing=rivals.length?Math.min(...rivals.map(r=>r.distinguishing)):strong.length;
  if(matchFraction>=.75&&(first.autoMatches||0)>=4&&!blockers.length)return {state:'recognized',patternId:first.id,margin,matched:first.autoMatches,distinguishing,...base};
  return {state:'ambiguous',margin,matched:first.autoMatches||0,alternativeIds:blockers.map(r=>r.id),...base};
 }
 return {state:'review',...base};
}
export function recommendPoint(patterns, observations=[]) {
 if (patterns.length<2) return null;
 const manual=new Map(normalizeObservations(observations).filter(o=>o.source==='manual').map(o=>[o.id,o]));
 const ids=new Set(patterns.flatMap(p=>p.pois.map(o=>o.id))); let best=null;
 for (const id of ids) {
  const observed=manual.get(id);if(observed&&(observed.rawType||new Set(patterns.map(p=>p.pois.find(point=>point.id===id)?.rawType).filter(Boolean)).size<2))continue;
  const counts={};for(const p of patterns){const type=p.pois.find(point=>point.id===id)?.rawType||pointType(p,id);counts[type]=(counts[type]||0)+1;}
  const entropy=Object.values(counts).reduce((sum,n)=>{const p=n/patterns.length;return sum-p*Math.log2(p);},0);
  if(entropy>.001&&(!best||entropy>best.entropy))best={id,entropy,counts,point:patterns.flatMap(p=>p.pois).find(p=>p.id===id)};
 }
 return best;
}
export function validateQuad(points, minimumArea=.002) {
 if(points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
 const turns=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
 if(!turns.every(x=>x>1e-9)&&!turns.every(x=>x< -1e-9))return false;
 const area=Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%4];return s+p.x*q.y-p.y*q.x;},0))/2;
 return area>minimumArea;
}
export function projectPoint(h,p) {
 const d=h[6]*p.x+h[7]*p.y+h[8];if(!Number.isFinite(d)||Math.abs(d)<1e-10)throw Error('无法投影此点');
 return {x:(h[0]*p.x+h[1]*p.y+h[2])/d,y:(h[3]*p.x+h[4]*p.y+h[5])/d};
}
export function homographyFromPoints(from,to) {
 if(!validateQuad(from)||!validateQuad(to))throw Error('请选择四个不交叉的对应点');
 const a=[];
 for(let i=0;i<4;i++){const {x,y}=from[i],u=to[i].x,v=to[i].y;a.push([x,y,1,0,0,0,-u*x,-u*y,u]);a.push([0,0,0,x,y,1,-v*x,-v*y,v]);}
 for(let c=0;c<8;c++){
  let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;
  if(Math.abs(a[pivot][c])<1e-10)throw Error('对应点过于接近，请重新选择');
  [a[c],a[pivot]]=[a[pivot],a[c]];const scale=a[c][c];for(let j=c;j<=8;j++)a[c][j]/=scale;
  for(let r=0;r<8;r++)if(r!==c){const factor=a[r][c];for(let j=c;j<=8;j++)a[r][j]-=factor*a[c][j];}
 }
 return [...a.map(r=>r[8]),1];
}
