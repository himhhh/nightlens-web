import {escapeHTML as esc} from './ui_helpers.js';
const EVENT_NAMES={'Night Horde':'黑夜势力倾巢出动','Meteor Strike':'陨石坠落','Fellomen':'赐福王突袭','Extra Boss':'全新的黑夜威胁（追加首领）','Augur Raid':'水泡事件（玛丽斯突袭）','Frenzy Tower':'癫火塔',"Sorcerer's Rise":'古代魔法师塔','Gnoster Plague':'虫群事件（格诺斯塔）','Mausoleum':'漫步灵庙','Libra Curse':'恶魔商人诅咒','Caligo Raid':'冰龙入侵（卡莉果）','Balancers Raid':'安定者入侵','Gladius Raid':'野兽入侵（格拉狄乌斯）'};
export function eventText(value=''){
 let text=String(value);for(const [en,zh]of Object.entries(EVENT_NAMES))if(text===en||text.startsWith(en+' ·'))text=zh+text.slice(en.length);
 return text.replaceAll('Dormant Power','潜在能力').replaceAll('终极艺术槽','绝招量表').replaceAll('FP','专注值').replaceAll('使用圣杯时','使用圣杯瓶时').replace(/\s*·\s*$/,'').trim();
}
export function mapFeaturesHTML(layout,getName=value=>value){
 if(!layout)return '';
 return (layout.features||[]).filter(f=>!['chest','day-2-circle'].includes(f.kind)).map(f=>{
  const positioned=f.positionStatus==='known'&&Number.isFinite(f.x)&&Number.isFinite(f.y),label=eventText(getName(f.label||f.kind));
  if(!positioned&&f.kind!=='event')return '';
  const attrs=' data-intel-feature="'+esc(f.id)+'" data-intel-layout="'+layout.id+'"';
  return positioned?'<button class="intel-marker kind-map-feature" style="left:'+f.x/10+'%;top:'+f.y/10+'%"'+attrs+' aria-label="'+esc(label)+'">◆ '+esc(label)+'</button>':'<button class="map-event-notice"'+attrs+'><small>本局特殊事件</small><strong>'+esc(label)+'</strong><span>位置待触发 / 未收录 · 点击查看</span></button>';
 }).join('');
}
export function featureDetailsHTML(layout,id,getName=value=>value){
 const f=layout?.features?.find(x=>x.id===id);if(!f)return '<p>暂无事件记录。</p>';
 return '<div class="eyebrow">EXPEDITION EVENT</div><h2>'+esc(eventText(getName(f.label||f.kind)))+'</h2>'+(f.description?'<p>'+esc(eventText(f.description))+'</p>':'')+(f.positionStatus!=='known'?'<p class="data-note">本局事件提示；具体触发位置未收录或会随对局变化，角标不表示事件发生在地图角落。</p>':'<p class="data-note">已按布局资料中的位置标在地图上。</p>');
}
