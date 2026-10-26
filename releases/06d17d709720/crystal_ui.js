import {escapeHTML as esc} from './ui_helpers.js';

/** Both views use original crystal IDs and the same observation state. */
export function crystalMarkersHTML(view){
 return view.points.map(p=>{
  const cls=p.observation==='present'?'found':p.observation==='absent'?'absent':!p.possible?'excluded':'';
  const label=p.observation==='present'?'已发现':p.observation==='absent'?'此处没有':p.possible?'未确认':'组合已排除，可重新标记';
  return `<button type="button" data-crystal="${esc(p.id)}" data-crystal-zone="${p.zone}" class="crystal-marker ${cls} ${p.optimal?'optimal':''}" style="left:${p.x}%;top:${p.y}%" aria-label="水晶 ${esc(p.id)}，${label}">${p.observation==='present'?'✓':p.observation==='absent'?'×':esc(p.id.replace('g',''))}</button>`;
 }).join('');
}
export function crystalSummaryText(view){
 const found=view.points.filter(p=>p.observation==='present').length;
 const remaining=view.points.filter(p=>p.possible&&p.observation!=='present').length;
 return view.groups.length?`已发现 ${found} 个 · ${view.groups.length} 组仍有可能 · 剩余 ${remaining} 个可能位置`:'记录与已收录组合冲突，请检查标记或清空后重试';
}
