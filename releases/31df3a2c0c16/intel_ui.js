import {getLayoutIntel,getPositionedEncounters,getUnpositionedEncounters} from './map_intel.js';
import {bossLinkHTML} from './boss_ui.js';
import {combatContextFor,castleVariantFor} from './combat_context.js';
import {eventText,mapFeaturesHTML} from './map_events.js';
import {TYPE_NAMES} from './core.js';
import {castleMapMarkers,compactEncounterLabel} from './map_labels.js';
import {escapeHTML as esc} from './ui_helpers.js';
export const ENCOUNTER_NAMES={'field':'野外 Boss','strong-field':'强敌 Boss','field-stack':'区域 Boss','camp':'据点资料','evergaol':'监牢 Boss','castle-roof':'主城屋顶','castle-basement':'主城地下室','night-1':'第 1 夜 Boss','night-2':'第 2 夜 Boss','night-extra-1':'第 1 夜追加 Boss','night-extra-2':'第 2 夜追加 Boss'};
function encounterCategory(layout,e){const castle=castleVariantFor(layout,e);return castle?castle.label+' · '+(e.kind==='castle-basement'?'地下室':'城堡战斗'):e.kind==='camp'?(TYPE_NAMES[e.type]||'据点')+' · 点位 '+(e.slot||'待补'):(ENCOUNTER_NAMES[e.kind]||e.kind);}
function encounterName(e,getName){return e.bossNames?.length?e.bossNames.map(getName).join('、'):getName(e.occupantLabel||e.label||'资料待补');}
export function intelOverlayHTML(layout,{getName=name=>name,showBosses=true}={}){
 if(!layout)return '';const features=mapFeaturesHTML(layout,getName);if(!showBosses)return features;
 const castles=castleMapMarkers(layout).map(m=>'<button class="intel-marker kind-castle-type" style="left:'+m.x/10+'%;top:'+m.y/10+'%" data-intel-castle="'+layout.id+'" data-castle-id="'+esc(m.id)+'" aria-label="'+esc(m.label)+'"><span>'+esc(m.label)+'</span></button>').join('');
 return features+castles+getPositionedEncounters(layout).map(e=>{
  if(e.rawOccupantLabel==='@event')return '';
  if(e.kind==='camp'&&!e.occupantLabel&&!e.bossKeys?.length)return '';
  const name=eventText(encounterName(e,getName)),short=eventText(compactEncounterLabel(e,getName));
  const icon=e.kind==='evergaol'?'boss-evergaol.png':e.kind==='strong-field'?'boss-strong-field.png':e.kind==='field'?'boss-field.png':null;
  return '<button class="intel-marker kind-'+esc(e.kind)+'" style="left:'+e.x/10+'%;top:'+e.y/10+'%" data-intel-layout="'+layout.id+'" data-intel-encounter="'+esc(e.id)+'" aria-label="'+esc(encounterCategory(layout,e)+'：'+name)+'">'+(icon?'<img src="assets/icons/'+icon+'" alt="">':'')+'<span>'+esc(short)+'</span></button>';
 }).join('');
}
function rowHTML(layout,e,combat,getName){
 const name=eventText(encounterName(e,getName)),link=e.bossKeys?.length?bossLinkHTML(combat,e.bossKeys,name,{context:combatContextFor(layout,e)}):'<strong>'+esc(name)+'</strong>';
 return '<div class="encounter-row"><span class="encounter-kind">'+esc(encounterCategory(layout,e))+(e.positionStatus==='unknown'?' · 坐标待补':'')+'</span>'+link+'</div>';
}
export function encounterDetailsHTML(layout,id,combat,getName=name=>name){const e=layout?.encounters.find(e=>e.id===id);if(!e)return '<p>暂无对应记录。</p>';return '<div class="eyebrow">MAP INTELLIGENCE</div><h2>'+esc(ENCOUNTER_NAMES[e.kind]||'据点资料')+'</h2>'+rowHTML(layout,e,combat,getName)+(e.rawType?'<p class="data-note">据点图标：<img class="inline-poi-icon" src="assets/icons/'+esc(e.rawType)+'.webp" alt="">'+esc(e.label||'')+'</p>':'');}
export function layoutIntelligenceHTML(index,id,combat,getName=name=>name){
 const layout=getLayoutIntel(index,id);if(!layout)return '<p class="data-note">当前布局的详细情报尚未收录。</p>';
 const castle=layout.castle,night=layout.encounters.filter(e=>e.kind.startsWith('night-'));
 const groups=[['主城战斗',e=>e.kind.startsWith('castle-')||!!castleVariantFor(layout,e)],['野外与强敌',e=>['field','strong-field','field-stack'].includes(e.kind)&&!castleVariantFor(layout,e)],['监牢',e=>e.kind==='evergaol'],['据点、驻军与谜题',e=>e.kind==='camp']];
 return '<section class="layout-intelligence"><h3>两夜 Boss 与弱项</h3>'+night.map(e=>rowHTML(layout,e,combat,getName)).join('')+'<h3>主城情报</h3><div class="castle-summary"><p>'+esc(castle?.status==='known'?getName(castle.type||'中央城堡'):'中央主城资料待补')+'</p>'+(castle?.guard?'<p>驻军 · '+esc(getName(castle.guard.name))+'</p>':'')+(castle?.status!=='known'?'<p class="data-note">'+esc(castle?.reason||'本来源暂无中央主城资料。')+'</p>':'')+(castle?.variants||[]).map(c=>'<p>'+esc(getName(c.label))+' · '+esc(getName(c.type||c.guard||'资料待补'))+'</p>').join('')+'</div>'+groups.map(([title,predicate])=>{const items=layout.encounters.filter(predicate);return items.length?'<details class="intel-section" '+(title==='主城战斗'?'open':'')+'><summary>'+title+'<span>'+items.length+' 处</span></summary>'+items.map(e=>rowHTML(layout,e,combat,getName)).join('')+'</details>':'';}).join('')+(layout.features?.length?'<details class="intel-section"><summary>事件与补充情报<span>'+layout.features.length+' 条</span></summary>'+layout.features.map(f=>'<div class="encounter-row"><strong>'+esc(eventText(getName(f.label||f.kind)))+'</strong>'+(f.description?'<p class="data-note">'+esc(eventText(f.description))+'</p>':'')+'</div>').join('')+'</details>':'')+(getUnpositionedEncounters(layout).length?'<p class="data-note">部分记录没有可靠坐标，保留在列表中，不放置地图标记。</p>':'')+'<p class="data-note">蓝色野外与红色强敌标记沿用资料源分类；名称及战斗数据可点击查看。</p></section>';
}

export function castleDetailsHTML(layout,id,combat,getName=value=>value){
 const marker=castleMapMarkers(layout).find(m=>m.id===id);
 const variant=(layout?.castle?.variants||[]).find(v=>v.id===id);
 const entries=(layout?.encounters||[]).filter(e=>variant?variant.encounterIds.includes(e.id):e.kind.startsWith('castle-'));
 return '<div class="eyebrow">CASTLE INTELLIGENCE</div><h2>'+esc(marker?.label||'主城资料')+'</h2>'+entries.map(e=>rowHTML(layout,e,combat,getName)).join('');
}
