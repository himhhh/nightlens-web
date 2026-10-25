import {escapeHTML as esc,sourceLink} from './ui_helpers.js';

const ATTRIBUTES={STR:'力量',DEX:'灵巧',INT:'智力',FAI:'信仰',ARC:'感应'};
const DAMAGE={standard:'物理',magic:'魔力',fire:'火焰',lightning:'雷电',holy:'神圣'};

function curveValue(points,value){
 if(!Array.isArray(points)||!points.length)return null;
 if(value<=points[0][0])return points[0][0]>0?points[0][1]*value/points[0][0]:points[0][1];
 for(let i=1;i<points.length;i++){
  const [left,a]=points[i-1],[right,b]=points[i];
  if(value<=right)return right===left?b:a+(b-a)*(value-left)/(right-left);
 }
 return points.at(-1)[1];
}

export function calculateWeaponScaling(variant,nightfarers,parameters,{character='Wylder',level=15}={}){
 const actor=nightfarers?.characters?.find(c=>c.id===character),selectedLevel=Number(level);
 if(!actor||!Number.isInteger(selectedLevel)||selectedLevel<1||selectedLevel>15)return null;
 const stats=actor.levels[selectedLevel],model=parameters?.weapons?.[variant.id];
 const correction=parameters?.elements?.[model?.elementCorrect],reinforce=parameters?.reinforce?.[model?.reinforceType];
 if(!stats||!model||!correction||!reinforce)return null;
 const attack={},contributions=Object.fromEntries(Object.keys(ATTRIBUTES).map(key=>[key,0]));let total=0;
 for(const damage of Object.keys(DAMAGE)){
  const rawBase=model.attack[damage]??0;
  if(!Number.isFinite(rawBase))return null;
  const base=rawBase*(reinforce.attack[damage]??1);let bonus=0;
  if(base>0){
   const points=parameters.graphs[model.graphs[damage]??0];
   if(!points)return null;
   for(const key of Object.keys(ATTRIBUTES)){
    if(correction.enabled[damage]?.[key]===false)continue;
    const rate=correction.overwrite[damage]?.[key]??(model.scaling[key]??0)*(reinforce.scaling[key]??1);
    if(!Number.isFinite(rate)||!Number.isFinite(stats[key]))return null;
    if(!rate)continue;
    const curve=curveValue(points,stats[key]);
    if(!Number.isFinite(curve))return null;
    const value=base*rate/100*curve/100;
    bonus+=value;contributions[key]+=value;
   }
  }
  attack[damage]={base,bonus,total:Math.trunc(base+bonus)};total+=base+bonus;
 }
 return {actor,level:selectedLevel,stats,attack,total:Math.trunc(total),contributions,belowMinimum:selectedLevel<variant.requiredLevel,differences:actor.sourceDifferences?.[selectedLevel]||{}};
}

const number=value=>Number.isFinite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:1}):'未知';

export function weaponScalingHTML(weapon,variant,{nightfarers,scaling,character='Wylder',level=15}={}){
 if(!nightfarers?.characters?.length)return '<section class="weapon-character-scaling"><h3 class="guide-subtitle">渡夜者能力补正</h3><p class="data-note">逐级资料尚未载入。</p></section>';
 const selected=nightfarers.characters.some(c=>c.id===character)?character:nightfarers.characters[0].id;
 const selectedLevel=Number.isInteger(Number(level))&&Number(level)>=1&&Number(level)<=15?Number(level):15;
 const actor=nightfarers.characters.find(c=>c.id===selected),stats=actor.levels[selectedLevel];
 const result=calculateWeaponScaling(variant,nightfarers,scaling,{character:selected,level:selectedLevel});
 const controls='<div class="weapon-character-controls"><label>渡夜者<select id="weapon-character-select" aria-label="选择渡夜者">'+nightfarers.characters.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selected?'selected':'')+'>'+esc(c.nameZh)+'</option>').join('')+'</select></label><label>角色等级<select id="weapon-character-level" aria-label="选择渡夜者等级">'+Array.from({length:15},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(n===selectedLevel?'selected':'')+'>Lv. '+n+'</option>').join('')+'</select></label></div>';
 const attributes='<div class="resistance-grid">'+Object.entries(ATTRIBUTES).map(([key,label])=>'<div class="resistance-cell"><span>'+label+' · '+esc(actor.grades[key])+'</span><strong>'+number(stats?.[key])+(actor.sourceDifferences?.[selectedLevel]?.[key]?' <small title="社区来源数值存在差异">*</small>':'')+'</strong>'+(result?'<small>攻击补正 '+(result.contributions[key]>=0?'+':'')+number(result.contributions[key])+'</small>':'')+'</div>').join('')+'</div>';
 const attack=result?'<div class="weapon-scaled-total"><span>'+esc(actor.nameZh)+' · Lv. '+selectedLevel+' · 基础能力值参考</span><strong>'+number(result.total)+' <small>攻击力合计</small></strong></div><div class="resistance-grid">'+Object.entries(DAMAGE).filter(([key])=>result.attack[key].base!==0).map(([key,label])=>{const value=result.attack[key];return '<div class="resistance-cell"><span>'+label+'</span><strong>'+number(value.total)+'</strong><small>基础 '+number(value.base)+' ＋ 补正 '+number(value.bonus)+'</small></div>';}).join('')+'</div>'+(result.belowMinimum?'<p class="data-note context-unmatched">当前等级低于此武器最低使用等级 '+variant.requiredLevel+'，数值仅供规划。</p>':''):'<p class="data-note">此变体的完整补正参数尚未收录，暂不推算攻击力。</p>';
 const progression='<details class="weapon-level-progression"><summary>查看 '+esc(actor.nameZh)+' 1～15 级变化</summary><div class="weapon-level-table-wrap"><table class="weapon-level-table"><thead><tr><th scope="col">等级</th>'+Object.values(ATTRIBUTES).map(label=>'<th scope="col">'+label+'</th>').join('')+'<th scope="col">攻击力</th></tr></thead><tbody>'+Array.from({length:15},(_,i)=>i+1).map(n=>{
  const row=calculateWeaponScaling(variant,nightfarers,scaling,{character:selected,level:n}),values=actor.levels[n];
  return '<tr'+(n===selectedLevel?' class="selected-level"':'')+'><th scope="row">'+n+(n<variant.requiredLevel?'†':'')+'</th>'+Object.keys(ATTRIBUTES).map(key=>'<td>'+number(values?.[key])+(actor.sourceDifferences?.[n]?.[key]?'*':'')+'</td>').join('')+'<td>'+number(row?.total)+'</td></tr>';
 }).join('')+'</tbody></table></div><p class="data-note">† 未达最低使用等级；* 社区来源有数值差异。</p></details>';
 const differences=result&&Object.keys(result.differences).length?'<p class="data-note">* 当前等级的部分能力值存在社区资料差异，暂采用 Relics.pro 参数表，待核。</p>':'';
 const caster=weapon.type.includes('Staff')||weapon.type.includes('Seal');
 return '<section class="weapon-character-scaling" data-scaling-weapon-id="'+variant.id+'"><h3 class="guide-subtitle">渡夜者能力补正</h3>'+controls+attributes+attack+differences+progression+'<p class="data-note">按图鉴所列武器变体、原始强化档位与角色基础能力值计算；未叠加双手力量加成、遗物、随机词条或临时效果，属于基础攻击参考，不是命中 Boss 的伤害。'+(caster?'法器此处显示武器攻击参考，不代表附带法术的威力或治疗量。':'')+'</p><details class="weapon-scaling-sources"><summary>补正数据来源与范围</summary><p class="data-note">使用完整逐级参数表，不将满级数值插值到低等级；资料尚未用原始游戏文件独立核验补丁号。'+(Object.keys(actor.sourceDifferences||{}).length?'此角色的部分等级在两份社区资料间存在差异，星号标注对应能力值。':'')+'</p><div class="boss-sources">'+(nightfarers.sources||[]).map(sourceLink).join(' · ')+'</div></details></section>';
}
