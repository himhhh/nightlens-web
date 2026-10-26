/** Auditable Nightreign combat facts. Values are base NPC parameters, not final fight thresholds. */
export const DAMAGE_TYPES = [
  {key:'standard',label:'标准'},{key:'strike',label:'打击'},
  {key:'slash',label:'斩击'},{key:'pierce',label:'突刺'},
  {key:'magic',label:'魔力'},{key:'fire',label:'火焰'},
  {key:'lightning',label:'雷电'},{key:'holy',label:'神圣'},
];
export const STATUS_TYPES = [
  {key:'poison',label:'中毒'},{key:'scarletRot',label:'猩红腐败'},
  {key:'bleed',label:'出血'},{key:'frostbite',label:'冻伤'},
  {key:'sleep',label:'睡眠'},{key:'madness',label:'发狂'},
  {key:'deathBlight',label:'咒死'},
];
// Case/spacing and the spelling of '&' are the only normalization. No substring/fuzzy joins.
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s*&\s*/g,' and ').replace(/\s+/g,' ');
const indexes = new WeakMap();
function indexData(data) {
  if (!data || typeof data !== 'object') return {bosses:new Map(),encounters:new Map(),aliases:new Map()};
  if (indexes.has(data)) return indexes.get(data);
  const bosses = new Map((data.bosses || []).map(boss=>[boss.id,boss]));
  const encounters = new Map();
  for (const encounter of data.encounters || []) {
    for (const key of [encounter.id,encounter.nameEn,...(encounter.aliases || [])]) {
      const normalized = normalize(key);
      const existing = encounters.get(normalized);
      if (existing && existing.id !== encounter.id && JSON.stringify(existing.bossIds) !== JSON.stringify(encounter.bossIds)) {
        throw new Error(`首领遭遇别名冲突：${key}`);
      }
      encounters.set(normalized,encounter);
    }
  }
  const aliases = new Map();
  for (const boss of bosses.values()) for (const key of [boss.id,boss.nameEn,boss.nameZh,...(boss.aliases || [])]) {
    const normalized=normalize(key), existing=aliases.get(normalized);
    if (existing && existing.id !== boss.id) throw new Error(`首领实体别名冲突：${key}`);
    aliases.set(normalized,boss);
  }
  const result={bosses,encounters,aliases}; indexes.set(data,result); return result;
}
export function getBossEncounter(data,key) {
  return indexData(data).encounters.get(normalize(key)) || null;
}
/** Return separate combat records for all members; Demon Prince alternatives retain memberMode=branches. */
export function getBossCombat(data,key,{npcParamId,context,entityOnly=false}={}) {
  const index=indexData(data), encounter=index.encounters.get(normalize(key));
  const entity=entityOnly?(index.bosses.get(key)||index.aliases.get(normalize(key))):null;
  const records=entityOnly?(entity?[entity]:[]):encounter ? encounter.bossIds.map(id=>index.bosses.get(id)).filter(Boolean) : [index.aliases.get(normalize(key))].filter(Boolean);
  if (npcParamId == null && !context) return records;
  return records.map(boss=>{
    const variant=boss.variants?.find(item=>npcParamId != null ? String(item.variantKey??item.npcParamId)===String(npcParamId) : item.context===context);
    if (!variant) return {...boss,contextMatched:false,requestedContext:context ?? null,requestedNpcParamId:npcParamId ?? null};
    const damage=variant.damageNegation, known=Object.values(damage).filter(Number.isFinite);
    return {...boss,...variant,sourceVariant:variant.label,sourceContext:variant.context,contextMatched:true,
      weaknesses:Object.keys(damage).filter(key=>Number.isFinite(damage[key])&&damage[key]<0),
      relativeWeaknesses:known.length?Object.keys(damage).filter(key=>damage[key]===Math.min(...known)):[]};
  });
}
export function getCombatVariantLabel(variant) {
  return variant?.labelZh || '基础参数';
}
export function formatNegation(value) {
  return typeof value==='number' && Number.isFinite(value) ? `${value}%` : '未知';
}
export function formatStatusResistance(value,{base=true}={}) {
  if (value==='immune') return '免疫';
  return typeof value==='number' && Number.isFinite(value) ? `${value}${base?'（基础）':''}` : '未知';
}
export function getCombatSources(data,boss) {
  const ids=new Set(boss?.sourceIds || []);
  return (data?.sources || []).filter(source=>ids.has(source.id));
}
export function getCombatDataLabel(boss) {
  if (boss?.gameData==='elden-ring') return '法环本体参考（非黑夜君临实测）';
  if (boss?.evidenceStatus==='named-community-table') return '黑夜君临 · 社区数据表';
  if (boss?.gameData==='nightreign') return '黑夜君临 · 游戏基础参数';
  return '数值尚未核验';
}
let dataPromise;
export async function loadBossCombat() {
  if (!dataPromise) dataPromise=fetch('assets/data/boss-combat.json').then(response=>{
    if (!response.ok) throw new Error('首领抗性资料未能载入');
    return response.json();
  }).catch(error=>{dataPromise=null;throw error;});
  return dataPromise;
}

/** Player count is a view calculation; immutable base facts stay intact. */
export function scaleBossForPlayers(data,boss,players=3){
 const count=[1,2,3].includes(Number(players))?Number(players):3;
 const resistanceMultiplier=data.playerScaling?.status?.[count];
 const poiseMultiplier=data.playerScaling?.poise?.[count];
 return {...boss,players:count,resistanceMultiplier,
  statusResistance:Object.fromEntries(Object.entries(boss.statusResistance||{}).map(([key,value])=>[key,Number.isFinite(value)?(Number.isFinite(resistanceMultiplier)?Math.round(value*resistanceMultiplier):null):value])),
  health:boss.healthByPlayers?.[count]??null,
  poise:Number.isFinite(boss.basePoise)&&Number.isFinite(poiseMultiplier)?Math.round(boss.basePoise*poiseMultiplier):null};
}
