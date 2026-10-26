/** Context comes from recorded encounter membership, never terrain alone. */
export function castleVariantFor(layout, encounter) {
  if (!encounter?.id) return null;
  return (layout?.castle?.variants || []).find(variant => variant.encounterIds?.includes(encounter.id)) || null;
}

export function combatContextFor(layout, encounter) {
  const kind=encounter?.kind || '';
  if (kind.startsWith('night-')) return 'night';
  if (kind.startsWith('castle-') || castleVariantFor(layout, encounter)) return 'castle';
  if (kind==='evergaol') return 'evergaol';
  if (encounter?.fixed===true) {
    const region={Crater:'crater',Noklateo:'noklateo',Mountaintop:'mountaintop'}[layout?.terrain];
    if (region) return region;
  }
  if (kind==='camp') {
    // Missing corresponding parameter variants deliberately remain unmatched;
    // the combat UI must present those values as a base reference.
    return {ruins:'ruins',camp:'encampment',fort:'fort',greatchurch:'great-church',
      forge:'blacksmith',marsh:'marsh',wuf:'western-underground-fort',euf:'eastern-underground-fort'}[encounter.type] || 'poi';
  }
  return 'field';
}
