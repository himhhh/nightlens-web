/** Public observation queries. Coordinates are authored in a 1000×1000 space. */
const indexes = new WeakMap();
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function createMapIntelIndex(data) {
  const layouts = new Map((data?.layouts || []).map(layout => [Number(layout.id), layout]));
  const bosses = new Map();
  for (const boss of data?.bossCatalog || []) {
    for (const name of [boss.key, boss.name, boss.nameZh, ...(boss.aliases || [])]) {
      if (normalize(name)) bosses.set(normalize(name), boss);
    }
  }
  return { data, layouts, bosses };
}

function indexFor(dataOrIndex) {
  if (dataOrIndex?.layouts instanceof Map) return dataOrIndex;
  if (!dataOrIndex || typeof dataOrIndex !== 'object') return null;
  if (!indexes.has(dataOrIndex)) indexes.set(dataOrIndex, createMapIntelIndex(dataOrIndex));
  return indexes.get(dataOrIndex);
}

export function getLayoutIntel(dataOrIndex, id) {
  if (id === null || id === undefined || String(id).trim() === '') return null;
  const value = Number(id);
  return Number.isInteger(value) ? indexFor(dataOrIndex)?.layouts.get(value) || null : null;
}

export function getBossIntel(dataOrIndex, keyOrName) {
  return indexFor(dataOrIndex)?.bosses.get(normalize(keyOrName)) || null;
}

export function hasIntelPosition(point) {
  return point?.positionStatus !== 'unknown' && Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 1000;
}

export function getPositionedEncounters(layout) {
  return (layout?.encounters || []).filter(hasIntelPosition);
}

export function getUnpositionedEncounters(layout) {
  return (layout?.encounters || []).filter(encounter => !hasIntelPosition(encounter));
}

/** rect must be the rendered map image rectangle, excluding letterboxing. */
export function mapIntelPoint(point, rect) {
  if (!hasIntelPosition(point) || !Number.isFinite(rect?.width) || !Number.isFinite(rect?.height)
      || rect.width <= 0 || rect.height <= 0) return null;
  const left = Number.isFinite(rect.left) ? rect.left : 0;
  const top = Number.isFinite(rect.top) ? rect.top : 0;
  return { x: left + point.x * rect.width / 1000, y: top + point.y * rect.height / 1000 };
}
