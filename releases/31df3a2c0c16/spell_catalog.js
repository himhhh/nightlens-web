import {escapeHTML as esc,sourceLink} from './ui_helpers.js';
import {WEAPON_ELEMENTS} from './weapon_catalog.js';
export const SPELL_EFFECTS={...WEAPON_ELEMENTS,healing:'回复',support:'强化／辅助'};
const KINDS={sorcery:'魔法',incantation:'祷告'};
const normalize=x=>String(x??'').normalize('NFKC').trim().toLowerCase();
export function filterSpells(data,{query='',kind='',element='',limit=48}={}){
 const terms=normalize(query).split(/\s+/).filter(Boolean),all=data?.spells||[];
 const result=all.filter(s=>(!kind||s.kind===kind)&&(!element||s.elements.includes(element))&&terms.every(t=>normalize([s.nameZh,s.nameEn,s.school,...(s.aliases||[])].join(' ')).includes(t)));
 return {items:result.slice(0,limit),count:result.length,total:all.length};
}
function tagsHTML(spell){return '<span class="weapon-tags">'+spell.elements.map(k=>'<i>'+esc(SPELL_EFFECTS[k]||k)+'</i>').join('')+'</span>';}
export function spellCardHTML(spell){
 return '<button type="button" class="weapon-card spell-card" data-spell-id="'+spell.id+'"><img class="equipment-card-image" src="'+esc(spell.image)+'" alt="'+esc(spell.nameZh)+'图标" loading="lazy" width="64" height="64"><span><strong>'+esc(spell.nameZh)+'</strong><small>'+esc(KINDS[spell.kind])+' · 专注值 '+spell.fpCost+' · 精力 '+spell.staminaCost+'</small>'+tagsHTML(spell)+'</span><span class="weapon-arrow" aria-hidden="true">↗</span></button>';
}
export function renderSpellCatalog(data,options={}){const result=filterSpells(data,options);return {...result,html:result.items.length?result.items.map(spellCardHTML).join(''):'<p class="empty-state">没有找到对应魔法或祷告，试试其他名称或筛选条件。</p>'};}
export function spellDetailsHTML(data,id,weapons){
 const spell=data?.spells.find(s=>s.id===Number(id));if(!spell)return '<p>尚未收录该法术。</p>';
 const weaponIds=new Set(spell.availability.weaponIds),casters=(weapons?.weapons||[]).filter(w=>weaponIds.has(w.id));
 const cell=(name,value)=>'<div class="resistance-cell"><span>'+name+'</span><strong>'+value+'</strong></div>';
 return '<div class="eyebrow">SPELL GUIDE</div><div class="equipment-detail-heading"><img class="equipment-detail-image" src="'+esc(spell.image)+'" alt="'+esc(spell.nameZh)+'图标" width="112" height="112"><div><h2>'+esc(spell.nameZh)+'</h2><p class="micro">'+esc(spell.nameEn)+'</p><p class="data-note">'+esc(KINDS[spell.kind])+(spell.school?' · '+esc(spell.school):'')+'</p></div></div>'+tagsHTML(spell)+'<p class="spell-effect-description">'+esc(spell.summary)+'</p><h3 class="guide-subtitle">施放消耗</h3><div class="resistance-grid">'+cell('专注值',spell.fpCost)+cell('精力',spell.staminaCost)+'</div>'+((spell.fpAdditional||spell.staminaAdditional)?'<details class="spell-extra-cost"><summary>追加阶段消耗参考</summary><div class="resistance-grid">'+cell('追加阶段专注值',spell.fpAdditional)+cell('追加阶段精力',spell.staminaAdditional)+'</div><p class="data-note">连续施放、蓄力等动作可能使用追加阶段参数，不与基础消耗直接相加。</p></details>':'')+'<p class="data-note">效果属性用于筛选；回复、强化与附魔不代表该法术直接造成相应属性的伤害。消耗采用 Nightreign 1.03.2 社区参数，未计入遗物、词条与临时效果。</p><h3 class="guide-subtitle">对应施法武器</h3><p class="data-note">以下武器的法术表中包含此法术；武器附带法术随机出现，不保证每一把都有。点击查看武器详情。</p><div class="spell-caster-links">'+casters.map(w=>'<button class="spell-caster-link" data-weapon-id="'+w.variants[0].id+'"><img src="'+esc(w.image)+'" alt="" loading="lazy" width="36" height="36"><span>'+esc(w.nameZh)+'</span><span aria-hidden="true">↗</span></button>').join('')+'</div><div class="boss-sources">'+data.sources.filter(s=>spell.sourceIds.includes(s.id)&&s.id!=='bwiki').map(sourceLink).join(' · ')+' · '+sourceLink(spell.textSource)+'</div>';
}
