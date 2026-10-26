import {skillCardHTML,skillCarrierHTML} from './skill_catalog.js';
import {WEAPON_ELEMENTS} from './weapon_catalog.js';
import {escapeHTML as esc} from './ui_helpers.js';
const ELEMENTS=['magic','fire','lightning','holy'];
const RARITIES=new Set(['Rare','Legendary']);
function isWeak(stage,key){
 if(stage.specials?.some(s=>s.key===key))return true;
 const available=stage.ratings.filter(r=>ELEMENTS.includes(r.key)&&Number.isFinite(r.negation)),value=available.find(r=>r.key===key)?.negation;
 return Number.isFinite(value)&&value===Math.min(...available.map(r=>r.negation));
}
export function recommendSkills(data,weapons,ratings,specials=[],stages){
 const candidates=[];
 for(const skill of data?.skills||[]){
  if(skill.category!=='offense')continue;
  const carriers=skill.availability.filter(a=>a.kind!=='preset').flatMap(a=>{
   const w=weapons?.weapons.find(w=>w.id===a.weaponId);if(!w)return [];
   const variantIds=w.variants.filter(v=>a.variantIds.includes(v.id)&&RARITIES.has(v.rarity)).map(v=>v.id);
   return variantIds.length?[{...a,variantIds}]:[];
  });
  if(!carriers.length)continue;
  const special=(skill.statusEffects||[]).some(key=>specials.some(s=>s.key===key));
  const profiles=skill.profiles||[{label:'',elements:skill.damageElements||[]}];
  for(const profile of profiles){
   const values=profile.elements.map(key=>ratings.find(r=>r.key===key)?.negation);
   if(values.some(v=>!Number.isFinite(v))||!values.length&&!special)continue;
   const negation=values.length?Math.max(...values):null;
   const coverage=stages?stages.filter(stage=>profile.elements.length?profile.elements.every(key=>isWeak(stage,key)):(skill.statusEffects||[]).some(key=>stage.specials?.some(s=>s.key===key))).length:undefined;
   candidates.push({skill,profile,negation,special,coverage,common:stages?coverage===stages.length:undefined,carriers});
  }
 }
 candidates.sort((a,b)=>Number(!!b.common)-Number(!!a.common)||Number(b.special)-Number(a.special)||(a.negation??0)-(b.negation??0)||(b.coverage||0)-(a.coverage||0)||(a.skill.fpCosts.activate??Infinity)-(b.skill.fpCosts.activate??Infinity)||a.skill.id-b.skill.id);
 const seen=new Set();return candidates.filter(c=>{const key=c.skill.nameEn;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3);
}
export function recommendedSkillsHTML(recommendations,weapons){
 return recommendations.map(c=>'<div class="recommended-skill">'+skillCardHTML(c.skill,weapons)+'<p class="recommend-match">'+(c.profile.label?esc(c.profile.label)+' · ':'')+esc(c.special?'含本战特化克制属性':c.profile.elements.map(k=>WEAPON_ELEMENTS[k]||k).join('／'))+(c.negation!=null?' · 减伤参考 '+c.negation+'%':'')+(c.coverage!=null?' · '+(c.common?'三场共同弱项':c.coverage+'/3 场相对弱项'):'')+'</p><p class="data-note">可在以下紫／金武器变体上出现：</p><div class="skill-recommended-carriers">'+c.carriers.slice(0,3).map(a=>skillCarrierHTML(a,weapons,{compact:true})).join('')+'</div></div>').join('');
}
