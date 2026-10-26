import {NIGHTLORD_NAMES} from './core.js';
import {getCombatDataLabel} from './boss_combat.js';
import {escapeHTML as esc,DAMAGE_NAMES,damageIcon} from './ui_helpers.js';

export const BOSS_CATALOG_CATEGORIES = [
 {value:'all',label:'全部'},
 {value:'nightlord',label:'夜王'},
 {value:'everdark',label:'永夜王'},
 {value:'other',label:'其他首领'},
 {value:'unknown',label:'未核验资料'},
];
const normalize=value=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');

function dataStatus(boss){
 if(boss.gameData==='unknown'||boss.evidenceStatus==='unknown') return 'unknown';
 const values=[...Object.values(boss.damageNegation||{}),...Object.values(boss.statusResistance||{})];
 return values.length&&values.some(value=>value==null)?'partial':'verified';
}

/** Read entity IDs directly. Encounter aliases enrich search and identity, never expand cards. */
export function getBossCatalog(data,{query='',category='all'}={}){
 const memberships=new Map();
 for(const encounter of data?.encounters||[]){
  const nightlordId=Object.keys(NIGHTLORD_NAMES).find(id=>normalize(encounter.id)===normalize(id)||normalize(encounter.id)===normalize(id+'_everdark'));
  for(const id of encounter.bossIds||[]){
   const membership=memberships.get(id)||{search:[]};
   membership.search.push(encounter.id,encounter.nameEn,...(encounter.aliases||[]));
   if(nightlordId){
    membership.nightlordId=nightlordId;
    membership.category=normalize(encounter.id).endsWith('_everdark')?'everdark':'nightlord';
   }
   memberships.set(id,membership);
  }
 }
 const seen=new Set();
 const all=(data?.bosses||[]).filter(boss=>{
  if(!boss?.id||seen.has(boss.id)) return false;
  seen.add(boss.id);return true;
 }).map(boss=>{
  const membership=memberships.get(boss.id)||{};
  // Some explicit Everdark entities (currently Harmonia) have no encounter index.
  const fallbackId=Object.keys(NIGHTLORD_NAMES).find(id=>{
   const prefix=normalize(id)+'_everdark',entityId=normalize(boss.id);
   return entityId===prefix||entityId.startsWith(prefix+'_');
  });
  const nightlordId=membership.nightlordId||fallbackId||null;
  return {...boss,category:membership.category||(fallbackId?'everdark':'other'),nightlordId,
   nightlordName:NIGHTLORD_NAMES[nightlordId]||'',
   variantCount:boss.variants?.length||null,dataStatus:dataStatus(boss),
   searchText:normalize([boss.id,boss.nameZh,boss.nameEn,...(boss.aliases||[]),...(membership.search||[]),NIGHTLORD_NAMES[nightlordId]].join(' '))};
 });
 const categoryCounts={all:all.length,nightlord:0,everdark:0,other:0,unknown:0};
 for(const boss of all){categoryCounts[boss.category]++;if(boss.dataStatus==='unknown') categoryCounts.unknown++;}
 const activeCategory=BOSS_CATALOG_CATEGORIES.some(item=>item.value===category)?category:'all';
 const terms=normalize(query).split(' ').filter(Boolean);
 const items=all.filter(boss=>(activeCategory==='all'||(activeCategory==='unknown'?boss.dataStatus==='unknown':boss.category===activeCategory))&&terms.every(term=>boss.searchText.includes(term)));
 return {items,count:items.length,total:all.length,categoryCounts};
}

function weaknessHTML(boss){
 if(boss.dataStatus==='unknown') return '<span class="boss-catalog-missing">抗性资料待补</span>';
 const keys=(boss.relativeWeaknesses||[]).filter(key=>DAMAGE_NAMES[key]);
 if(keys.length===8) return '<span class="boss-catalog-missing">基础减伤相近</span>';
 if(!keys.length) return '<span class="boss-catalog-missing">相对弱项待核验</span>';
 return '<span class="boss-catalog-weak-label">基础相对弱项</span><span class="boss-catalog-badges">'+keys.map(key=>'<span class="boss-catalog-weak">'+damageIcon(key)+esc(DAMAGE_NAMES[key])+'</span>').join('')+'</span>';
}
function cardHTML(boss){
 const name=boss.nameZh||boss.nameEn||boss.id;
 const categoryLabel=BOSS_CATALOG_CATEGORIES.find(item=>item.value===boss.category).label;
 const statusLabel={verified:'基础参数已收录',partial:'部分资料待补',unknown:'资料待补'}[boss.dataStatus];
 const image=boss.nightlordId?'assets/icons/nightlord-'+boss.nightlordId+'.png':'assets/icons/boss-field.png';
 return '<button type="button" class="boss-catalog-card" data-boss-entity="'+esc(boss.id)+'" aria-label="查看'+esc(name)+'资料">'+
  '<span class="boss-catalog-card-top"><img class="boss-catalog-icon" src="'+image+'" alt="" loading="lazy" width="56" height="56"><span class="boss-catalog-heading"><strong>'+esc(name)+'</strong><span class="boss-catalog-name-en" lang="en">'+esc(boss.nameEn||boss.id)+'</span>'+(boss.nightlordName?'<span class="boss-catalog-nightlord-name">'+esc(boss.nightlordName)+'</span>':'')+'</span><span class="boss-catalog-arrow" aria-hidden="true">↗</span></span>'+
  '<span class="boss-catalog-tags"><span class="boss-catalog-category">'+esc(categoryLabel)+'</span><span class="boss-catalog-data '+boss.dataStatus+'" title="'+esc(getCombatDataLabel(boss))+'">'+statusLabel+'</span></span>'+
  '<span class="boss-catalog-weakness">'+weaknessHTML(boss)+'</span>'+
  '<span class="boss-catalog-meta">'+(boss.variantCount?boss.variantCount+' 项形态 / 场景':'形态/场景待核验')+'<span>查看资料</span></span></button>';
}

/** Return renderable cards and query counts; the caller owns controls and event delegation. */
export function renderBossCatalog(data,options={}){
 const result=getBossCatalog(data,options);
 const html=result.count?'<div class="boss-catalog-grid">'+result.items.map(cardHTML).join('')+'</div>':'<div class="boss-catalog-empty"><strong>没有找到对应首领</strong><p>试试其他名称，或切换分类查看。</p></div>';
 return {...result,html};
}
