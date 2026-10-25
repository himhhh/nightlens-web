/** Game landmark vocabulary. Keep raw visual variants separate from building classes. */
export const PROPERTY_NAMES={fire:'火',holy:'圣',lightning:'雷',magic:'魔法',sleep:'睡眠',poison:'毒',bleed:'出血',frostbite:'冻伤',madness:'疯狂',blight:'死咒',rot:'腐败'};
export const CATEGORY_NAMES={church:'教堂（圣杯瓶）',greatchurch:'大教堂',mage:'法师塔',forge:'锻造村',village:'商人村落',camp:'主营地',fort:'要塞',ruins:'遗迹',marsh:'沼泽',wuf:'西侧地下要塞',euf:'东侧地下要塞',merchant:'秤鳞商人',empty:'空点位',other:'其他据点'};
export function describePOI(rawType=''){
 let type='other',attribute=null,spawn=rawType.endsWith('_spawn');
 if(!rawType||rawType==='empty'||rawType==='empty_spawn')type='empty';
 else if(rawType.startsWith('church'))type='church';
 else if(rawType.startsWith('greatchurch'))type='greatchurch';
 else if(rawType==='sorcerers'||rawType==='diff_sorcerers')type='mage';
 else if(rawType.startsWith('forge'))type='forge';
 else if(rawType==='township')type='village';
 else if(rawType.startsWith('mainencampment'))type='camp';
 else if(rawType.startsWith('fort'))type='fort';
 else if(rawType.startsWith('ruins'))type='ruins';
 else if(rawType.startsWith('marsh'))type='marsh';
 else if(rawType.startsWith('WUF'))type='wuf';
 else if(rawType.startsWith('EUF'))type='euf';
 else if(rawType==='ScaleBearingMerchant')type='merchant';
 const suffix=rawType.split('_').at(-1);if(PROPERTY_NAMES[suffix])attribute=suffix;if(suffix==='eletric')attribute='lightning';
 const label=(rawType==='empty_spawn'?'开局出生点':rawType==='church_spawn'?'教堂（出生点／圣杯瓶）':rawType==='diff_sorcerers'?'强化法师塔':CATEGORY_NAMES[type])+(attribute?' · '+PROPERTY_NAMES[attribute]:'');
 return {rawType,type,attribute,spawn,label,path:'assets/icons/'+rawType+'.webp'};
}
export function buildIconCatalog(patterns){return [...new Set(patterns.flatMap(p=>p.pois.map(q=>q.rawType)).filter(Boolean))].map(describePOI);}

/** Base icons omit elemental corner badges; variants use their exact raw icon. */
export function categoryIcon(type){
 const construct={church:41,greatchurch:38,mage:40,fort:30,camp:32,ruins:34,village:37,forge:501,marsh:500,wuf:535,euf:536}[type];
 return construct?`assets/icons/category-${construct}.png`:type==='merchant'?'assets/icons/ScaleBearingMerchant.webp':null;
}
