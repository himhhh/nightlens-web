import {escapeHTML as esc,damageIcon,sourceLink} from './ui_helpers.js';
import {weaponScalingHTML} from './weapon_scaling.js';
export const WEAPON_ELEMENTS={standard:'物理',strike:'打击',slash:'斩击',pierce:'突刺',magic:'魔力',fire:'火焰',lightning:'雷电',holy:'神圣',poison:'毒',scarletRot:'腐败',bleed:'出血',frostbite:'冻伤',sleep:'睡眠',madness:'发狂'};
const ATTRS={STR:'力量',DEX:'灵巧',INT:'智力',FAI:'信仰',ARC:'感应'};
const RARITY={Common:'普通',Uncommon:'优良',Rare:'稀有',Legendary:'传说'};
const norm=x=>String(x??'').normalize('NFKC').trim().toLowerCase();
export function weaponElements(v){return [...new Set([...Object.entries(v.attack||{}).filter(([k,n])=>k!=='standard'&&n>0).map(([k])=>k),...(v.attribute?[v.attribute]:[]),...(v.extraAttributes||[])])];}
export function getWeapon(data,id){const exact=(data?.weapons||[]).find(w=>w.variants.some(v=>v.id===Number(id)));return exact?{weapon:exact,variant:exact.variants.find(v=>v.id===Number(id))}:null;}
export function filterWeapons(data,{query='',type='',element='',limit=48}={}){
 const terms=norm(query).split(/\s+/).filter(Boolean);const all=data?.weapons||[];
 const items=all.filter(w=>(!type||w.type===type)&&terms.every(t=>norm([w.nameZh,w.nameEn,...(w.aliases||[]),...w.variants.map(v=>v.nameZh)].join(' ')).includes(t))&&(!element||w.variants.some(v=>weaponElements(v).includes(element)||(v.attack?.standard>0&&v.physicalStyle===element))));
 return{items:items.slice(0,limit),count:items.length,total:all.length};
}
const symbol=type=>type.includes('Shield')?'◈':type.includes('Staff')||type==='Sacred Seal'?'✧':type.includes('bow')||type.includes('Bow')?'⌁':'⚔';
export function weaponCardHTML(w,variant=w.variants[0]){
 const tags=weaponElements(variant);
 const image=w.image?'<img class="equipment-card-image" src="'+esc(w.image)+'" alt="'+esc(w.nameZh)+'图标" loading="lazy" width="64" height="64">':'<span class="weapon-symbol" aria-hidden="true">'+symbol(w.type)+'</span>';
 return '<button class="weapon-card" data-weapon-id="'+variant.id+'">'+image+'<span><strong>'+esc(variant.nameZh)+'</strong><small>'+esc(w.typeZh)+' · '+esc(RARITY[variant.rarity]||'资料收录')+' · 等级 '+variant.requiredLevel+'</small><span class="weapon-tags">'+(tags.length?tags.map(k=>'<i>'+esc(WEAPON_ELEMENTS[k]||k)+'</i>').join(''):'<i>物理</i>')+(w.blessing?'<i>庇佑</i>':'')+'</span></span><span class="weapon-arrow">↗</span></button>';
}
export function renderWeaponCatalog(data,options={}){const r=filterWeapons(data,options);return{...r,html:r.items.length?r.items.map(w=>weaponCardHTML(w,w.variants.find(v=>options.element&&weaponElements(v).includes(options.element))||w.variants[0])).join(''):'<p class="empty-state">没有找到对应武器，试试其他名称或属性。</p>'};}
function valuesHTML(values,names,icons=false){return '<div class="resistance-grid">'+Object.entries(names).map(([k,label])=>'<div class="resistance-cell"><span>'+(icons?damageIcon(k):'')+label+'</span><strong>'+esc(Number.isFinite(values?.[k])?values[k]:'未知')+'</strong></div>').join('')+'</div>';}
export function weaponDetailsHTML(data,id,options={}){
 const found=getWeapon(data,id);if(!found)return '<p>尚未收录该武器。</p>';const{weapon:w,variant:v}=found;
 return '<div class="eyebrow">ARMAMENT GUIDE</div><div class="equipment-detail-heading">'+(w.image?'<img class="equipment-detail-image" src="'+esc(w.image)+'" alt="'+esc(w.nameZh)+'图标" width="112" height="112">':'')+'<div><h2>'+esc(v.nameZh)+'</h2><p class="micro">'+esc(v.nameEn)+' · '+esc(w.typeZh)+'</p></div></div><div class="weapon-detail-meta"><span>'+esc(RARITY[v.rarity]||'稀有度待核')+'</span><span>最低使用等级 '+v.requiredLevel+'</span></div>'+(w.variants.length>1?'<label class="variant-label">属性变体<select id="weapon-variant-select" aria-label="武器属性变体">'+w.variants.map(x=>'<option value="'+x.id+'" '+(x.id===v.id?'selected':'')+'>'+esc(x.nameZh)+'</option>').join('')+'</select></label>':'')+
 '<h3 class="guide-subtitle">基础攻击力</h3>'+valuesHTML(v.attack,{standard:'物理',magic:'魔力',fire:'火焰',lightning:'雷电',holy:'神圣'},true)+'<p class="data-note">尚未计入角色能力补正、遗物与随机词条，不能直接当作实战面板。</p><h3 class="guide-subtitle">能力补正倾向</h3>'+valuesHTML(v.scaling,ATTRS)+'<p class="data-note">数值为资料表的补正系数，用于比较倾向；不是装备需求或最终增伤百分比。</p>'+
 weaponScalingHTML(w,v,options)+'<h3 class="guide-subtitle">战斗特性</h3><p class="data-note">处决倍率 '+esc(v.criticalMultiplier??'未知')+' · 基础削韧 '+esc(v.poiseDamage??'未知')+' · 救援积累 '+esc(v.reviveDamage??'未知')+'</p><p>战技：'+(v.skill?.random?'可随机出现战技':esc(v.skill?.nameZh||v.skill?.nameEn||'尚未收录'))+'</p>'+(weaponElements(v).length?'<p>属性特性：'+weaponElements(v).map(k=>esc(WEAPON_ELEMENTS[k]||k)).join('、')+'</p>':'')+
 (w.type.includes('Shield')?'<h3 class="guide-subtitle">防御时减伤（%）</h3>'+valuesHTML(v.guard,{standard:'物理',magic:'魔力',fire:'火焰',lightning:'雷电',holy:'神圣'},true)+'<p>防御强度 '+esc(v.guardStability)+'</p>':'')+
 (w.blessing?'<section class="weapon-blessing"><h3>'+esc(w.blessing['特效'])+'</h3><p>'+esc(w.blessing['描述'])+'</p>'+(w.blessing['削韧']&&w.blessing['削韧']!=='-'?'<p class="data-note">削韧参考：'+esc(w.blessing['削韧'])+'</p>':'')+'</section>':'')+
 '<p class="data-note">武器来自随机掉落、商店或特殊奖励；本页不保证本局固定获取地点。动作、战技和法术可能采用不同伤害属性。</p><div class="boss-sources">'+data.sources.filter(s=>w.sourceIds.includes(s.id)).map(sourceLink).join(' · ')+'</div>';
}
