import {CATEGORY_NAMES,describePOI} from './poi_catalog.js';
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
function verifiedBadge(observation){
 const proof=observation.attributeVerification,actual=describePOI(observation.rawType);
 return !!proof&&!!actual.attribute&&actual.type===observation.type&&actual.attribute===observation.attribute&&proof.rawType===observation.rawType&&proof.attribute===observation.attribute&&proof.method==='public-badge-shape-color'&&proof.score>=.65&&proof.shapeScore>=.55&&proof.colorScore>=.65&&proof.margin>=.1&&observation.categoryScore>=.8&&observation.categoryMargin>=.2;
}
function stableAttributeDifference(observation, rival) {
 const actual=describePOI(observation.rawType),other=rival.pois.find(p=>p.id===observation.id),expected=describePOI(other?.rawType);
 // Crop votes check stability; they are correlated views of one landmark,
 // never extra independent landmarks or calibrated correctness probabilities.
 const sameBuilding=!!actual.attribute&&actual.attribute===observation.attribute&&actual.type===observation.type&&other?.type===observation.type&&expected.type===actual.type&&!!expected.attribute&&expected.attribute!==actual.attribute;
 const stableCrops=observation.method==='poi-cnn-multiview'&&observation.score>=.8&&observation.categoryScore>=.9&&observation.categoryMargin>=.5&&observation.attributeScore>=.9&&observation.variantMargin>=.5&&
  Number.isInteger(observation.viewCount)&&Number.isInteger(observation.viewSupport)&&Number.isInteger(observation.attributeSupport)&&
  observation.viewSupport<=observation.viewCount&&observation.attributeSupport<=observation.viewSupport&&observation.attributeSupport>=4&&observation.attributeSupport/observation.viewSupport>=.75;
 return sameBuilding&&(stableCrops||verifiedBadge(observation));
}
function stableEmptyDifference(observation,rival){
 const checks=observation.backgroundChecks,other=rival.pois.find(p=>p.id===observation.id);
 return observation.type==='empty'&&observation.method==='visible-empty-terrain'&&observation.verifiedCenter===true&&observation.score>=.75&&observation.viewSupport>=4&&observation.viewSupport<=observation.viewCount&&checks?.context>=.6&&checks.inner>=.85&&checks.center>=.8&&!!other&&other.type!=='empty'&&other.type!=='other';
}
export function summarizeEvidence(candidates, observations) {
 const evidence=normalizeObservations(observations),manual=evidence.filter(o=>o.source==='manual');
 if (!evidence.length) return {state:'no-evidence',manualCount:0,autoCount:0};
 if (!candidates.length) return {state:'conflict',manualCount:manual.length,autoCount:evidence.length-manual.length};
 const base={manualCount:manual.length,autoCount:evidence.length-manual.length};
 if(candidates.length===1&&manual.length>=2)return {state:'confirmed',...base};
 const automatic=evidence.filter(o=>o.source!=='manual'),strong=automatic.filter(o=>o.score>=.68||verifiedBadge(o));
 if(automatic.length>=4&&strong.filter(o=>o.type!=='empty').length>=3){
  const first=candidates[0],second=candidates[1],margin=second?first.rankScore-second.rankScore:Infinity;
  const matchFraction=(first.autoMatches||0)/automatic.length;
  const matches=(pattern,o)=>{const q=pattern.pois.find(q=>q.id===o.id);return q?.type===o.type&&(!o.rawType||q.rawType===o.rawType);};
  const rivals=candidates.slice(1).map(pattern=>{
   const differences=strong.filter(o=>matches(first,o)&&!matches(pattern,o)),margin=first.rankScore-pattern.rankScore;
   // A sole elemental difference can decide a layout only when every observed
   // point agrees with it and four OTHER real buildings corroborate both rivals.
   const diagnostic=(first.autoMatches===automatic.length)&&differences.length===1&&(stableAttributeDifference(differences[0],pattern)||stableEmptyDifference(differences[0],pattern))&&strong.filter(o=>o.id!==differences[0].id&&o.type!=='empty'&&matches(first,o)&&matches(pattern,o)).length>=4;
   return {id:pattern.id,margin,distinguishing:differences.length,decisivePoint:diagnostic?differences[0].id:null,emptyProof:diagnostic&&differences[0].type==='empty',accepted:(margin>=2&&differences.length>=2)||diagnostic};
  });
  const blockers=rivals.filter(r=>!r.accepted);
  const distinguishing=rivals.length?Math.min(...rivals.map(r=>r.distinguishing)):strong.length;
  const decisivePointIds=[...new Set(rivals.filter(r=>r.decisivePoint!==null).map(r=>r.decisivePoint))];
  if(matchFraction>=.75&&(first.autoMatches||0)>=4&&!blockers.length)return {state:'recognized',patternId:first.id,margin,matched:first.autoMatches,distinguishing,...(decisivePointIds.length?{confirmation:rivals.some(r=>r.emptyProof)?'verified-landmark':'stable-attribute',decisivePointIds}:{}),...base};
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
export function selectVisibleCandidates(candidates,decision){
 if(decision.state==='recognized')return candidates.slice(0,1);
 if(decision.state==='ambiguous'&&Array.isArray(decision.alternativeIds)){
  const remaining=new Set(decision.alternativeIds);return candidates.filter((p,i)=>i===0||remaining.has(p.id));
 }
 return candidates;
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
