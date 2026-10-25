import {renderSpellCatalog,spellDetailsHTML,SPELL_EFFECTS} from './spell_catalog.js';
import {renderWeaponCatalog,weaponDetailsHTML,WEAPON_ELEMENTS} from './weapon_catalog.js';
import {installImageRecovery} from './image_recovery.js';
import {recommendationsHTML} from './weapon_recommendations.js';
import {filterPatterns,recommendPoint,summarizeEvidence,selectVisibleCandidates,resolveNightlordFilter,normalizeObservations,isSingleFormNightlord,TYPE_NAMES,TERRAIN_NAMES,NIGHTLORD_NAMES,POI_TYPES} from './core.js';
import {filterCrystalGroups} from './crystals.js';
import {createCrystalMapView} from './crystal_map.js';
import {crystalMarkersHTML,crystalSummaryText} from './crystal_ui.js';
import {categoryIcon} from './poi_catalog.js';
import {createMapIntelIndex,getLayoutIntel,getBossIntel} from './map_intel.js';
import {getBossCombat} from './boss_combat.js';
import {bossLinkHTML,bossDetailsHTML,finalNightlordHTML} from './boss_ui.js';
import {combatContextFor} from './combat_context.js';
import {intelOverlayHTML,layoutIntelligenceHTML,encounterDetailsHTML,castleDetailsHTML} from './intel_ui.js';
import {loadImage,mapPath,imageCanvas,recognizePhoto} from './vision.js';
import {createMapViewport} from './map_viewport.js';
import {renderBossCatalog,BOSS_CATALOG_CATEGORIES} from './boss_catalog.js';
import {eventText,featureDetailsHTML} from './map_events.js';
import {castleMapMarkers,compactEncounterLabel} from './map_labels.js';
import {requestMapPhoto,photoFromNative} from './ui_helpers.js';
import {connectOffline,offlinePresentation} from './offline_ui.js';
import {mountBrowserCamera} from './browser_camera.js';
import {mountInstallGuide} from './install_guide.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='nightlens.demo.v2';
const state={data:null,crystalData:null,mapIntel:null,intelIndex:null,combat:null,weapons:null,spells:null,nightfarers:null,weaponScaling:null,weaponCharacter:'Wylder',weaponLevel:15,expeditionForm:'unknown',formSource:null,formNightlord:null,detailReturnView:'scan',detailReturnScroll:0,planStage:'overall',planKind:'melee',weaponLimit:48,spellLimit:48,layoutLimit:60,filters:{terrain:'Default',nightlord:'',spawn:''},autoTerrain:true,autoNightlord:true,detectedNightlord:null,manualMode:false,observations:[],crystals:{},zone:'top',photo:null,photoName:'',aligned:null,busy:false,selected:null,showCircles:true,showBosses:true,showDetailCrystals:false,view:'scan',atlasTab:'boss',bossCategory:'all',bossPlayers:3,diagnostics:null,manual:{from:[],to:[]},generation:0};
const images=new Map();let currentPoint=null,mapRenderToken=0,detailRenderToken=0,toastTimer,currentBossKeys=[],currentWeaponId=null,bossVariants={},bossContext={},mainViewport,detailViewport,largeViewport,crystalViewport,tacticalViewport,spawnViewport,mainMapKey=null;
const BOSS_NAMES={'Demi-Human Queen and Swordmaster':'亚人女王与亚人剑圣','Tree Sentinel and Royal Cavalrymen':'大树守卫与王城骑兵','Draconic Tree Sentinel and Royal Cavalrymen':'龙装大树守卫与王城骑兵','Godskin Duo':'神皮双人组','Gaping Dragon':'贪食魔龙','Valiant Gargoyle':'英雄石像鬼','Fallingstar Beast':'坠星兽','Centipede Demon':'百足恶魔','Smelter Demon':'熔铁恶魔','Battlefield Commander':'战场指挥官','Grafted Monarch':'接肢君王','Ulcerated Tree Spirit':'腐烂树灵','Tibia Mariner':'提比亚的唤声船','Wormface':'蚯蚓脸','Great Wyrm':'大土龙','Dragonkin Soldier':'龙人士兵','Bell Bearing Hunter':'铃珠猎人','Royal Revenant':'王室幽魂','Death Rite Bird':'死之仪式鸟','Crucible Knights':'熔炉骑士','Golden Hippopotamus':'黄金河马','Ghostflame Dragon':'灵火龙','Divine Beast Warrior':'神兽战士','Cleanrot Knights':'尊腐骑士','Spiritcaller Snail':'唤灵蜗牛','Mimic Tears':'仿身泪滴','Ancestor Spirit':'祖灵','Dancer':'舞娘','Demon Prince':'恶魔王子','Dancing Lion':'神兽舞狮','Artorias':'亚尔特留斯'};
Object.assign(BOSS_NAMES, {'Tree Sentinel':'大树守卫','Draconic Tree Sentinel':'龙装大树守卫','Morgott':'恶兆王蒙葛特','Mohg':'鲜血君王蒙格','Demihuman Queen & Swordmaster':'亚人女王与亚人剑圣','Ancient Dragon':'古龙','Crucible Knight & Hippo':'熔炉骑士与黄金河马','Crucible Knight and Golden Hippopotamus':'熔炉骑士与黄金河马','DBW & Curseblade':'神兽战士与咒剑士','Dancer of the Boreal Valley':'冷冽谷的舞娘','Death Knights':'死亡骑士','Demons':'恶魔组合',"Duke's Dear Freja":'公爵的宠物芙蕾雅',"The Duke's Dear Freja":'公爵的宠物芙蕾雅','Great Red Bear':'大红熊','Nameless King':'无名王',"Night's Cavalries":'黑夜骑兵',"Night's Cavalry Duo":'黑夜骑兵双人组','Outland Commander':'异乡指挥官','Chief Purple Fiend':'首席紫衣贤者','Spider Scorpions':'蜘蛛蝎','Curseblade':'咒剑士','Inquisitor':'拷问官','Elder Inquisitor':'大拷问官','Imp Statue':'小恶魔雕像','Unlit Candle':'未点燃的蜡烛'});
Object.assign(BOSS_NAMES,{'Guardian Golem':'守卫魔像','Caravans':'运囚车队','Fire Monk':'火焰习武修士','Abductor Virgin':'掳人少女人偶','Lordsworn Captain':'君王军队长','Oracle Envoys':'神谕使者','Mausoleum Knight':'灵庙骑士','Frenzied Flame Troll':'癫火巨人','Redmane Knights':'红狮子骑士','Flame Chariots':'火焰战车','Royal Army Knights':'王城骑士','Perfumer':'调香师','Depraved Perfumer':'堕落调香师','Runebear':'卢恩熊','Erdtree Burial Watchdogs':'归树看门犬','Albinaurics':'白金之子','Battlemages':'战场魔法师','Albinauric Archers':'白金之子弓手','Ancient Heroes of Zamor':'萨米尔古英雄','Sanguine Noble':'鲜血贵族','Sanguine Nobles':'鲜血贵族','Death Knight':'死亡骑士','Withered Trees':'枯树','Pool Reflection':'水中倒影','Above Door':'门上方','Fleeing Stump':'逃跑的树桩','Fog Door':'雾门','Fake Building':'幻影建筑','Missing Statue':'缺失雕像','Kindreds of Rot':'腐败眷属','Black Flame Monks':'黑焰修士','Omens':'恶兆之子','Omenkillers':'恶兆猎人','Grave Warden Duelists':'守墓斗士','Divine Bird Warrior':'神鸟战士','Cuckoo Knights':'杜鹃骑士','Nomads':'流浪商人','Frost Crayfish':'冰霜巨型螯虾','Cleanrot Knight':'尊腐骑士','Ancestral Followers':'祖灵之民','Meteor Strike':'陨石坠落','Mausoleum':'灵庙','Second Floor':'二楼','Right of Door':'门右侧','Rear Withered Trees':'后方枯树','Trolls':'山妖','Godskins':'神皮使徒驻军','Fire Knights':'火焰骑士','Hornsent':'角人驻军','Night Horde':'黑夜大军'});

const CIRCLE_NAMES={'Divine Tower':'神授塔','West Stormhill Graveyard':'风暴山丘西侧墓地','Northeast Corner':'东北角','Northwest Corner':'西北角','Southwest Corner':'西南角','South Lake':'湖泊南侧','Northwest Lake':'湖泊西北','Northwest of Castle':'城堡西北','South of Castle':'城堡南侧','Southwest Mistwood':'雾林西南','East of Saintsbridge':'圣人桥东侧','Northeast of Lake':'湖泊东北','Northwest Mistwood Pond':'雾林西北池塘','Mountaintops':'山顶','Southeast Mountaintop':'山顶东南','Crater':'火山口','North of Crater':'火山口北侧','Northeast Rotted Woods':'腐败森林东北','Northwest Rotted Woods':'腐败森林西北','Southeast Rotted Woods':'腐败森林东南','West Rotted Woods':'腐败森林西侧','Noklateo':'隐城','Noklateo Entrance':'隐城入口','East':'东部','North':'北部','South':'南部'};
function bossName(name){if(!name)return '暂无记录';if(state.combat){const combat=getBossCombat(state.combat,name);if(combat.length)return combat.map(b=>b.nameZh||b.nameEn).join('、');}if(BOSS_NAMES[name])return BOSS_NAMES[name];const catalog=state.intelIndex&&getBossIntel(state.intelIndex,name);if(catalog&&catalog.name!==name)return bossName(catalog.name);if(name.includes(', '))return name.split(', ').map(bossName).join('、');return name;}
function circleName(name){return CIRCLE_NAMES[name]||name||'暂无记录';}
function status(text,error=false){$('scan-status').textContent=text;$('scan-status').classList.toggle('error',error);if(error&&$('auto-analysis')){$('auto-analysis').open=true;$('auto-status-compact').textContent='需要补拍';}}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3400);}
function save(){const session={version:state.data.version,filters:state.filters,observations:state.observations,crystals:state.crystals,zone:state.zone,autoTerrain:state.autoTerrain,autoNightlord:state.autoNightlord,manualMode:state.manualMode};try{localStorage.setItem(STORAGE,JSON.stringify(session));}catch{/* Browser storage may be disabled. */}try{window.NightLensNative?.postMessage(JSON.stringify({action:'saveSession',session}));}catch{/* Local browser persistence remains available. */}}
function restore(record){try{const s=record??JSON.parse(localStorage.getItem(STORAGE)||'null');if(s?.version!==state.data.version)return;if(TERRAIN_NAMES[s.filters?.terrain])state.filters={terrain:s.filters.terrain,nightlord:NIGHTLORD_NAMES[s.filters.nightlord]?s.filters.nightlord:'',spawn:typeof s.filters.spawn==='string'?s.filters.spawn:''};state.autoTerrain=s.autoTerrain!==false;state.autoNightlord=s.autoNightlord!==false;state.detectedNightlord=null;state.manualMode=s.manualMode===true;state.observations=state.manualMode?normalizeObservations(Array.isArray(s.observations)?s.observations:[]).filter(o=>o.source==='manual'):[];const pointIds=new Set(state.crystalData.points.map(p=>p.id));for(const [id,value]of Object.entries(s.crystals||{}))if(pointIds.has(id)&&['present','absent'].includes(value))state.crystals[id]=value;state.zone=s.zone==='bottom'?'bottom':'top';}catch{/* Ignore incompatible local records. */}}
async function restoreSession(){if(!window.NightLensNative?.postMessage){restore();return;}await new Promise(resolve=>{let finished=false;const finish=record=>{if(finished)return;finished=true;restore(record);resolve();};window.NightLensRestore=finish;setTimeout(()=>finish(null),5000);window.NightLensNative.postMessage(JSON.stringify({action:'loadSession'}));});}
function effectiveNightlord(){return resolveNightlordFilter({autoNightlord:state.autoNightlord,manualNightlord:state.filters.nightlord,detection:state.detectedNightlord});}
function nightlordConflict(){return !state.autoNightlord&&state.filters.nightlord&&state.detectedNightlord?.id&&state.filters.nightlord!==state.detectedNightlord.id;}
function candidates(){const filters={...state.filters,nightlord:effectiveNightlord(),...(state.autoTerrain&&!state.aligned?{terrain:''}:{})};return filterPatterns(state.data.patterns,filters,state.observations);}
function evidenceSummary(all=candidates()){return nightlordConflict()?{state:'nightlord-conflict',autoCount:normalizeObservations(state.observations).filter(o=>o.source!=='manual').length}:summarizeEvidence(all,state.observations);}
function visibleCandidates(){const all=candidates();return selectVisibleCandidates(all,evidenceSummary(all));}
function renderNightlord(){
 const detected=state.detectedNightlord;
 $('nightlord-status').textContent=nightlordConflict()?`照片读取：${NIGHTLORD_NAMES[detected.id]}；与手选夜王不一致，请切回自动识别或检查照片。`:detected?.id?`照片读取夜王：${NIGHTLORD_NAMES[detected.id]}${state.autoNightlord?' · 已自动筛选':''}`:state.photo?(state.busy?'正在读取夜王头像…':'夜王未识别：请拍全地图左下角的圆形夜王头像。'):'拍照后自动读取地图左下角的夜王头像。';
 $('nightlord-status').classList.toggle('error',!!nightlordConflict());
}

function slots(){
 const map=new Map();for(const p of state.data.patterns.filter(p=>p.terrain===state.filters.terrain))for(const point of p.pois){if(point.type!=='empty'||point.spawn)map.set(point.id,{...point});}
 return [...map.values()].sort((a,b)=>a.id-b.id);
}
function cleanupDetail(){detailRenderToken++;detailViewport?.destroy();detailViewport=null;tacticalViewport?.destroy();tacticalViewport=null;}
function updateAtlasBackTop(){const button=$('atlas-back-top');if(button)button.hidden=state.view!=='results'||window.scrollY<400;}
function setView(view){
 if(state.view==='detail'&&view!=='detail')cleanupDetail();state.view=view;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===(view==='detail'?'scan':view)));
 if(view==='results')renderResults();if(view==='crystals'){renderCrystals();crystalViewport?.refresh();}if(view==='scan')mainViewport?.refresh();window.scrollTo({top:0,behavior:'instant'});updateAtlasBackTop();
}
function closeDetail(){const view=state.detailReturnView,top=state.detailReturnScroll;setView(view);window.scrollTo({top,behavior:'instant'});}
function formForPattern(pattern){return isSingleFormNightlord(pattern.nightlord)?'normal':state.formNightlord===pattern.nightlord?state.expeditionForm:'unknown';}
function renderFinalCombat(){if(!state.selected)return;const form=formForPattern(state.selected);$('final-nightlord-slot').innerHTML=finalNightlordHTML(state.selected,state.combat,{form,formSource:state.formSource});$('weapon-plan-slot').innerHTML=recommendationsHTML(state.selected,state.combat,state.weapons,{form,stage:state.planStage,kind:state.planKind,spells:state.spells,getName:bossName});}
function renderWeaponDetails(id){currentWeaponId=Number(id);$('weapon-content').innerHTML=weaponDetailsHTML(state.weapons,currentWeaponId,{nightfarers:state.nightfarers,scaling:state.weaponScaling,character:state.weaponCharacter,level:state.weaponLevel});}
function openWeapon(id){renderWeaponDetails(id);if(!$('weapon-dialog').open)$('weapon-dialog').showModal();$('weapon-dialog').scrollTop=0;}
function openSpell(id){$('spell-content').innerHTML=spellDetailsHTML(state.spells,id,state.weapons);if(!$('spell-dialog').open)$('spell-dialog').showModal();$('spell-dialog').scrollTop=0;}

function renderFilters(){
 $('terrain-filter').value=state.autoTerrain?'Auto':state.filters.terrain;$('lord-filter').innerHTML='<option value="Auto">自动识别夜王</option><option value="">全部夜王（不筛选）</option>'+Object.entries(NIGHTLORD_NAMES).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('');$('lord-filter').value=state.autoNightlord?'Auto':state.filters.nightlord;
 const available=state.data.patterns.filter(p=>p.terrain===state.filters.terrain&&(!effectiveNightlord()||p.nightlord===effectiveNightlord()));const spawnPoints=[...new Set(available.map(p=>p.spawn).filter(Boolean))].sort((a,b)=>Number(a.replace(/\D/g,''))-Number(b.replace(/\D/g,'')));
 if(state.filters.spawn&&!spawnPoints.includes(state.filters.spawn))state.filters.spawn='';
 $('spawn-filter').innerHTML='<option value="">不确定 / 尚未选择</option>'+spawnPoints.map(s=>`<option value="${esc(s)}">${esc(s)} · 开局落地区域</option>`).join('');$('spawn-filter').value=state.filters.spawn;$('spawn-picker-button').querySelector('span').textContent=state.filters.spawn?'已选 '+state.filters.spawn+' · 在地图上修改':'在地图上选择落地区域';
}
function renderSpawnPickerMap(){
 const terrain=$('spawn-map-terrain').value,nightlord=effectiveNightlord(),choices=new Map();
 for(const pattern of state.data.patterns){
  if(pattern.terrain!==terrain||nightlord&&pattern.nightlord!==nightlord)continue;
  for(const point of pattern.pois)if(point.spawn&&pattern.spawn&&!choices.has(pattern.spawn))choices.set(pattern.spawn,{...point,label:pattern.spawn});
 }
 $('spawn-map-background').src=mapPath(terrain);$('spawn-map-background').alt=TERRAIN_NAMES[terrain]+'开局落地区域参考地图';
 $('spawn-map-markers').innerHTML=[...choices.values()].sort((a,b)=>a.id-b.id).map(point=>'<button type="button" data-map-control data-spawn-choice="'+esc(point.label)+'" data-spawn-terrain="'+esc(terrain)+'" style="left:'+point.x/10+'%;top:'+point.y/10+'%" aria-label="选择'+esc(point.label)+'的落地区域" aria-pressed="'+(state.filters.terrain===terrain&&state.filters.spawn===point.label)+'">'+point.id+'</button>').join('');
 $('spawn-map-caption').textContent=choices.size?'点击地图上的落地区域；选择后同时采用这张参考地图的地形。'+(nightlord?'已按当前夜王缩小范围。':''):'当前夜王与地形没有已收录落地点，可切换参考地形或暂不选择。';
 spawnViewport?.destroy();spawnViewport=bindMapViewport('spawn-map',$('spawn-map-viewport'),$('spawn-map-scene'));
}
function openSpawnPicker(){
 if(state.busy)return;
 $('spawn-map-terrain').innerHTML=Object.entries(TERRAIN_NAMES).map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');$('spawn-map-terrain').value=state.filters.terrain;
 $('spawn-dialog').showModal();renderSpawnPickerMap();
}
function cardHTML(pattern){return `<button class="candidate-card" data-seed="${pattern.id}"><span class="seed-id">${String(pattern.id).padStart(3,'0')}</span><span class="card-text"><strong>${esc(TERRAIN_NAMES[pattern.terrain])} · ${esc((NIGHTLORD_NAMES[pattern.nightlord]||pattern.nightlord).split(' · ')[0])}</strong><small>第 1 夜 · ${esc(bossName(pattern.night1Boss))}</small><small>第 2 夜 · ${esc(bossName(pattern.night2Boss))}</small></span><span class="arrow">↗</span></button>`;}
function renderCandidates(){
 const all=candidates(),summary=evidenceSummary(all),result=visibleCandidates(),observed=normalizeObservations(state.observations);$('candidate-count').textContent=result.length;
 const messages={'nightlord-conflict':'照片读取的夜王与手选条件不一致，暂不确认布局。请切回自动识别或检查照片。','no-evidence':'拍照或导入地图后会自动识别据点和属性，无需人工标点。',conflict:'当前高级校对条件存在冲突，可清空后重新拍照。',review:`自动读取 ${summary.autoCount} 个据点，证据还不够充分。请补拍更清晰的地图。`,ambiguous:`自动读取 ${summary.autoCount} 个据点，仍有 ${result.length} 个接近的布局。可补拍或选择已知夜王，无需逐点填写。`,recognized:`自动识别到布局 #${summary.patternId}，读取 ${summary.autoCount} 个据点与属性，无需人工标点。`,confirmed:'高级校对条件对应此布局。'};
 $('evidence-summary').textContent=messages[summary.state];$('evidence-summary').style.color=['conflict','nightlord-conflict'].includes(summary.state)?'var(--red)':'';
 $('candidates').innerHTML=result.length?result.slice(0,5).map(cardHTML).join(''):'<div class="empty-state">没有匹配的布局。撤销一个点位，或清空标记重新筛选。</div>';
 const suggestion=recommendPoint(result,state.observations);$('suggestion').hidden=!suggestion||!state.manualMode;
 if(suggestion)$('suggestion').innerHTML=`下一步，看看这个位置<button data-point="${suggestion.id}">确认点位 ${suggestion.id} 的类型或属性，进一步区分候选 ↗</button>`;
 $('observations').innerHTML=observed.map(o=>`<button class="observation-tag ${o.source==='manual'?'':'auto'}" data-point="${o.id}">${o.source==='manual'?'已校对':'自动读取'} ${o.id} · ${esc(o.label||(o.rawType?state.data.patterns.flatMap(p=>p.pois).find(p=>p.rawType===o.rawType)?.label||TYPE_NAMES[o.type]:TYPE_NAMES[o.type]))} ↗</button>`).join('');
 $('auto-status-compact').textContent=state.busy?'正在识别…':observed.length?'已读取 '+observed.length+' 个点位':'等待照片';$('observation-details').hidden=!observed.length;$('observation-summary').textContent='已读取 '+observed.length+' 个点位 · 展开校对详情';$('total-count').textContent=state.data.patterns.length;renderNightlord();renderMap();if(state.view==='results')renderResults();save();
}
async function cachedImage(url){if(!images.has(url))images.set(url,loadImage(url).catch(e=>{images.delete(url);throw e;}));return images.get(url);}
function drawBadge(ctx,x,y,label,{color='#e0c78b',filled=false,radius=17}={}){
 ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=filled?color:'#152019ed';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=filled?'#152019':color;ctx.font='600 16px -apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y+.5);
}
async function drawMap(canvas,pattern=null,{showObservations=false,showIntelText=false}={}){
 const terrain=pattern?.terrain||state.filters.terrain,image=await cachedImage(mapPath(terrain));const ctx=canvas.getContext('2d');canvas.width=canvas.height=2048;canvas.dataset.mapSpace='1000';ctx.setTransform(2.048,0,0,2.048,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,1000,1000);
 if(showObservations&&state.aligned){ctx.globalAlpha=.38;ctx.drawImage(state.aligned,0,0,1000,1000);ctx.globalAlpha=1;}
 ctx.fillStyle='#07100b22';ctx.fillRect(0,0,1000,1000);
 const points=pattern?pattern.pois.filter(p=>p.type!=='empty'||p.spawn):slots();const observations=new Map(normalizeObservations(state.observations).map(o=>[o.id,o]));
 for(const p of points){
  const observation=showObservations?observations.get(p.id):null;const type=observation?.type||(pattern?p.type:null);
  let icon=type?({church:'church',mage:'sorcerers',village:'township',greatchurch:'greatchurch',fort:'fort',ruins:'ruins',camp:'mainencampment',forge:'forge',wuf:'WUF_magic',euf:'EUF_holy'}[type]):null;
  const raw=showObservations?observation?.rawType:p.rawType;if(raw&&!['empty','empty_spawn'].includes(raw))icon=raw;if(showObservations&&!observation)ctx.globalAlpha=.32;
  if(icon){try{const im=await cachedImage('assets/icons/'+icon+'.webp');ctx.drawImage(im,p.x-21,p.y-23,42,42);}catch{/* Draw numbered point even when an optional icon is absent. */}}
  if(icon){drawBadge(ctx,p.x+16,p.y+18,String(p.id),{radius:12,color:observation?'#e8c57d':'#d0d8c3',filled:!!observation});}
  else drawBadge(ctx,p.x,p.y,String(p.id),{color:p.spawn?'#89baa7':'#d4cc9e',radius:p.spawn?19:16});ctx.globalAlpha=1;
 }
 if(pattern&&state.showCircles){
  for(const c of pattern.circles||[]){ctx.beginPath();ctx.arc(c.x,c.y,44,0,Math.PI*2);ctx.strokeStyle=c.day===1?'#94c7d8':'#d3a5e6';ctx.lineWidth=3;ctx.setLineDash([8,6]);ctx.stroke();ctx.setLineDash([]);drawBadge(ctx,c.x,c.y,String(c.day),{color:c.day===1?'#94c7d8':'#d3a5e6',radius:19,filled:true});ctx.font='19px -apple-system,sans-serif';ctx.textAlign='center';ctx.fillStyle='#f1eddc';ctx.strokeStyle='#101714';ctx.lineWidth=5;const label=`第${c.day}夜终圈中心`;ctx.strokeText(label,c.x,c.y+62);ctx.fillText(label,c.x,c.y+62);}
  if(pattern.hollowDay2){const c=pattern.hollowDay2;ctx.fillStyle='#e9a59b';ctx.font='19px -apple-system,sans-serif';ctx.textAlign='center';ctx.strokeStyle='#101714';ctx.lineWidth=5;ctx.strokeText('◇ 第二天圈位提示',c.x,c.y);ctx.fillText('◇ 第二天圈位提示',c.x,c.y);}
 }
 if(pattern&&state.showBosses&&showIntelText){
  const entries=getLayoutIntel(state.intelIndex,pattern.id)?.encounters||[];
  ctx.font='10px -apple-system,sans-serif';ctx.textAlign='center';ctx.lineWidth=2;ctx.strokeStyle='#0c120e';
  for(const e of entries){if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.positionStatus==='unknown')continue;const names=compactEncounterLabel(e,bossName);if(!names)continue;ctx.fillStyle=e.kind==='strong-field'?'#f2a29a':e.kind.startsWith('night-')?'#dfb5f3':'#f0ead5';ctx.strokeText(names,e.x,e.y+25);ctx.fillText(names,e.x,e.y+25);}ctx.font='12px -apple-system,sans-serif';ctx.fillStyle='#f5df9e';for(const marker of castleMapMarkers(getLayoutIntel(state.intelIndex,pattern.id))){ctx.strokeText(marker.label,marker.x,marker.y-15);ctx.fillText(marker.label,marker.x,marker.y-15);}
 }

 if(pattern?.event){ctx.fillStyle='#172319e8';ctx.fillRect(18,18,450,64);ctx.fillStyle='#e6d5a6';ctx.font='14px -apple-system,sans-serif';ctx.textAlign='left';ctx.fillText('本局特殊事件 · '+eventText(pattern.event),28,42,425);ctx.font='10px -apple-system,sans-serif';ctx.fillText('具体发生位置以对局触发为准',28,65);}
 ctx.fillStyle='#111b13dd';ctx.fillRect(14,947,675,37);ctx.font='17px -apple-system,sans-serif';ctx.textAlign='left';ctx.fillStyle='#e6e4ce';ctx.fillText(pattern?`#${String(pattern.id).padStart(3,'0')} · ${TERRAIN_NAMES[terrain]} · 标记为终圈中心，不代表安全区边界`:`${TERRAIN_NAMES[terrain]} · 拍照自动读取据点与属性`,26,966);
}
async function renderMap(){
 const token=++mapRenderToken,offscreen=document.createElement('canvas'),result=candidates();
 const pattern=state.selected&&result.some(p=>p.id===state.selected.id)?state.selected:(['confirmed','recognized'].includes(evidenceSummary(result).state)?result[0]:null);
 try{await drawMap(offscreen,pattern,{showObservations:true});if(token!==mapRenderToken)return;const canvas=$('map-canvas');canvas.width=offscreen.width;canvas.height=offscreen.height;canvas.dataset.mapSpace='1000';canvas.getContext('2d').drawImage(offscreen,0,0);const key=pattern?.id??state.filters.terrain;if(key!==mainMapKey){mainViewport?.reset();mainMapKey=key;}mainViewport?.refresh();$('map-title').textContent=pattern?TERRAIN_NAMES[pattern.terrain]+' · #'+pattern.id:TERRAIN_NAMES[state.filters.terrain];$('intel-overlay').innerHTML=intelOverlayHTML(pattern?getLayoutIntel(state.intelIndex,pattern.id):null,{getName:bossName,showBosses:state.showBosses&&!state.manualMode});}catch(e){status(e.message,true);}
}
function openBoss(keys,context={}){
 currentBossKeys=Array.isArray(keys)?keys:[keys];bossVariants={};bossContext=context;$('boss-content').innerHTML=bossDetailsHTML(state.combat,currentBossKeys,bossName,bossVariants,{...bossContext,players:state.bossPlayers});
 if(!$('boss-dialog').open)$('boss-dialog').showModal();
}
function openEncounter(layoutId,id){
 const layout=getLayoutIntel(state.intelIndex,layoutId),entry=layout?.encounters.find(e=>e.id===id);if(!entry)return;
 if(entry.bossKeys?.length){openBoss(entry.bossKeys,{context:combatContextFor(layout,entry)});return;}
 $('encounter-content').innerHTML=encounterDetailsHTML(layout,id,state.combat,bossName);if(!$('encounter-dialog').open)$('encounter-dialog').showModal();
}

function openPoint(id){currentPoint=Number(id);$('point-dialog-title').textContent=`点位 ${id} 是什么？`;const current=normalizeObservations(state.observations).find(o=>o.id===currentPoint);$('point-options').innerHTML=POI_TYPES.map(type=>`<button data-type="${type}" class="${current?.type===type?'selected':''}">${categoryIcon(type)?'<img class="choice-icon" src="'+categoryIcon(type)+'" alt="">':'<span class="choice-symbol">'+(type==='empty'?'○':'?')+'</span>'}<span>${esc(TYPE_NAMES[type])}</span></button>`).join('')+'<button data-type="unknown">未看清 / 撤销此标记</button>';
 const pool=state.data.patterns.filter(p=>p.terrain===state.filters.terrain&&(!effectiveNightlord()||p.nightlord===effectiveNightlord()));const variants=new Map();for(const p of pool){const point=p.pois.find(o=>o.id===currentPoint);if(point?.rawType&&point.type!=='empty')variants.set(point.rawType,point);}
 const variantRoot=$('point-variants');variantRoot.hidden=variants.size<2;
 if(variants.size>=2){variantRoot.innerHTML='<p class="data-note">如图标带有属性，也可直接确认细分类型：</p><select id="variant-select" aria-label="点位细分类型"><option value="">选择类型与属性</option>'+[...variants.values()].map(p=>`<option value="${esc(p.rawType)}">${esc(p.label||p.rawType)}</option>`).join('')+'</select><div class="variant-icon-grid">'+[...variants.values()].map(p=>`<button class="variant-icon-choice" data-raw-type="${esc(p.rawType)}"><img src="assets/icons/${esc(p.rawType)}.webp" alt=""><span>${esc(p.label||p.rawType)}</span></button>`).join('')+'</div><button id="variant-confirm" class="button secondary full-width">按此类型与属性确认</button>';$('variant-select').value=current?.rawType||'';$('variant-confirm').onclick=()=>{const point=variants.get($('variant-select').value);if(!point){toast('请先选择一个细分类型');return;}setPoint(point.type,point.rawType);};}
 $('point-dialog').showModal();}
function setPoint(type,rawType){state.observations=state.observations.filter(o=>o.id!==currentPoint);if(type!=='unknown')state.observations.push({id:currentPoint,type,...(rawType?{rawType}:{}),source:'manual'});state.selected=null;$('point-dialog').close();renderCandidates();}
function renderLayoutResults(){
 const query=$('seed-search').value.trim(),terrain=$('layout-terrain-filter').value,nightlord=$('layout-nightlord-filter').value,poi=$('layout-poi-filter').value,candidatesOnly=$('layout-candidates-only').checked,all=candidatesOnly?visibleCandidates():state.data.patterns,filtered=all.filter(p=>(!query||String(p.id).padStart(3,'0').includes(query))&&(!terrain||p.terrain===terrain)&&(!nightlord||p.nightlord===nightlord)&&(!poi||p.pois.some(point=>point.type===poi)));$('results-summary').textContent=`${terrain?TERRAIN_NAMES[terrain]:'全部地形'} · ${filtered.length} 个布局${candidatesOnly?' · 当前识别候选':''}${query?' · 编号搜索':''}`;
 $('results-grid').innerHTML=filtered.length?filtered.slice(0,state.layoutLimit).map(p=>`<button class="atlas-card" data-seed="${p.id}"><img src="${mapPath(p.terrain)}" loading="lazy" alt="${esc(TERRAIN_NAMES[p.terrain])}底图"><h3>#${String(p.id).padStart(3,'0')}</h3><p>${esc(NIGHTLORD_NAMES[p.nightlord])}</p><p>一夜 · ${esc(bossName(p.night1Boss))}<br>二夜 · ${esc(bossName(p.night2Boss))}</p></button>`).join('')+(filtered.length>state.layoutLimit?'<p class="muted layout-limit-note">先展示前 '+state.layoutLimit+' 个，可使用上方地形、夜王、兴趣点筛选，或点击显示更多。</p>':''):'<div class="empty-state">没有对应的布局。请检查编号或筛选条件。</div>';
 $('layout-more').hidden=filtered.length<=state.layoutLimit;
}
function renderBossResults(){
 const result=renderBossCatalog(state.combat,{query:$('boss-search').value,category:state.bossCategory});
 $('boss-catalog-grid').innerHTML=result.html;$('boss-catalog-summary').textContent='显示 '+result.count+' / '+result.total+' 个已收录实体 · 组合及永夜王分开列出';
 $('boss-catalog-filters').innerHTML=BOSS_CATALOG_CATEGORIES.map(c=>'<button type="button" data-boss-category="'+c.value+'" aria-pressed="'+(state.bossCategory===c.value)+'"><span>'+c.label+'</span><span class="boss-filter-count">'+result.categoryCounts[c.value]+'</span></button>').join('');
}
function renderWeaponResults(){const result=renderWeaponCatalog(state.weapons,{query:$('weapon-search').value,type:$('weapon-type-filter').value,element:$('weapon-element-filter').value,limit:state.weaponLimit});$('weapon-catalog-grid').innerHTML=result.html;$('weapon-catalog-summary').textContent='显示 '+result.items.length+' / '+result.count+' 把武器 · 共 '+result.total+' 把、'+state.weapons.coverage.variants+' 种属性记录';$('weapon-more').hidden=result.items.length>=result.count;}
function renderSpellResults(){const r=renderSpellCatalog(state.spells,{query:$('spell-search').value,kind:$('spell-kind-filter').value,element:$('spell-element-filter').value,limit:state.spellLimit});$('spell-catalog-grid').innerHTML=r.html;$('spell-catalog-summary').textContent='显示 '+r.items.length+' / '+r.count+' 项 · 共 '+state.spells.coverage.sorceries+' 种魔法、'+state.spells.coverage.incantations+' 种祷告';$('spell-more').hidden=r.items.length>=r.count;}
function renderResults(){if(state.atlasTab==='boss')renderBossResults();else if(state.atlasTab==='weapons')renderWeaponResults();else if(state.atlasTab==='spells')renderSpellResults();else renderLayoutResults();}
function setAtlasTab(tab){
 state.atlasTab=tab;$('atlas-bosses').hidden=tab!=='boss';$('atlas-weapons').hidden=tab!=='weapons';$('atlas-spells').hidden=tab!=='spells';$('atlas-layouts').hidden=tab!=='layouts';
 document.querySelectorAll('[data-atlas-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.atlasTab===tab)));
 renderResults();
}
function zoomControlsHTML(prefix){
 return '<div class="map-zoom-controls"><button id="'+prefix+'-out" aria-label="缩小地图">−</button><span class="map-scale" id="'+prefix+'-scale">100%</span><button id="'+prefix+'-in" aria-label="放大地图">＋</button><button id="'+prefix+'-reset">复原大小</button></div>';
}
function bindMapViewport(prefix,viewport,scene){
 const controller=createMapViewport(viewport,{scene,wheelRequiresModifier:true,onChange:state=>{
  $(prefix+'-scale').textContent=Math.round(state.scale*100)+'%';$(prefix+'-out').disabled=state.scale<=1.001;$(prefix+'-in').disabled=state.scale>=4.999;
 }});
 $(prefix+'-in').onclick=()=>controller.zoomBy(1.5);$(prefix+'-out').onclick=()=>controller.zoomBy(1/1.5);$(prefix+'-reset').onclick=()=>controller.reset();
 controller.refresh();return controller;
}
function preventPageZoom(){
 document.querySelectorAll('meta[name=viewport]').forEach(meta=>meta.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
 document.addEventListener('touchmove',event=>{if(event.touches.length>1)event.preventDefault();},{passive:false});
 for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,event=>event.preventDefault(),{passive:false});
 document.addEventListener('wheel',event=>{if(event.ctrlKey&&!event.target.closest('.map-viewport'))event.preventDefault();},{passive:false});
}

async function openDetail(id){
 const pattern=state.data.patterns.find(p=>p.id===Number(id));if(!pattern)return;if(state.view!=='detail'){state.detailReturnView=state.view;state.detailReturnScroll=window.scrollY;}state.selected=pattern;const token=++detailRenderToken;detailViewport?.destroy();tacticalViewport?.destroy();tacticalViewport=null;
 const c1=pattern.circles.find(c=>c.day===1),c2=pattern.circles.find(c=>c.day===2);
 $('detail-content').innerHTML=`<div class="eyebrow">EXPEDITION INTELLIGENCE</div><div class="detail-topline"><strong>#${String(pattern.id).padStart(3,'0')}</strong><span>${esc(TERRAIN_NAMES[pattern.terrain])}<br>${esc(NIGHTLORD_NAMES[pattern.nightlord])}</span></div><div class="detail-map-toolbar">${zoomControlsHTML("detail-map")}${pattern.terrain==='Great Hollow'?'<button type="button" id="detail-toggle-crystals" class="detail-crystal-switch" role="switch" aria-label="显示水晶" aria-checked="false" aria-controls="detail-crystal-layer"><svg aria-hidden="true"><use href="#i-crystal"/></svg><span>水晶</span><span class="crystal-switch-track" aria-hidden="true"></span></button>':''}</div><div class="map-viewport detail-map-stage" id="detail-map-viewport"><div class="map-viewport-scene" id="detail-map-scene"><canvas id="detail-map" class="detail-map" width="1000" height="1000" aria-label="布局与Boss情报"></canvas><div class="intel-overlay" id="detail-intel-overlay"></div>${pattern.terrain==='Great Hollow'?'<div id="detail-crystal-layer" class="layout-crystal-layer" hidden></div>':''}</div></div>${pattern.terrain==='Great Hollow'?'<p id="detail-crystal-summary" class="map-caption detail-crystal-summary" role="status" hidden></p>':''}<p class="map-caption">已收录布局的资料预览；图中未直接读取的内容由布局资料补全；存在多个候选时可补拍。</p><div id="final-nightlord-slot">${finalNightlordHTML(pattern,state.combat,{form:formForPattern(pattern),formSource:state.formSource})}</div><div id="weapon-plan-slot">${recommendationsHTML(pattern,state.combat,state.weapons,{form:formForPattern(pattern),stage:state.planStage,kind:state.planKind,spells:state.spells,getName:bossName})}</div><div class="detail-info"><div class="info-block"><label>第 1 夜 Boss</label><p>${bossLinkHTML(state.combat,pattern.night1Boss,bossName(pattern.night1Boss),{context:"night"})}</p><small>终圈 · ${esc(circleName(c1?.name))}</small></div><div class="info-block"><label>第 2 夜 Boss</label><p>${bossLinkHTML(state.combat,pattern.night2Boss,bossName(pattern.night2Boss),{context:"night"})}</p><small>终圈 · ${esc(circleName(c2?.name))}</small></div><div class="info-block"><label>开局出生区域</label><p>${esc(pattern.spawn||'暂无记录')}</p><small>仅指开局落地位置</small></div><div class="info-block"><label>${pattern.hollowDay2?'大空洞第二天圈位提示':'特殊事件'}</label><p>${esc(pattern.hollowDay2?(pattern.hollowDay2.direction==='West'?'西侧':'东侧'):(eventText(pattern.event)||'无已记录事件'))}</p><small>${esc(pattern.hollowDay2?'社区图示提取，区别于夜间终圈中心':eventText(pattern.eventDescription))}</small></div></div><p class="data-note">图上虚线环用于突出终圈中心，不表示圈的半径。开局外圈、各阶段实时半径与随机内容无法仅凭布局编号确定。</p>${layoutIntelligenceHTML(state.intelIndex,pattern.id,state.combat,bossName)}<div class="detail-actions"><button class="button secondary" id="detail-save-map">保存此布局地图</button>${pattern.terrain==='Great Hollow'?'<button class="button primary" id="detail-crystals">查看大空洞水晶</button>':''}${state.data.bundledTactical.includes(pattern.id)?'<button class="button secondary" id="detail-tactical">中文完整标注图 ↗</button>':''}</div><p class="data-note">数据版本 ${esc(state.data.sourceVersion)} · 社区资料可能随游戏版本变化。</p>`;
 setView('detail');detailViewport=bindMapViewport('detail-map',$('detail-map-viewport'),$('detail-map-scene'));renderDetailCrystals();try{await drawMap($('detail-map'),pattern);if(token!==detailRenderToken)return;$('detail-intel-overlay').innerHTML=intelOverlayHTML(getLayoutIntel(state.intelIndex,pattern.id),{getName:bossName,showBosses:state.showBosses});renderMap();}catch(e){toast(e.message);}
 $('detail-save-map').onclick=async()=>{const exportCanvas=document.createElement('canvas');await drawMap(exportCanvas,pattern,{showIntelText:true});const url=exportCanvas.toDataURL('image/png');download(url,`NightLens-${pattern.id}.png`);};
 if($('detail-crystals'))$('detail-crystals').onclick=()=>{setView('crystals');};
 if($('detail-tactical'))$('detail-tactical').onclick=()=>{
  const section=document.createElement('section');section.className='tactical-map-section';section.innerHTML=zoomControlsHTML('tactical-map')+'<div class="map-viewport tactical-map-viewport" id="tactical-map-viewport"><div class="map-viewport-scene" id="tactical-map-scene"></div></div>';
  const image=new Image();image.className='tactical-map-image';image.alt='Fuwish 中文完整标注图';
  $('detail-map').closest('.detail-map-stage').after(section);$('tactical-map-scene').append(image);$('detail-tactical').disabled=true;
  image.onload=()=>{if(!image.isConnected)return;$('tactical-map-viewport').style.aspectRatio=image.naturalWidth+'/'+image.naturalHeight;tacticalViewport=bindMapViewport('tactical-map',$('tactical-map-viewport'),$('tactical-map-scene'));};
  image.onerror=()=>{section.remove();toast('此标注图未随当前版本安装，请查看上方结构化地图');};
  image.src='assets/examples/pattern-'+String(pattern.id).padStart(3,'0')+'.jpg';
 };

}
function setBusy(busy){state.busy=busy;if($('auto-status-compact'))$('auto-status-compact').textContent=busy?'正在识别…':$('scan-status').classList.contains('error')?'需要补拍':state.observations.length?'已读取 '+state.observations.length+' 个点位':state.photo?'照片已就绪':'等待照片';$('recognize-button').disabled=busy||!state.photo;$('recognize-button').classList.toggle('busy',busy);$('recognize-button').querySelector('span').textContent=busy?'正在本机处理…':'开始识别地图';for(const id of ['terrain-filter','lord-filter','spawn-filter','camera-button','gallery-button','spawn-picker-button','calibrate-button','clear-photo','clear-points'])$(id).disabled=busy;}
async function importPhoto(file){
 if(!file||state.busy)return;const generation=++state.generation;let url;setBusy(true);
 try{if(file.size>40*1024*1024)throw Error('照片超过 40MB，请选择普通照片而非 RAW 文件');url=URL.createObjectURL(file);const image=await loadImage(url);if(generation!==state.generation)return;state.photo=imageCanvas(image,2200);state.photoName=file.name||'手机拍摄';state.observations=[];state.aligned=null;state.selected=null;state.diagnostics=null;state.detectedNightlord=null;state.expeditionForm='unknown';state.formSource=null;state.formNightlord=null;$('observation-details').open=false;showPhoto();status('照片已就绪，正在自动识别地图、据点及属性…');renderCandidates();setBusy(false);await runRecognition();}
 catch(e){if(generation===state.generation)status('无法打开照片：'+e.message+'。可尝试普通 JPEG / PNG 图片。',true);}
 finally{if(url)URL.revokeObjectURL(url);$('camera-input').value='';$('gallery-input').value='';if(generation===state.generation)setBusy(false);}
}
function showPhoto(){
 const canvas=$('photo-canvas'),display=state.aligned||state.photo;
 $('photo-stage').classList.toggle('has-photo',!!display);$('photo-empty').hidden=!!display;canvas.hidden=!display;$('photo-badge').hidden=!display;$('photo-tools').hidden=!state.photo;
 $('photo-label').textContent=state.aligned?'已校正 · 正方形地图':state.photo?state.photoName:'等待照片';
 if(display){canvas.width=display.width;canvas.height=display.height;canvas.getContext('2d').drawImage(display,0,0);$('photo-badge').textContent=state.aligned?'透视校正后地图 · 本机处理':'完整照片 · 识别后展示校正地图';}
 $('recognize-button').disabled=!state.photo||state.busy;
}
async function runRecognition(manual){
 if(!state.photo||state.busy)return;
 const generation=++state.generation,photo=state.photo,terrain=manual?state.filters.terrain:(state.autoTerrain?'Auto':state.filters.terrain),points=slots(),calibration=manual?{from:manual.from.map(p=>({...p})),to:manual.to.map(p=>({...p}))}:undefined;
 setBusy(true);const started=performance.now();state.aligned=null;state.selected=null;state.detectedNightlord=null;state.expeditionForm='unknown';state.formSource=null;state.formNightlord=null;showPhoto();
 state.observations=state.observations.filter(o=>o.source==='manual');renderCandidates();
 try{const result=await recognizePhoto(photo,terrain,points,message=>{if(generation===state.generation)status(message);},calibration,{patterns:state.data.patterns});
  if(generation!==state.generation)return;
  state.diagnostics={...result,alignedCanvas:undefined,elapsedMs:Math.round(performance.now()-started),photoSize:[photo.width,photo.height],requestedTerrain:terrain};
  if(!result.ok){status(result.reason+'。请补拍清晰的完整地图后重试。',true);renderCandidates();return;}
  state.aligned=result.alignedCanvas;state.expeditionForm=result.nightlord?.form||'unknown';state.formSource=result.nightlord?.formSource||null;state.formNightlord=result.nightlord?.id||null;showPhoto();state.filters.terrain=result.terrain;state.detectedNightlord=result.nightlord||null;renderFilters();const manualIds=new Set(state.observations.map(o=>o.id));state.observations.push(...result.observations.filter(o=>!manualIds.has(o.id)));renderCandidates();
  const decision=evidenceSummary();
  if(decision.state==='recognized'){state.selected=candidates()[0];status(`自动识别到布局 #${decision.patternId} · ${TERRAIN_NAMES[result.terrain]}，读取 ${result.observations.length} 个据点与属性。`);renderMap();}
  else if(decision.state==='nightlord-conflict')status('照片夜王与手选夜王不一致，请在可选条件中切回自动识别。',true);
  else status(`已自动读取 ${result.observations.length} 个据点与属性；${decision.state==='ambiguous'?'存在多个相近布局，可补拍或选择已知夜王。':'图标证据不足，请靠近屏幕或避开遮挡再拍。'}`);
  requestAnimationFrame(()=>requestAnimationFrame(()=>$('candidate-section').scrollIntoView({behavior:'smooth',block:'start'})));
 }catch(e){if(generation===state.generation)status('识别未完成：'+e.message+'。请补拍清晰地图后重试。',true);}
 finally{if(generation===state.generation){setBusy(false);renderNightlord();}}
}
function renderCrystals(){
 const groups=filterCrystalGroups(state.crystalData.groups,state.crystals),possible=new Set(groups.flatMap(g=>g.crystalIds)),found=Object.values(state.crystals).filter(v=>v==='present').length;
 $('crystal-group-count').textContent=groups.length;$('crystal-background').src='assets/maps/great-hollow-top-crop.webp';$('crystal-background').alt='大空洞地表与右下地下水晶合图';
 $('crystal-markers').innerHTML=crystalMarkersHTML(createCrystalMapView(state.crystalData,state.crystals));
 $('crystal-groups').innerHTML=state.crystalData.groups.map(g=>`<div class="crystal-group ${groups.includes(g)?'':'excluded'}"><strong>${esc(g.name)} ${groups.includes(g)?'· 仍有可能':'· 已排除'}</strong><p>${g.crystalIds.filter(id=>state.crystalData.points.find(p=>p.id===id).zone==='top').length} 个地表 / ${g.crystalIds.filter(id=>state.crystalData.points.find(p=>p.id===id).zone==='bottom').length} 个地下</p></div>`).join('');
 $('crystal-summary').textContent=groups.length?`已标记发现 ${found} 个水晶；剩余 ${[...possible].filter(id=>state.crystals[id]!=='present').length} 个可能位置。${groups.length===1?'目前记录仅对应一组，仍请以本局实况为准。':''}`:'当前记录无法对应已收录组合。请检查位置和楼层，或清空后重新记录。';$('crystal-summary').style.color=groups.length?'':'var(--red)';save();
 renderDetailCrystals();
}
function renderDetailCrystals(){
 const button=$('detail-toggle-crystals'),layer=$('detail-crystal-layer'),summary=$('detail-crystal-summary');
 if(!button||!layer||!summary||state.selected?.terrain!=='Great Hollow')return;
 const visible=state.showDetailCrystals===true;
 button.setAttribute('aria-checked',String(visible));button.title=visible?'隐藏水晶':'显示水晶';
 layer.hidden=!visible;summary.hidden=!visible;
 button.onclick=()=>{state.showDetailCrystals=!visible;renderDetailCrystals();};
 if(!visible){layer.innerHTML='';return;}
 const view=createCrystalMapView(state.crystalData,state.crystals,{layout:true});
 layer.innerHTML=crystalMarkersHTML(view);
 summary.textContent=crystalSummaryText(view)+'。点水晶：已发现 → 此处没有 → 清除；可放大地图后标记。';
 summary.classList.toggle('error',!view.groups.length);
}
async function openCalibration(){
 if(!state.photo)return;state.manual={from:[],to:[]};const ref=$('reference-canvas');ref.width=ref.height=1000;const image=await loadImage(mapPath(state.filters.terrain));ref.getContext('2d').drawImage(image,0,0,1000,1000);const source=$('source-canvas');source.width=state.photo.width;source.height=state.photo.height;source.getContext('2d').drawImage(state.photo,0,0);$('calibration-dialog').showModal();paintCalibration();
}
async function paintCalibration(){const image=await loadImage(mapPath(state.filters.terrain));const ref=$('reference-canvas'),source=$('source-canvas');ref.getContext('2d').drawImage(image,0,0,1000,1000);source.getContext('2d').drawImage(state.photo,0,0);for(const [key,canvas]of [['to',ref],['from',source]])state.manual[key].forEach((p,i)=>drawBadge(canvas.getContext('2d'),p.x,p.y,String(i+1),{radius:Math.max(20,canvas.width/24),filled:true}));$('reference-count').textContent=state.manual.to.length+' / 4';$('source-count').textContent=state.manual.from.length+' / 4';$('calibration-apply').disabled=state.manual.to.length!==4||state.manual.from.length!==4;$('calibration-hint').textContent=state.manual.to.length<4?'先在参考地图按顺时针选择四个分散地标。避免都集中在地图一角。':state.manual.from.length<4?'现在在照片中依次选择相同的四个地标，编号顺序必须一致。':'确认两张图的相同编号对应同一地标，然后应用对齐。';}
function canvasPoint(event,canvas){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*(Number(canvas.dataset.mapSpace)||canvas.width),y:(event.clientY-r.top)/r.height*(Number(canvas.dataset.mapSpace)||canvas.height)};}
function download(url,name){if(window.NightLensNative?.postMessage){fetch(url).then(r=>r.blob()).then(blob=>{const reader=new FileReader();reader.onload=()=>window.NightLensNative.postMessage(JSON.stringify({action:'share',name,dataUrl:reader.result}));reader.readAsDataURL(blob);}).catch(()=>toast('无法生成分享文件，请重试'));return;}const link=document.createElement('a');link.href=url;link.download=name;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();}
function exportSession(){const payload={app:'NightLens',build:'0.8.0',time:new Date().toISOString(),dataVersion:state.data.sourceVersion,filters:state.filters,observations:state.observations,candidates:visibleCandidates().map(p=>p.id),decision:evidenceSummary(),autoTerrain:state.autoTerrain,autoNightlord:state.autoNightlord,nightlordDetection:state.detectedNightlord,effectiveNightlord:effectiveNightlord(),crystals:state.crystals,crystalGroups:filterCrystalGroups(state.crystalData.groups,state.crystals).map(g=>g.id),diagnostics:state.diagnostics};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));download(url,'NightLens-验收记录.json');setTimeout(()=>URL.revokeObjectURL(url),3000);}
function filterChanged(kind,value){if(state.busy)return;state.expeditionForm='unknown';state.formSource=null;state.formNightlord=null;if(kind==='terrain'){state.autoTerrain=value==='Auto';if(value!=='Auto')state.filters.terrain=value;}else if(kind==='nightlord'){state.autoNightlord=value==='Auto';state.filters.nightlord=value==='Auto'?'':value;}else state.filters[kind]=value;state.observations=[];state.aligned=null;state.selected=null;state.diagnostics=null;state.detectedNightlord=null;if(kind!=='spawn')state.filters.spawn='';showPhoto();renderFilters();renderCandidates();status('已更新筛选条件并清空旧点位；可以重新自动识别这张照片。');}
function wire(){
 mountInstallGuide();
 const versionButton=$('version-status'),versionMenu=$('version-menu');
 const closeVersion=()=>{versionMenu.hidden=true;versionButton.setAttribute('aria-expanded','false');};
 versionButton.onclick=()=>{versionMenu.hidden=!versionMenu.hidden;versionButton.setAttribute('aria-expanded',String(!versionMenu.hidden));};
 document.addEventListener('click',event=>{if(!$('version-control').contains(event.target))closeVersion();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!versionMenu.hidden){closeVersion();versionButton.focus();}});
 for(const button of document.querySelectorAll('[data-clear-search]')){const input=$(button.dataset.clearSearch),update=()=>{button.hidden=input.value.length===0;};input.addEventListener('input',update);button.onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});};update();}
 $('atlas-back-top').onclick=()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});window.addEventListener('scroll',updateAtlasBackTop,{passive:true});updateAtlasBackTop();
 window.NightLensReceivePhoto=async payload=>{if(state.busy)return;try{await importPhoto(photoFromNative(payload));}catch(_){status('照片未能导入，请重新拍摄。',true);}};
 const browserCamera=mountBrowserCamera({onPhoto:importPhoto,onGallery:()=>$('gallery-input').click()});
 $('camera-button').onclick=()=>{if(!state.busy)requestMapPhoto({nativeBridge:window.NightLensNative,browserCamera:browserCamera.open,fallbackInput:$('camera-input')});};$('gallery-button').onclick=()=>$('gallery-input').click();$('camera-input').onchange=e=>importPhoto(e.target.files[0]);$('gallery-input').onchange=e=>importPhoto(e.target.files[0]);$('recognize-button').onclick=()=>runRecognition();
 $('terrain-filter').onchange=e=>filterChanged('terrain',e.target.value);$('lord-filter').onchange=e=>filterChanged('nightlord',e.target.value);$('spawn-filter').onchange=e=>filterChanged('spawn',e.target.value);$('spawn-picker-button').onclick=openSpawnPicker;$('spawn-map-terrain').onchange=renderSpawnPickerMap;$('spawn-clear-choice').onclick=()=>{filterChanged('spawn','');$('spawn-dialog').close();};$('spawn-dialog').addEventListener('close',()=>{spawnViewport?.destroy();spawnViewport=null;});
 $('clear-photo').onclick=()=>{state.generation++;state.photo=null;state.aligned=null;state.observations=[];state.selected=null;state.diagnostics=null;state.detectedNightlord=null;state.expeditionForm='unknown';state.formSource=null;state.formNightlord=null;showPhoto();renderCandidates();status('照片已移除，可以重新拍摄。');};
 $('clear-points').onclick=()=>{state.observations=[];state.selected=null;renderCandidates();toast('已清空兴趣点标记');};
 $('manual-toggle').onclick=()=>{state.manualMode=!state.manualMode;$('observation-details').open=state.manualMode;$('manual-toggle').setAttribute('aria-pressed',String(state.manualMode));$('manual-toggle').textContent=state.manualMode?'退出高级校对':'高级校对';renderCandidates();};
 $('about-button').onclick=()=>{closeVersion();setView('about');};$('all-results').onclick=()=>{$('layout-candidates-only').checked=true;for(const id of ['layout-terrain-filter','layout-nightlord-filter','layout-poi-filter'])$(id).value='';state.layoutLimit=60;setAtlasTab('layouts');setView('results');};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='results')setAtlasTab('boss');setView(b.dataset.view);});document.querySelector('.brand').onclick=e=>{e.preventDefault();setView('scan');};
 document.addEventListener('click',e=>{const spawn=e.target.closest('[data-spawn-choice]');if(spawn){if(state.busy)return;state.autoTerrain=false;state.filters.terrain=spawn.dataset.spawnTerrain;filterChanged('spawn',spawn.dataset.spawnChoice);$('spawn-dialog').close();return;}const spell=e.target.closest('[data-spell-id]');if(spell){openSpell(spell.dataset.spellId);return;}const weapon=e.target.closest('[data-weapon-id]');if(weapon){openWeapon(weapon.dataset.weaponId);return;}const form=e.target.closest('[data-expedition-form]');if(form&&state.selected){state.expeditionForm=form.dataset.expeditionForm;state.formSource='manual';state.formNightlord=state.selected.nightlord;renderFinalCombat();return;}const planKind=e.target.closest('[data-plan-kind]');if(planKind){state.planKind=planKind.dataset.planKind;document.querySelectorAll('[data-plan-kind-panel]').forEach(p=>p.hidden=p.dataset.planKindPanel!==state.planKind);document.querySelectorAll('[data-plan-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.planKind===state.planKind)));return;}const plan=e.target.closest('[data-plan-stage]');if(plan){state.planStage=plan.dataset.planStage;document.querySelectorAll('[data-plan-panel]').forEach(p=>p.hidden=p.dataset.planPanel!==state.planStage);document.querySelectorAll('[data-plan-stage]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.planStage===state.planStage)));return;}const feature=e.target.closest('[data-intel-feature]');if(feature){$('encounter-content').innerHTML=featureDetailsHTML(getLayoutIntel(state.intelIndex,feature.dataset.intelLayout),feature.dataset.intelFeature,bossName);if(!$('encounter-dialog').open)$('encounter-dialog').showModal();return;}const entity=e.target.closest('[data-boss-entity]');if(entity){openBoss(entity.dataset.bossEntity,{entityOnly:true});return;}const category=e.target.closest('[data-boss-category]');if(category){state.bossCategory=category.dataset.bossCategory;renderBossResults();return;}const tab=e.target.closest('[data-atlas-tab]');if(tab){setAtlasTab(tab.dataset.atlasTab);return;}const castle=e.target.closest('[data-intel-castle]');if(castle){const layout=getLayoutIntel(state.intelIndex,castle.dataset.intelCastle);$('encounter-content').innerHTML=castleDetailsHTML(layout,castle.dataset.castleId,state.combat,bossName);if(!$('encounter-dialog').open)$('encounter-dialog').showModal();return;}const boss=e.target.closest('[data-boss-keys]');if(boss){openBoss(JSON.parse(boss.dataset.bossKeys),{context:boss.dataset.combatContext||undefined});return;}const encounter=e.target.closest('[data-intel-encounter]');if(encounter){openEncounter(encounter.dataset.intelLayout,encounter.dataset.intelEncounter);return;}const variant=e.target.closest('[data-raw-type]');if(variant){const raw=variant.dataset.rawType;const poi=state.data.patterns.flatMap(p=>p.pois).find(p=>p.rawType===raw);if(poi)setPoint(poi.type,raw);return;}const seed=e.target.closest('[data-seed]'),point=e.target.closest('[data-point]'),type=e.target.closest('[data-type]'),crystal=e.target.closest('[data-crystal]');if(seed)openDetail(seed.dataset.seed);if(point&&state.manualMode)openPoint(point.dataset.point);if(type)setPoint(type.dataset.type);if(crystal){const id=crystal.dataset.crystal;state.crystals[id]=!state.crystals[id]?'present':state.crystals[id]==='present'?'absent':undefined;if(!state.crystals[id])delete state.crystals[id];renderCrystals();}});
 $('map-canvas').onclick=e=>{if(!state.manualMode)return;const p=canvasPoint(e,$('map-canvas'));let nearest=null,d=55;for(const s of slots()){const distance=Math.hypot(p.x-s.x,p.y-s.y);if(distance<d){d=distance;nearest=s;}}if(nearest)openPoint(nearest.id);else toast('请点地图上的编号；可先放大地图查看位置');};
 $('toggle-circles').onclick=()=>{state.showCircles=!state.showCircles;$('toggle-circles').classList.toggle('selected',state.showCircles);$('toggle-circles').setAttribute('aria-pressed',String(state.showCircles));renderMap();};$('toggle-bosses').onclick=()=>{state.showBosses=!state.showBosses;$('toggle-bosses').classList.toggle('selected',state.showBosses);$('toggle-bosses').setAttribute('aria-pressed',String(state.showBosses));renderMap();};
 $('weapon-type-filter').innerHTML='<option value="">全部类型</option>'+Object.entries(state.weapons.types).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');$('weapon-element-filter').innerHTML='<option value="">全部属性</option>'+Object.entries(WEAPON_ELEMENTS).filter(([key])=>key!=='standard').map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');for(const id of ['weapon-search','weapon-type-filter','weapon-element-filter'])$(id).addEventListener(id==='weapon-search'?'input':'change',()=>{state.weaponLimit=48;renderWeaponResults();});$('weapon-more').onclick=()=>{state.weaponLimit+=48;renderWeaponResults();};
 const spellEffects=new Set(state.spells.spells.flatMap(s=>s.elements));$('spell-element-filter').innerHTML='<option value="">全部效果属性</option>'+Object.entries(SPELL_EFFECTS).filter(([key])=>spellEffects.has(key)).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');for(const id of ['spell-search','spell-kind-filter','spell-element-filter'])$(id).addEventListener(id==='spell-search'?'input':'change',()=>{state.spellLimit=48;renderSpellResults();});$('spell-more').onclick=()=>{state.spellLimit+=48;renderSpellResults();};
 $('layout-terrain-filter').innerHTML='<option value="">全部地形</option>'+Object.entries(TERRAIN_NAMES).map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');$('layout-nightlord-filter').innerHTML='<option value="">全部夜王</option>'+Object.entries(NIGHTLORD_NAMES).map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('');const layoutPoiTypes=new Set(state.data.patterns.flatMap(p=>p.pois.map(point=>point.type)));$('layout-poi-filter').innerHTML='<option value="">全部兴趣点</option>'+POI_TYPES.filter(type=>layoutPoiTypes.has(type)&&!['empty','other'].includes(type)).map(type=>'<option value="'+type+'">'+esc(TYPE_NAMES[type])+'</option>').join('');const updateLayouts=()=>{state.layoutLimit=60;renderLayoutResults();};for(const id of ['layout-terrain-filter','layout-nightlord-filter','layout-poi-filter','layout-candidates-only'])$(id).onchange=updateLayouts;$('layout-reset-filters').onclick=()=>{for(const id of ['layout-terrain-filter','layout-nightlord-filter','layout-poi-filter'])$(id).value='';$('layout-candidates-only').checked=false;$('seed-search').value='';$('seed-search').dispatchEvent(new Event('input',{bubbles:true}));};$('layout-more').onclick=()=>{state.layoutLimit+=60;renderLayoutResults();};$('seed-search').oninput=updateLayouts;$('boss-search').oninput=renderBossResults;
 document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>{state.zone=b.dataset.zone;renderCrystals();});$('reset-crystals').onclick=()=>{state.crystals={};renderCrystals();toast('已清空水晶记录，开始新一局');};
 $('calibrate-button').onclick=openCalibration;$('calibration-reset').onclick=()=>{state.manual={from:[],to:[]};paintCalibration();};for(const [id,key]of [['reference-canvas','to'],['source-canvas','from']])$(id).onclick=e=>{if(state.manual[key].length>=4)return;if(key==='from'&&state.manual.to.length<4){toast('请先选好参考地图的四个地标');return;}state.manual[key].push(canvasPoint(e,$(id)));paintCalibration();};$('calibration-apply').onclick=()=>{$('calibration-dialog').close();runRecognition(state.manual);};
 preventPageZoom();
 mainViewport=bindMapViewport('main-map',$('map-container'),$('main-map-scene'));
 crystalViewport=bindMapViewport('crystal-map',$('crystal-viewport'),$('crystal-map'));
 largeViewport=bindMapViewport('zoom-map',$('zoom-scroll'),$('zoom-stage'));
 $('map-zoom').onclick=()=>{$('zoom-canvas').width=$('map-canvas').width;$('zoom-canvas').height=$('map-canvas').height;$('zoom-canvas').dataset.mapSpace='1000';$('zoom-canvas').getContext('2d').drawImage($('map-canvas'),0,0);$('zoom-intel-overlay').innerHTML=$('intel-overlay').innerHTML;$('zoom-dialog').showModal();largeViewport.refresh();largeViewport.reset();};
 $('zoom-canvas').onclick=e=>{if(!state.manualMode)return;const p=canvasPoint(e,$('zoom-canvas'));const point=slots().map(s=>({...s,d:Math.hypot(p.x-s.x,p.y-s.y)})).sort((a,b)=>a.d-b.d)[0];if(point?.d<45){$('zoom-dialog').close();openPoint(point.id);}};
 $('result-close').onclick=closeDetail;
 $('auto-analysis').addEventListener('toggle',()=>{if($('auto-analysis').open)mainViewport?.refresh();});

 document.addEventListener('change',e=>{if(e.target.id==='weapon-character-select'||e.target.id==='weapon-character-level'){if(e.target.id==='weapon-character-select')state.weaponCharacter=e.target.value;else state.weaponLevel=Number(e.target.value);const top=$('weapon-dialog').scrollTop;renderWeaponDetails(currentWeaponId);$('weapon-dialog').scrollTop=top;return;}if(e.target.id==='weapon-variant-select'){const top=$('weapon-dialog').scrollTop;renderWeaponDetails(e.target.value);$('weapon-dialog').scrollTop=top;return;}const people=e.target.closest('[data-boss-players]');if(people){state.bossPlayers=Number(people.value);const top=$('boss-dialog').scrollTop;$('boss-content').innerHTML=bossDetailsHTML(state.combat,currentBossKeys,bossName,bossVariants,{...bossContext,players:state.bossPlayers});$('boss-dialog').scrollTop=top;return;}const chooser=e.target.closest('[data-boss-variant]');if(!chooser)return;bossVariants[chooser.dataset.bossVariant]=/^\d+$/.test(chooser.value)?Number(chooser.value):chooser.value;const top=$('boss-dialog').scrollTop;$('boss-content').innerHTML=bossDetailsHTML(state.combat,currentBossKeys,bossName,bossVariants,{...bossContext,players:state.bossPlayers});$('boss-dialog').scrollTop=top;});
 $('export-button').onclick=exportSession;$('reset-all').onclick=()=>{state.filters={terrain:'Default',nightlord:'',spawn:''};state.autoTerrain=true;state.autoNightlord=true;state.manualMode=false;state.observations=[];state.crystals={};state.photo=null;state.aligned=null;state.selected=null;state.diagnostics=null;state.detectedNightlord=null;state.expeditionForm='unknown';state.formSource=null;state.formNightlord=null;state.generation++;setBusy(false);status('本机记录已清空，可以开始新一局。');try{localStorage.removeItem(STORAGE);}catch{}renderFilters();renderCandidates();showPhoto();renderCrystals();toast('已清空本机记录');};
 for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});}
}
function installOffline(){
 if(window.NightLensNative){$('cache-status').textContent='原生安装包已包含地图、数据与识别引擎，可离线使用。';return;}
 if(!('serviceWorker'in navigator)||!window.isSecureContext){$('cache-status').textContent='当前为局域网预览。通过 HTTPS 入口打开并添加主屏幕后，可缓存离线资源。';return;}
 $('offline-panel').hidden=false;
 $('offline-compact').hidden=false;
 const download=connectOffline({serviceWorker:navigator.serviceWorker,onStatus:snapshot=>{
  const model=offlinePresentation(snapshot);$('offline-panel').dataset.state=snapshot.state;
  const version=$('version-status');version.dataset.offlineState=snapshot.state;
  version.setAttribute('aria-label',`版本 0.8，${model.label}${snapshot.state==='ready'?'':'，'+model.percent+'%'}，点击查看详情`);
  $('offline-compact-label').textContent=snapshot.state==='error'?'重试':model.percent+'%';
  $('offline-ring-fill').setAttribute('stroke-dasharray',`${model.percent} 100`);
  $('offline-label').textContent=model.label;$('offline-percent').textContent=model.percent+'%';$('offline-progress').value=model.percent;
  $('offline-detail').textContent=model.detail;$('offline-retry').hidden=!model.retry;
  $('cache-status').textContent=model.label+' · '+model.percent+'%。'+model.detail;
 }});
 $('offline-retry').onclick=()=>void download.retry();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')download.resume();});
}
async function init(){try{const responses=await Promise.all([fetch('assets/data/patterns.json'),fetch('assets/data/crystals.json'),fetch('assets/data/map-intel.json'),fetch('assets/data/boss-combat.json'),fetch('assets/data/weapons.json'),fetch('assets/data/spells.json'),fetch('assets/data/nightfarers.json'),fetch('assets/data/weapon-scaling.json')]);for(const r of responses)if(!r.ok)throw Error('数据资源未就绪');[state.data,state.crystalData,state.mapIntel,state.combat,state.weapons,state.spells,state.nightfarers,state.weaponScaling]=await Promise.all(responses.map(r=>r.json()));state.intelIndex=createMapIntelIndex(state.mapIntel);await restoreSession();wire();renderFilters();renderCandidates();renderCrystals();await installOffline();window.NightLens={state:()=>({filters:{...state.filters},observations:state.observations,candidates:visibleCandidates().map(p=>p.id),decision:evidenceSummary(),autoTerrain:state.autoTerrain,autoNightlord:state.autoNightlord,nightlordDetection:state.detectedNightlord,effectiveNightlord:effectiveNightlord(),crystals:state.crystals,diagnostics:state.diagnostics?{...state.diagnostics}:null,atlasTab:state.atlasTab,view:state.view,expeditionForm:state.expeditionForm,formSource:state.formSource,planKind:state.planKind,selected:state.selected?.id,weaponCount:state.weapons?.coverage.weapons,spellCount:state.spells?.spells.length,nightfarerCount:state.nightfarers?.characters.length,weaponCharacter:state.weaponCharacter,weaponLevel:state.weaponLevel,mapZoom:{main:mainViewport?.getState(),detail:detailViewport?.getState(),tactical:tacticalViewport?.getState(),crystal:crystalViewport?.getState(),large:largeViewport?.getState()},busy:state.busy,dataCount:state.data.patterns.length}),ready:true};}catch(e){status('启动失败：'+e.message+'。请刷新页面或重新启动 App。',true);$('cache-status').textContent='数据加载失败';}}
installImageRecovery();
init();
