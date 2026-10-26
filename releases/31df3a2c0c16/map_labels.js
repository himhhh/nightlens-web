import {eventText} from './map_events.js';
/** Concise map labels; full encounter/member names remain in the detail card. */
const SHORT_NAMES={'Banished Knights':'失乡骑士','Crystalians':'结晶人','Nox Warriors':'诺克斯战士','Crucible Knights':'熔炉骑士','Cleanrot Knights':'尊腐骑士','Death Knights':'死亡骑士','Mimic Tears':'仿身泪滴','Godskin Duo':'神皮双人组','Tree Sentinel and Royal Cavalrymen':'大树守卫与骑兵','Draconic Tree Sentinel and Royal Cavalrymen':'龙装守卫与骑兵'};
export function compactEncounterLabel(encounter,getName=value=>value){
 const raw=encounter.occupantLabel||(encounter.bossNames?.length===1?encounter.bossNames[0]:encounter.label)||'据点';
 const name=eventText(SHORT_NAMES[raw]||getName(raw));
 return Array.from(name).length>10?Array.from(name).slice(0,9).join('')+'…':name;
}
const GUARDS={trolls:'山妖',banished_knights:'失乡骑士',crucible_knights:'熔炉骑士'};
const CREWS={Godskins:'神皮',Hornsent:'角人','Fire Knights':'火焰骑士','Cleanrot Knights':'尊腐骑士'};
export function castleMapMarkers(layout){
 const castle=layout?.castle,result=[];
 if(castle?.status==='known'&&castle.guard&&Number.isFinite(castle.guard.x)&&Number.isFinite(castle.guard.y))result.push({id:'central-castle',x:castle.guard.x,y:castle.guard.y,label:(GUARDS[castle.guard.key]||castle.guard.name)+'主城'});
 for(const variant of castle?.variants||[]){
  const anchor=(layout.encounters||[]).find(e=>variant.encounterIds?.includes(e.id)&&e.positionStatus==='known'&&Number.isFinite(e.x)&&Number.isFinite(e.y));
  if(anchor)result.push({id:variant.id,x:anchor.x,y:anchor.y,label:variant.label+' · '+(CREWS[variant.type]||variant.type||'城堡')});
 }
 return result;
}
