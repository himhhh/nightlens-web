import {isSingleFormNightlord} from './core.js';
import {getBossCombat} from './boss_combat.js';
import {bossLinkHTML} from './boss_ui.js';
import {escapeHTML as esc} from './ui_helpers.js';
import {WEAPON_ELEMENTS,weaponElements,weaponCardHTML} from './weapon_catalog.js';
import {spellCardHTML} from './spell_catalog.js';
import {recommendSkills,recommendedSkillsHTML} from './skill_recommendations.js';
const ELEMENTS=['magic','fire','lightning','holy'];const PHYSICAL=['standard','strike','slash','pierce'];
const RANGED_TYPES=new Set(['Bow','Greatbow','Crossbow','Ballista']);
// Nightreign's official tiers: Rare is purple; Legendary is gold.
const RECOMMENDED_RARITIES=new Set(['Rare','Legendary']);
const KINDS=[['melee','近战'],['ranged','远程'],['sorcery','魔法'],['incantation','祷告'],['staff','法杖'],['seal','圣印记'],['skill','战技']];
const empty=()=>({choices:[],weapons:[],melee:[],ranged:[],sorceries:[],incantations:[],casters:[],staffs:[],seals:[],skills:[]});
function damageRatings(bodies){
 return [...PHYSICAL,...ELEMENTS].flatMap(key=>{
  const vals=bodies.map(b=>b.damageNegation?.[key]);
  return vals.length&&vals.every(Number.isFinite)?[{key,negation:Math.max(...vals)}]:[];
 });
}
function stageWeakness(stage,key){
 if(stage.specials.some(s=>s.key===key))return true;
 const pool=stage.ratings.filter(r=>(ELEMENTS.includes(key)?ELEMENTS:PHYSICAL).includes(r.key));
 const value=stage.ratings.find(r=>r.key===key)?.negation;
 return Number.isFinite(value)&&value===Math.min(...pool.map(r=>r.negation));
}
function spellRecommendations(spells,weapons,ratings,specials,stages){
 const candidates=(spells?.spells||[]).filter(s=>!s.elements.some(e=>['support','healing'].includes(e))).flatMap(spell=>{
  const damage=spell.elements.filter(e=>[...ELEMENTS,...PHYSICAL].includes(e));
  // Unknown components cannot silently become zero resistance. Mixed damage uses the more resisted component.
  const values=damage.map(e=>ratings.find(r=>r.key===e)?.negation);
  if(values.some(v=>!Number.isFinite(v)))return [];
  const special=spell.elements.some(e=>specials.some(s=>s.key===e));
  if(!values.length&&!special)return [];
  const coverage=stages?stages.filter(stage=>damage.length?damage.every(key=>stageWeakness(stage,key)):spell.elements.some(key=>stage.specials.some(s=>s.key===key))).length:undefined;
  return [{spell,negation:values.length?Math.max(...values):null,special,coverage,common:stages?coverage===stages.length:undefined}];
 });
 candidates.sort((a,b)=>Number(!!b.common)-Number(!!a.common)||Number(b.special)-Number(a.special)||(a.negation??0)-(b.negation??0)||a.spell.fpCost-b.spell.fpCost||a.spell.id-b.spell.id);
 const sorceries=candidates.filter(c=>c.spell.kind==='sorcery').slice(0,3),incantations=candidates.filter(c=>c.spell.kind==='incantation').slice(0,3);
 const casters=[];
 for(const [kind,type] of [['sorcery','Glintstone Staff'],['incantation','Sacred Seal']]){
  const selected=kind==='sorcery'?sorceries:incantations;
  const tools=(weapons?.weapons||[]).filter(w=>w.type===type).flatMap(w=>{
   const matched=selected.map(c=>c.spell).filter(s=>s.availability?.weaponIds.includes(w.id));
   const variants=w.variants.filter(v=>RECOMMENDED_RARITIES.has(v.rarity));
   if(!matched.length||!variants.length)return [];
   // The base physical attack and scaling are not a spell-damage ranking.
   const v=[...variants].sort((a,b)=>a.requiredLevel-b.requiredLevel||a.id-b.id)[0];
   return [{w,v,spells:matched}];
  });
  tools.sort((a,b)=>b.spells.length-a.spells.length||a.v.requiredLevel-b.v.requiredLevel||a.w.id-b.w.id);
  casters.push(...tools.slice(0,2));
 }
 return {sorceries,incantations,casters,staffs:casters.filter(c=>c.w.type==='Glintstone Staff'),seals:casters.filter(c=>c.w.type==='Sacred Seal')};
}
function specialWeaknesses(combat,keys,bodies,ratings){
 const rawKey=Array.isArray(keys)?keys[0]:keys,everdark=String(rawKey).endsWith('_everdark'),identity=String(rawKey).replace(/_everdark$/,'');const profile=combat.specialNightlordWeaknesses?.[identity];
 const specials=(profile?.attributes||[]).filter(key=>!everdark||!ELEMENTS.includes(key)&&bodies.every(b=>Number.isFinite(b.statusResistance?.[key]))).map(key=>({key,negation:ratings.find(r=>r.key===key)?.negation??null,special:true,label:everdark?'可触发异常':'特化克制'}));
 return {specials,specialNote:profile&&specials.length?(everdark?'仅依据当前永夜形态的异常阈值推荐，不沿用普通形态的特殊机制。':profile.note):''};
}
function equipmentRecommendations(weapons,ratings,specials,choices,{spells,skills,legendaryWeight=3,stages}={}){
 const candidates=(weapons?.weapons||[]).filter(w=>!['Shield','Staff','Seal'].some(x=>w.type.includes(x))&&(!w.type.includes('Torch')||choices.some(c=>c.key==='sleep'))).flatMap(w=>w.variants.filter(v=>RECOMMENDED_RARITIES.has(v.rarity)).map(v=>{
  const tags=weaponElements(v),matches=c=>ELEMENTS.includes(c.key)?(v.attack?.[c.key]||0)>0:PHYSICAL.includes(c.key)?v.attack?.standard>0&&v.physicalStyle===c.key:tags.includes(c.key);
  let matched=choices.filter(matches),fallback=false;
  if(!matched.length&&RANGED_TYPES.has(w.type)){matched=ratings.filter(matches);fallback=true;}
  if(!matched.length)return null;
  const elem=matched.filter(c=>ELEMENTS.includes(c.key));const bestNeg=Math.min(...matched.map(c=>c.negation??0));
  const priority=stages?Math.max(...matched.map(c=>c.common?400:100)):fallback?-100:(matched.some(c=>c.special)?300:elem.length?100:0);
  const bestMatch=stages||RANGED_TYPES.has(w.type)?[...matched].sort((a,b)=>Number(!!b.common)-Number(!!a.common)||(a.negation??0)-(b.negation??0))[0]:undefined;
  const match=bestMatch?{...bestMatch,scope:stages?'overall':'single'}:undefined;
  return{w,v,score:priority-bestNeg*2-(v.requiredLevel||1)*.4+(w.blessing?legendaryWeight:0),tags,match};
 }).filter(Boolean));
 candidates.sort((a,b)=>b.score-a.score||a.v.requiredLevel-b.v.requiredLevel||a.v.id-b.v.id);
 const select=pool=>{
  const seen=new Set(),types=new Set(),selected=[];
  for(const c of pool){if(seen.has(c.w.id)||types.has(c.w.type))continue;seen.add(c.w.id);types.add(c.w.type);selected.push(c);if(selected.length===3)break;}
  return selected;
 };
 // Select within each category before truncating, so melee cannot crowd bows out of the list.
 return{weapons:select(candidates),melee:select(candidates.filter(c=>!RANGED_TYPES.has(c.w.type))),ranged:select(candidates.filter(c=>RANGED_TYPES.has(c.w.type))),...spellRecommendations(spells,weapons,ratings,specials,stages),skills:recommendSkills(skills,weapons,ratings,specials,stages)};
}
export function recommendForBoss(combat,weapons,keys,{context,legendaryWeight=3,spells,skills}={}){
 const bodies=[...new Map((Array.isArray(keys)?keys:[keys]).flatMap(k=>getBossCombat(combat,k,{context})).map(b=>[b.id,b])).values()];
 if(!bodies.length||bodies.some(b=>b.gameData==='unknown'||b.incompleteGroup))return{bodies,...empty(),reason:'首领资料不完整，暂不自动推荐属性。'};
 const ratings=damageRatings(bodies),{specials,specialNote}=specialWeaknesses(combat,keys,bodies,ratings);
 const best=keys=>{const pool=ratings.filter(r=>keys.includes(r.key)),min=Math.min(...pool.map(r=>r.negation));return pool.filter(r=>r.negation===min).slice(0,2);};
 const choices=[...specials,...[...best(ELEMENTS),...best(PHYSICAL)].sort((a,b)=>a.negation-b.negation)].filter((c,i,all)=>all.findIndex(x=>x.key===c.key)===i).slice(0,3);
 return {bodies,choices,...equipmentRecommendations(weapons,ratings,specials,choices,{spells,skills,legendaryWeight}),specialNote,contextUnmatched:bodies.some(b=>b.contextMatched===false)};
}
function expeditionStages(pattern,form){
 return [{id:'night1',label:'第一夜',key:pattern.night1Boss,context:'night'},{id:'night2',label:'第二夜',key:pattern.night2Boss,context:'night'},{id:'final',label:'最终夜王',key:form==='everdark'?pattern.nightlord+'_everdark':pattern.nightlord}];
}
export function recommendForExpedition(pattern,combat,weapons,{form='unknown',spells,skills}={}){
 if(isSingleFormNightlord(pattern.nightlord))form='normal';
 if(form==='unknown')return {...empty(),reason:'最终夜王形态尚未识别，暂不生成整局推荐；可先查看第一夜、第二夜。'};
 const stages=expeditionStages(pattern,form).map(stage=>{
  const bodies=getBossCombat(combat,stage.key,{context:stage.context}),ratings=damageRatings(bodies);
  return {...stage,bodies,ratings,...specialWeaknesses(combat,stage.key,bodies,ratings)};
 });
 const missing=stages.filter(s=>!s.bodies.length||s.bodies.some(b=>b.gameData==='unknown'||b.incompleteGroup));
 if(missing.length)return {...empty(),reason:missing.map(s=>s.label).join('、')+'资料不完整，暂不生成整局推荐。'};
 // Count each battle once, even when a battle has multiple bodies or phases.
 const ratings=[...PHYSICAL,...ELEMENTS].flatMap(key=>{
  const byStage=stages.map(s=>s.ratings.find(r=>r.key===key)?.negation);
  if(!byStage.every(Number.isFinite))return [];
  const coverage=stages.filter(s=>stageWeakness(s,key)).length;
  return [{key,negation:Math.max(...byStage),average:byStage.reduce((a,b)=>a+b,0)/stages.length,byStage,coverage,common:coverage===stages.length}];
 });
 const rank=(a,b)=>Number(b.common)-Number(a.common)||a.negation-b.negation||a.average-b.average||b.coverage-a.coverage;
 const choose=(keys,count)=>ratings.filter(r=>keys.includes(r.key)).sort(rank).slice(0,count);
 // Only a special weakness shared by all three battles is promoted as a whole-run mechanic.
 const specials=stages[0].specials.filter(s=>stages.every(stage=>stage.specials.some(other=>other.key===s.key))).map(s=>({...s,common:true,coverage:stages.length,label:'三场共同克制'}));
 const choices=[...specials,...choose(ELEMENTS,2),...choose(PHYSICAL,1)].filter((c,i,all)=>all.findIndex(x=>x.key===c.key)===i).map(c=>({...c,label:c.label||(c.common?'三场共同弱项':'兼顾三场')}));
 return {stages,choices,...equipmentRecommendations(weapons,ratings,specials,choices,{spells,skills,stages}),contextUnmatched:stages.some(s=>s.bodies.some(b=>b.contextMatched===false))};
}
function overallMatchHTML(match){
 return match?'<p class="recommend-match">对应 '+esc(WEAPON_ELEMENTS[match.key])+' · '+(match.scope==='single'?(match.negation!=null?'减伤参考 '+match.negation+'%':'特化克制'):match.common?'三场共同弱项':match.coverage+'/3 场相对弱项；整局兼顾参考')+'</p>':'';
}
function recommendedCards(r,kind,weapons){
 if(kind==='skill')return recommendedSkillsHTML(r.skills||[],weapons);
 if(kind==='melee'||kind==='ranged')return r[kind].map(c=>weaponCardHTML(c.w,c.v)+overallMatchHTML(c.match)).join('');
 if(kind==='staff'||kind==='seal')return r[kind==='staff'?'staffs':'seals'].map(c=>'<div class="recommended-caster">'+weaponCardHTML(c.w,c.v)+'<p class="data-note">法术表可出现：</p><div class="recommended-spell-links">'+c.spells.map(s=>'<button type="button" data-spell-id="'+s.id+'">'+esc(s.nameZh)+'</button>').join('')+'</div></div>').join('');
 const items=kind==='sorcery'?r.sorceries:r.incantations;
 return items.map(c=>'<div>'+spellCardHTML(c.spell)+'<p class="recommend-match">'+esc(c.special?'含本战特化克制属性':c.spell.elements.filter(e=>[...ELEMENTS,...PHYSICAL].includes(e)).map(e=>WEAPON_ELEMENTS[e]).join('／'))+(c.negation!=null?' · 减伤参考 '+c.negation+'%':'')+(c.coverage!=null?' · '+(c.common?'三场共同弱项':c.coverage+'/3 场相对弱项'):'')+'</p></div>').join('');
}
function overallSummaryHTML(r,combat,getName,pattern,form){
 if(!r.stages)return '';
 const bosses='<div class="overall-bosses">'+r.stages.map(s=>'<div><span>'+s.label+'</span>'+bossLinkHTML(combat,s.key,s.id==='final'?getName(pattern.nightlord)+(form==='everdark'?' · 永夜王':''):getName(s.key),{context:s.context})+'</div>').join('')+'</div>';
 const rows=r.choices.filter(c=>c.byStage).map(c=>'<tr><th scope="row">'+esc(WEAPON_ELEMENTS[c.key])+'</th>'+c.byStage.map((value,i)=>'<td'+(stageWeakness(r.stages[i],c.key)?' class="overall-weak"':'')+'>'+value+'%</td>').join('')+'</tr>').join('');
 return bosses+(rows?'<table class="overall-resistance"><caption>各场减伤对照 · 越低越适合，亮色为该场相对弱项</caption><thead><tr><th scope="col">属性</th>'+r.stages.map(s=>'<th scope="col">'+s.label+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>':'');
}
export function recommendationsHTML(pattern,combat,weapons,{form='unknown',stage='overall',kind='melee',spells,skills,getName=x=>x}={}){
 if(kind==='weapon')kind='melee';
 if(kind==='caster')kind='staff';
 if(isSingleFormNightlord(pattern.nightlord))form='normal';
 const defs=[{id:'overall',label:'整局推荐'},...expeditionStages(pattern,form)];
 return '<section class="weapon-recommendations"><div class="section-heading"><h2>武器推荐</h2></div><p class="data-note">武器品质：仅紫色（稀有）／金色（传说），含弓弩与法器。</p><div class="recommend-tabs" role="tablist" aria-label="战斗阶段">'+defs.map(d=>'<button data-plan-stage="'+d.id+'" aria-selected="'+(stage===d.id)+'">'+d.label+'</button>').join('')+'</div><div class="recommend-kinds" role="group" aria-label="推荐类别">'+KINDS.map(([id,label])=>'<button type="button" data-plan-kind="'+id+'" aria-pressed="'+(kind===id)+'">'+label+'</button>').join('')+'</div>'+defs.map(d=>{
  const overall=d.id==='overall',ready=(!overall&&d.id!=='final')||form!=='unknown';const r=overall?recommendForExpedition(pattern,combat,weapons,{form,spells,skills}):ready?recommendForBoss(combat,weapons,d.key,{spells,skills,context:d.context,legendaryWeight:d.id==='final'?10:0}):{...empty(),reason:'照片未确认夜王形态，暂不推断最终战抗性。'};
  const intro=overall?overallSummaryHTML(r,combat,getName,pattern,form):ready?bossLinkHTML(combat,d.key,d.id==='final'?(getName(pattern.nightlord)+(form==='everdark'?' · 永夜王':'')):getName(d.key),{context:d.context}):'';
  return '<article data-plan-panel="'+d.id+'" '+(stage!==d.id?'hidden':'')+'>'+intro+(r.choices.length?'<div class="recommended-elements">'+r.choices.map(c=>'<span>'+esc(WEAPON_ELEMENTS[c.key])+' <small>'+esc(c.label||(c.negation!=null?'减伤 '+c.negation+'%':''))+'</small></span>').join('')+'</div><p class="data-note">'+(overall?'优先找三场共同弱项；没有共同弱项时，按最难应对的一场兼顾选择。每场组合首领取较耐受成员，不把单场特化弱点当作整局通用。':esc(r.specialNote||'')+' 优先寻找上述属性；组合首领按较耐受的成员取值。')+(r.contextUnmatched?'部分场景参数待核，当前为基础参考。':'')+'</p>':'<p class="data-note">'+esc(r.reason||'尚无足够数据，不套用普通形态。')+'</p>')+KINDS.map(([id,label])=>{const cards=recommendedCards(r,id,weapons);return '<div data-plan-kind-panel="'+id+'" '+(kind!==id?'hidden':'')+'>'+cards+(!cards&&ready&&r.choices.length?'<p class="data-note">暂无可核验的'+label+'匹配结果。</p>':'')+'</div>';}).join('')+'</article>';
 }).join('')+'<p class="data-note">各类别按相对较低减伤与特化克制选取示例，不代表最高伤害排行；魔法与祷告分别比较，可能与上方首选属性不同。混合伤害取较高减伤参考。治疗、强化和附魔未列入输出推荐。</p><p class="data-note">法杖、圣印记的附带法术随机出现，拾取时请检查实际法术；这里按法术表匹配，未用法器的物理攻击力推算施法伤害。仍需结合角色补正、等级、消耗与词条选择。</p><p class="data-note">战技推荐按战技自身的已知效果匹配，并列出可出现的紫／金武器。随机战技不保证拾取时附带；武器追击、附魔与特定条件可能改变实际伤害。</p></section>';
}
