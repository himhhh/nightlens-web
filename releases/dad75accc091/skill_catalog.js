import {escapeHTML as esc,sourceLink} from './ui_helpers.js';
import {WEAPON_ELEMENTS} from './weapon_catalog.js';
export const SKILL_CATEGORIES={offense:'输出',support:'强化／辅助',defense:'防御／反击',mobility:'位移',other:'其他／属性待核'};
const KINDS={fixed:'固定自带',random:'随机可出现',preset:'特定配置可出现'};
const normalize=value=>String(value??'').normalize('NFKC').trim().toLowerCase();
export function skillEffects(skill){return [...new Set([...(skill.damageElements||[]),...(skill.statusEffects||[])])];}
export function filterSkills(data,{query='',category='',element='',limit=48}={},weapons){
 const terms=normalize(query).split(/\s+/).filter(Boolean),index=new Map((weapons?.weapons||[]).map(w=>[w.id,w]));
 const result=(data?.skills||[]).filter(skill=>{
  if(category&&skill.category!==category||element&&!skillEffects(skill).includes(element))return false;
  const carriers=skill.availability.map(a=>index.get(a.weaponId)).filter(Boolean);
  const text=normalize([skill.nameZh,skill.nameEn,...carriers.flatMap(w=>[w.nameZh,w.nameEn,w.typeZh]),...skillEffects(skill).map(k=>WEAPON_ELEMENTS[k])].join(' '));
  return terms.every(term=>text.includes(term));
 });
 return {items:result.slice(0,limit),count:result.length,total:(data?.skills||[]).length};
}
function skillImage(skill,weapons){
 if(skill.image)return skill.image;
 const carrier=skill.availability.find(a=>a.kind==='fixed')||skill.availability[0];return weapons?.weapons.find(w=>w.id===carrier?.weaponId)?.image;
}
function tagsHTML(skill){const tags=skillEffects(skill);return '<span class="weapon-tags">'+tags.map(key=>'<i>'+esc(WEAPON_ELEMENTS[key]||key)+'</i>').join('')+'</span>';}
export function skillCardHTML(skill,weapons){
 const image=skillImage(skill,weapons),label=skill.nameZh||skill.nameEn,fp=skill.fpCosts.activate;
 return '<button type="button" class="weapon-card skill-card" data-skill-id="'+skill.id+'">'+(image?'<img class="equipment-card-image" src="'+esc(image)+'" alt="'+esc(label)+(skill.imageKind==='skill-icon'?'战灰图标':'对应武器图示')+'" loading="lazy" width="64" height="64">':'<svg aria-hidden="true"><use href="#i-target"/></svg>')+'<span><strong>'+esc(label)+'</strong><small>'+esc(SKILL_CATEGORIES[skill.category])+' · 专注值 '+(Number.isFinite(fp)?fp:'—')+'</small>'+tagsHTML(skill)+'</span><span class="weapon-arrow" aria-hidden="true">↗</span></button>';
}
export function renderSkillCatalog(data,options,weapons){const result=filterSkills(data,options,weapons);return {...result,html:result.items.length?result.items.map(s=>skillCardHTML(s,weapons)).join(''):'<p class="empty-state">没有找到对应战技，试试战技名、武器名或其他筛选条件。</p>'};}
export function skillCarrierHTML(carrier,weapons,{compact=false}={}){
 const weapon=weapons?.weapons.find(w=>w.id===carrier.weaponId);if(!weapon)return '';
 const variants=weapon.variants.filter(v=>carrier.variantIds.includes(v.id)),first=variants[0];if(!first)return '';
 return '<div class="skill-carrier"><button class="spell-caster-link" data-weapon-id="'+first.id+'"><img src="'+esc(weapon.image)+'" alt="" loading="lazy" width="36" height="36"><span>'+esc(weapon.nameZh)+'<small>'+esc(KINDS[carrier.kind])+' · '+variants.length+' 种变体</small></span><span aria-hidden="true">↗</span></button>'+(!compact&&variants.length>1?'<details class="skill-variant-list"><summary>查看对应属性变体</summary>'+variants.map(v=>'<button type="button" data-weapon-id="'+v.id+'">'+esc(v.nameZh)+'</button>').join('')+'</details>':'')+'</div>';
}
export function skillDetailsHTML(data,id,weapons){
 const skill=data?.skills.find(s=>s.id===Number(id));if(!skill)return '<p>尚未收录该战技。</p>';
 const image=skillImage(skill,weapons),label=skill.nameZh||skill.nameEn,costLabels={activate:'发动',lightFollowup:'轻攻击追击',heavyFollowup:'重攻击追击',other:'其他阶段'},costs=Object.entries(costLabels).filter(([key])=>Number.isFinite(skill.fpCosts[key]));
 const groups=Object.entries(KINDS).map(([kind,title])=>{const carriers=skill.availability.filter(a=>a.kind===kind);return carriers.length?'<details class="skill-availability" '+(kind!=='preset'?'open':'')+'><summary>'+title+' · '+new Set(carriers.map(a=>a.weaponId)).size+' 把武器</summary><div class="spell-caster-links">'+carriers.map(a=>skillCarrierHTML(a,weapons)).join('')+'</div></details>':'';}).join('');
 return '<div class="eyebrow">SKILL GUIDE</div><div class="equipment-detail-heading">'+(image?'<img class="equipment-detail-image" src="'+esc(image)+'" alt="'+esc(label)+'图示" width="112" height="112">':'')+'<div><h2>'+esc(label)+'</h2><p class="micro">'+esc(skill.nameEn)+'</p><p class="data-note">'+esc(SKILL_CATEGORIES[skill.category])+'</p></div></div>'+tagsHTML(skill)+(skill.imageKind==='weapon-reference'?'<p class="data-note">图示为对应武器。</p>':'')+(skill.summaryExcerpt?'<p class="spell-effect-description">'+esc(skill.summaryExcerpt)+'</p>':'')+'<h3 class="guide-subtitle">专注值消耗</h3><div class="resistance-grid">'+costs.map(([key,title])=>'<div class="resistance-cell"><span>'+title+'</span><strong>'+skill.fpCosts[key]+'</strong></div>').join('')+'</div><p class="data-note">各输入阶段分别列出，不直接相加；实际消耗可能受遗物和词条影响。</p><h3 class="guide-subtitle">可能出现在哪些武器上</h3><p class="data-note">'+esc(skill.availabilityNote)+'</p>'+groups+'<p class="data-note">对应武器与消耗采用《黑夜君临》参数。效果标签用于寻找属性，部分追击随武器变化，不代表伤害排行。</p><div class="boss-sources">'+data.sources.filter(s=>s.id==='nr-calculator').map(sourceLink).join(' · ')+' · '+sourceLink(skill.textSource)+'</div>';
}
export function weaponSkillLinksHTML(data,weaponId){
 const matches=(data?.skills||[]).filter(s=>s.availability.some(a=>a.variantIds.includes(Number(weaponId))));
 return matches.length?'<h3 class="guide-subtitle">此武器可出现的战技</h3><div class="recommended-spell-links">'+matches.map(s=>'<button type="button" data-skill-id="'+s.id+'">'+esc(s.nameZh||s.nameEn)+'</button>').join('')+'</div>':'';
}
