import {NIGHTLORD_NAMES} from './core.js';
import {getBossCombat,getBossEncounter,getCombatDataLabel,getCombatSources,getCombatVariantLabel,DAMAGE_TYPES,STATUS_TYPES,formatNegation,formatStatusResistance,scaleBossForPlayers} from './boss_combat.js';
import {escapeHTML as esc,sourceLink,DAMAGE_NAMES,damageIcon} from './ui_helpers.js';
function records(data,keys,options){const seen=new Set();return (Array.isArray(keys)?keys:[keys]).flatMap(key=>getBossCombat(data,key,options)).filter(b=>{if(seen.has(b.id))return false;seen.add(b.id);return true;});}
function weakKeys(boss){return (boss?.relativeWeaknesses||[]).filter(k=>DAMAGE_NAMES[k]);}
export function weaknessBadges(data,keys,options={}){return badgesForRecords(records(data,keys,options));}
function badgesForRecords(bosses){
 const labels={...DAMAGE_NAMES,poison:'中毒',scarletRot:'猩红腐败',bleed:'出血',frostbite:'冻伤',sleep:'睡眠',madness:'发狂'};const special=(bosses[0]?.specialWeakness?.attributes||[]).filter(k=>bosses.every(b=>b.specialWeakness?.attributes?.includes(k)));
 if(special.length)return '<span class="weakness-label">特化克制</span>'+special.map(k=>'<span class="weakness-badge">'+(DAMAGE_NAMES[k]?damageIcon(k):'')+esc(labels[k]||k)+'</span>').join('');
 if(!bosses.length||bosses.every(b=>b.gameData==='unknown'))return '<span class="weakness-missing">抗性资料待补</span>';
 if(bosses.some(b=>b.contextMatched===false))return '<span class="weakness-missing">场景待核 · 查看基础参考</span>';
 const common=weakKeys(bosses[0]).filter(k=>bosses.every(b=>weakKeys(b).includes(k)));
 if(common.length===8)return '<span class="weakness-missing">基础减伤相近</span>';
 return common.length?'<span class="weakness-label">基础相对弱项</span>'+common.map(k=>'<span class="weakness-badge">'+damageIcon(k)+esc(DAMAGE_NAMES[k])+'</span>').join(''):'<span class="weakness-missing">'+(bosses.length>1?'分别查看抗性':'查看抗性')+'</span>';
}
export function bossLinkHTML(data,keys,label,options={}){const all=Array.isArray(keys)?keys:[keys];return '<button class="boss-link" data-boss-keys="'+esc(JSON.stringify(all))+'" data-combat-context="'+esc(options.context||'')+'"><strong>'+esc(label||all.join('、'))+'</strong><span class="weakness-badges">'+weaknessBadges(data,all,options)+'</span><span class="boss-link-arrow" aria-hidden="true">↗</span></button>';}
function variantLabel(b,v){const short=getCombatVariantLabel(v);return (b.variants||[]).filter(item=>getCombatVariantLabel(item)===short).length>1?short+' · '+v.label:short;}
function statusSourceHTML(b){
 const evidence=b.statusEvidence;
 return evidence?'<p class="data-note status-source-note">异常数据：黑夜君临专用资料表补全；该表未单独注明异常字段的补丁版本。'+esc(evidence.note||'')+'</p>':'';
}
function statusReferenceHTML(b){
 const reference=b.statusReference;if(!reference)return '';
 const title=reference.game==='elden-ring'?'法环本体参考（非黑夜君临数值）':'其他场景参考';
 return '<details class="status-reference"><summary>'+esc(title)+' · '+esc(reference.label)+'</summary><p class="data-note">'+esc(reference.note)+'以下为来源场景基础值，不按当前人数换算。</p><div class="resistance-grid">'+STATUS_TYPES.map(({key,label})=>'<div class="resistance-cell"><span>'+esc(label)+'</span><strong>'+esc(formatStatusResistance(reference.statusResistance?.[key],{base:false}))+'</strong></div>').join('')+'</div></details>';
}
function combatCard(data,b,getName,players){
 const scaled=scaleBossForPlayers(data,b,players),number=value=>Number.isFinite(value)?Math.round(value).toLocaleString('zh-CN'):'未知';
 const sources=getCombatSources(data,{sourceIds:[...(b.sourceIds||[]),'quickref-players']}),variants=b.variants||[];
 const options=variants.length>1?'<label class="variant-label">参数场景<select data-boss-variant="'+esc(b.id)+'">'+variants.map(v=>'<option value="'+(v.variantKey??v.npcParamId)+'" '+((v.variantKey??v.npcParamId)===(b.variantKey??b.npcParamId)?'selected':'')+'>'+esc(variantLabel(b,v))+'</option>').join('')+'</select></label>':'';
 return '<article class="boss-combat-card" data-combat-card="'+esc(b.id)+'"><div class="boss-title-line"><div class="boss-title-identity"><h3>'+esc(b.nameZh||getName(b.nameEn))+'</h3><p class="micro boss-title-english">'+esc(b.nameEn)+'</p><span class="data-origin '+(b.gameData==='elden-ring'?'fallback':'')+'">'+esc(getCombatDataLabel(b))+'</span></div><label class="boss-player-picker"><span>出征人数</span><select data-boss-players aria-label="出征人数">'+[1,2,3].map(n=>'<option value="'+n+'" '+(n===scaled.players?'selected':'')+'>'+n+' 人</option>').join('')+'</select></label></div><div class="weakness-badges">'+badgesForRecords([b])+'</div>'+(b.specialWeakness?'<p class="data-note">'+esc(b.specialWeakness.note)+'</p>':'')+'<p class="data-note">参数场景：'+esc(b.variants?.length?variantLabel(b,b.variants.find(v=>(v.variantKey??v.npcParamId)===(b.variantKey??b.npcParamId))):'暂无可核验参数')+'。地点、阶段不同可能变化。</p>'+(b.contextMatched===false?'<p class="data-note context-unmatched">当前地点未找到独立参数，以下为已收录基础参考；请核对场景后使用。</p>':'')+options+'<div class="resistance-grid boss-vitals"><div class="resistance-cell"><span>生命值 · '+scaled.players+'人</span><strong>'+number(scaled.health)+'</strong></div><div class="resistance-cell"><span>韧性 · '+scaled.players+'人</span><strong>'+number(scaled.poise)+'</strong></div></div><h4>伤害减免</h4><div class="resistance-grid">'+DAMAGE_TYPES.map(({key,label})=>'<div class="resistance-cell"><span>'+damageIcon(key)+label+'</span><strong class="'+(Number.isFinite(b.damageNegation?.[key])&&b.damageNegation[key]<0?'vulnerable':'')+'">'+esc(formatNegation(b.damageNegation?.[key]))+'</strong></div>').join('')+'</div><p class="data-note">人数不改变上方基础减伤百分比。</p><h4>异常耐受阈值 · '+scaled.players+'人</h4>'+statusSourceHTML(b)+'<div class="resistance-grid">'+STATUS_TYPES.map(({key,label})=>'<div class="resistance-cell"><span>'+label+'</span><strong>'+esc(formatStatusResistance(scaled.statusResistance?.[key],{base:false}))+'</strong></div>').join('')+'</div><p class="data-note">基础首次阈值 × '+esc(scaled.resistanceMultiplier??'未知')+'（'+scaled.players+'人）。已按所选阶段/场景取值；未叠加深夜、额外临时特效与重复触发增长；免疫保持免疫。</p>'+statusReferenceHTML(b)+(b.notes||[]).filter(note=>!note.startsWith('当前代表参数：')).map(note=>'<p class="data-note">'+esc(note)+'</p>').join('')+'<div class="boss-sources">'+sources.map(sourceLink).filter(Boolean).join(' · ')+'</div></article>';
}
export function bossDetailsHTML(data,keys,getName=name=>name,variants={},options={}){
 const bosses=records(data,keys,options).map(b=>variants[b.id]?getBossCombat(data,b.id,{npcParamId:variants[b.id]}).find(item=>item.id===b.id)||b:b),requested=Array.isArray(keys)?keys:[keys];
 if(!bosses.length)return '<h2>'+esc(requested.map(getName).join('、'))+'</h2><p class="data-note">当前没有可核验的详细抗性数据，暂不显示数值。</p>';
 const branch=(Array.isArray(keys)?keys:[keys]).some(k=>getBossEncounter(data,k)?.memberMode==='branches');
 return '<div class="eyebrow">BOSS INTELLIGENCE</div><h2>弱点与抗性</h2><p class="data-note">减伤率越低，通常越适合对应攻击；负值表示额外承伤。异常阈值越高，越难触发。部分来源未注明游戏补丁版本。</p>'+(branch?'<p class="data-note">以下包含不同阶段或分支形态，并非全部同时出现。</p>':'')+bosses.map(b=>combatCard(data,b,getName,options.players||3)).join('');
}

export function finalNightlordHTML(pattern,data,{form='unknown',formSource}={}){
 const id=pattern?.nightlord,name=NIGHTLORD_NAMES[id];if(!name)return '<p>暂无最终首领记录。</p>';
 const mode=id==='Heolstor'?'normal':form,key=mode==='everdark'?id+'_everdark':id;
 const options=id==='Heolstor'?'':'<details class="expedition-form"><summary>'+(mode==='unknown'?'照片未识别形态 · 可补拍或手动修正':formSource==='portrait-color'?'已自动识别形态 · 识别有误？':'已选定形态 · 修改')+'</summary><div class="expedition-form-options"><button data-expedition-form="normal" aria-pressed="'+(mode==='normal')+'">普通夜王</button><button data-expedition-form="everdark" aria-pressed="'+(mode==='everdark')+'">永夜王</button></div></details>';
 const known=mode!=='unknown'&&getBossCombat(data,key).length;
 return options+'<section class="final-nightlord"><img src="assets/icons/nightlord-'+id+'.png" alt=""><div><span class="encounter-kind">最终 Boss · '+(mode==='everdark'?'永夜王':mode==='normal'?'普通夜王':'形态待识别')+'</span>'+(known?bossLinkHTML(data,key,name):'<strong>'+esc(name)+'</strong><p class="data-note">'+(mode==='unknown'?'头像配色不清晰，暂不推断形态抗性。可补拍包含左下角头像的照片。':'该永夜形态资料尚未收录，不套用普通形态。')+'</p>')+'</div></section>';
}
