/** Crystal distribution inference is intentionally independent from map pattern IDs. */
export function filterCrystalGroups(groups, observations={}) {
 return groups.filter(group=>Object.entries(observations).every(([id,state])=>state==='present'?group.crystalIds.includes(id):state==='absent'?!group.crystalIds.includes(id):true));
}
