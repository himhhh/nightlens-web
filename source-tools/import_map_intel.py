#!/usr/bin/env python3
"""Export public observations without assigning unknown positions or encounters."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS = {
    'seedData': '/data/trusted/seed_data.json',
    'chestPositions': '/data/markers/v2/chests.positions.json',
    'chestAssignments': '/data/trusted/v2/chests.assignments.json',
    'bossPositions': '/data/markers/v2/fieldBosses.positions.json',
    'bossAssignments': '/data/trusted/v2/fieldBosses.assignments.json',
    'bossIconTypes': '/data/reference/v2/fieldBosses.iconTypes.json',
    'rotBlessing': '/data/markers/v2/rotBlessing.json',
    'poiLabels': '/data/trusted/v2/poiLabels.assignments_v2.json',
    'evergaols': '/data/trusted/v2/evergaols.assignments.json',
    'greatHollowPositions': '/data/markers/v2/greatHollow.positions.json',
    'greatHollow': '/data/trusted/v2/greatHollow.assignments.json',
    'greatHollowMerchant': '/data/markers/v2/greatHollowMerchant.json',
    'greatHollowLegendaryMerchant': '/data/markers/v2/greatHollowLegendaryMerchant.json',
    'greatHollowDay2Circle': '/data/markers/v2/greatHollowDay2Circle.json',
    'nightCircles': '/data/markers/v2/nightCircles.json',
    'castleCrew': '/data/markers/v2/castleCrew.json',
}


def boss_key(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def build(snapshot, patterns, raw):
    remote = snapshot['remote']
    source_url = snapshot['meta']['sourceHome'].rstrip('/')
    sources = {key: {'url': source_url + path, 'metadata': remote.get(key, {}).get('_readme', {})}
               for key, path in ENDPOINTS.items()}
    sources['catalog'] = {'url': source_url, 'metadata': {'description': '网站公开前端的 bossDetails / bossAssignments / castleAssignments；由 observer.snapshot 保存。'}}
    sources['snapshot'] = {'url': 'https://raw.githubusercontent.com/stockholm754-source/nightreign-seed-observer/main/data/nightreign-data.json',
                           'sha256': hashlib.sha256(raw).hexdigest(), 'metadata': snapshot['meta']}
    details = {item['key']: item for item in snapshot['bossDetails']}
    by_name = {item['name']: item['key'] for item in snapshot['bossDetails']}
    aliases = remote['bossIconTypes']['nameAliases']
    catalog = {key: {'key': key, 'name': value['name'], 'summary': value['summary'], 'source': 'catalog'}
               for key, value in details.items()}

    def names(label, split=False):
        labels = [part.strip() for part in label.split(',')] if split else [label]
        return [aliases.get(part, part) for part in labels if part]

    def identity(labels):
        keys, canonical_labels = [], []
        for label in labels:
            key = by_name.get(label, boss_key(label))
            if key not in catalog:
                catalog[key] = {'key': key, 'name': label, 'summary': None, 'source': 'assignment',
                                'status': 'name-only'}
            if catalog[key]['name'] != label:
                variants = catalog[key].setdefault('aliases', [])
                if label not in variants:
                    variants.append(label)
            keys.append(key)
            canonical_labels.append(catalog[key]['name'])
        return {'bossKeys': keys, 'bossNames': canonical_labels}

    def record(id_, kind, label, source, point=None, labels=None, **extra):
        result = {'id': id_, 'kind': kind, 'label': label, **identity(labels or []),
                  'x': point['x'] if point else None, 'y': point['y'] if point else None,
                  'positionStatus': 'known' if point else 'unknown', 'source': source}
        result.update(extra)
        return result

    old_bosses = {item['seed_id']: item for item in snapshot['bossAssignments']}
    castles = {item['seed_id']: item for item in snapshot['castleAssignments']}
    patterns_by_id = {item['id']: item for item in patterns['patterns']}
    excluded = set(remote['bossIconTypes']['notFieldBosses'])
    gaol_positions = {item['id']: item for item in snapshot['coordinates']['evergaols']}
    layouts = []
    for seed in snapshot['seeds']:
        sid = seed['seed_id']
        pattern = patterns_by_id[int(sid)]
        terrain = seed['map_type']
        assignment = remote['bossAssignments']['seeds'].get(sid, {})
        encounters, features, limitations = [], [], []
        positioned_slots = set()
        for position in remote['bossPositions']['positions'].get(terrain, []):
            slot = position.get('slot')
            label = assignment.get(slot) if slot else position.get('fixedBoss')
            source_slot = slot
            # The 110 expansion-sheet Limveld records omit "Far" from this
            # slot's name. Bind it only when this terrain actually defines the
            # original southwest marker; never project it onto Great Hollow.
            if slot == 'Far Southwest of Lake' and not label and assignment.get('Southwest of Lake'):
                label = assignment['Southwest of Lake']
                source_slot = 'Southwest of Lake'
            # The 110 DLC Roof records agree with the independent castle catalog.
            if slot == 'Castle Rooftop' and not label and assignment.get('Castle Roof'):
                label = assignment['Castle Roof']
                expected = details.get(castles.get(sid, {}).get('rooftop'), {}).get('name')
                if label != expected:
                    raise ValueError(f'Unverified castle roof alias on {sid}')
                source_slot = 'Castle Roof'
            if not label or label in excluded:
                continue
            # GH castle variant cells contain factions, not field boss names.
            if source_slot:
                positioned_slots.add(source_slot)
            labels = names(label)
            icon = remote['bossIconTypes']['castleSlots'].get(slot) or remote['bossIconTypes']['bosses'].get(labels[0]) or position.get('type')
            kind = ('castle-roof' if slot == 'Castle Rooftop' else
                    'castle-basement' if slot in ('Castle Basement', 'Northwest Castle Basement') else
                    'strong-field' if icon == 'great' else 'field')
            encounters.append(record('field-' + position['id'], kind, labels[0], 'bossAssignments+bossPositions',
                                     position, labels, slot=source_slot, iconType=icon,
                                     fixed=bool(position.get('fixedBoss'))))
        for slot, label in assignment.items():
            if slot in positioned_slots or slot in ('Northwest Castle', 'Southeast Castle') or label in excluded:
                continue
            labels = names(label)
            encounters.append(record('unplaced-' + boss_key(slot), 'field', labels[0], 'bossAssignments',
                                     labels=labels, slot=slot, iconType=remote['bossIconTypes']['bosses'].get(labels[0]),
                                     positionReason='来源槽名没有经核验的对应坐标。'))
        # Preserve every building, including its exact occupant/puzzle label. Only
        # names already present in the boss catalog become boss links here.
        poi_details = remote['poiLabels']['seeds'].get(sid, {})
        for poi in pattern['pois']:
            occupant = poi_details.get(str(poi['id']))
            if not poi['rawType'] and not occupant:
                continue
            if occupant == '@event':
                occupant = snapshot['eventInfo'].get(seed.get('Event'), ['事件内容未记录'])[0]
            label = poi['label'] + (' · ' + occupant if occupant else '')
            boss_labels = names(occupant) if occupant and occupant in by_name and poi['type'] not in ('mage', 'church', 'empty', 'village') else []
            encounters.append(record('poi-' + str(poi['id']), 'camp', label, 'seedData+poiLabels', poi, boss_labels,
                                     slot=str(poi['id']), type=poi['type'], rawType=poi['rawType'],
                                     occupantLabel=occupant, rawOccupantLabel=poi_details.get(str(poi['id'])), spawn=poi.get('spawn', False),
                                     occupantStatus='known' if occupant else 'unknown'))
        for slot, label in remote['evergaols']['seeds'].get(sid, {}).items():
            encounters.append(record('evergaol-' + slot, 'evergaol', label, 'evergaols',
                                     gaol_positions.get(slot), names(label), slot=slot))
        circles = remote['nightCircles']['seeds'].get(sid, {})
        for day in (1, 2):
            item = circles.get('night' + str(day), {})
            label = item.get('boss') or details.get(old_bosses[sid].get('night' + str(day)), {}).get('name')
            point = remote['nightCircles']['positions'].get(item.get('circle'))
            if label:
                encounters.append(record('night-' + str(day), 'night-' + str(day), label, 'nightCircles', point,
                                         names(label), slot=item.get('circle'), day=day))
            key = old_bosses[sid].get('extraNight' + str(day))
            if key:
                label = details.get(key, {}).get('name', key)
                encounters.append(record('night-extra-' + str(day), 'night-extra-' + str(day), label, 'catalog',
                                         labels=[label], day=day, positionReason='仅记录追加夜间首领身份，未记录其生成坐标。'))
        gh = remote['greatHollow']['seeds'].get(sid, {})
        for slot, item in gh.items():
            point = remote['greatHollowPositions']['positions'].get(slot)
            if item['kind'] == 'label':
                features.append(record('gh-secret-' + slot, 'tower-secret', item['label'], 'greatHollow+greatHollowPositions', point, slot=slot))
            else:
                encounters.append(record('gh-boss-' + slot, 'field-stack' if item['kind'] == 'stack' else 'field',
                                         item['label'], 'greatHollow+greatHollowPositions', point,
                                         names(item['label'], item['kind'] == 'stack'), slot=slot,
                                         iconType='field' if item['kind'] == 'boss' else 'stack', sourceKind=item['kind']))
        castle_source = castles.get(sid)
        castle = {'status': 'known' if castle_source else 'unknown', 'type': '利姆韦尔德中央城堡' if castle_source else None,
                  'guard': None, 'basement': None, 'rooftop': None, 'variants': [], 'source': 'castleCrew+catalog',
                  'reason': None if castle_source else ('来源说明隐城地形吞没中央城堡，未记录该城堡。' if terrain == 'Noklateo' else '大空洞采用不同城堡结构，中央城堡字段不适用；见独立城堡记录。')}
        if castle_source:
            guard = remote['castleCrew']['seeds'].get(sid)
            castle['guard'] = {'key': castle_source['guard'], 'name': guard, **remote['castleCrew']['position']}
            for key, kind in [('basement', 'castle-basement'), ('rooftop', 'castle-roof')]:
                encounter = next((item for item in encounters if item['kind'] == kind), None)
                if encounter:
                    castle[key] = {k: encounter[k] for k in ('id', 'bossKeys', 'bossNames', 'x', 'y', 'positionStatus')}
                else:
                    boss_label = details[castle_source[key]]['name']
                    castle[key] = {**identity([boss_label]), 'x': None, 'y': None, 'positionStatus': 'unknown'}
        for slot, loc, positions in [('Northwest Castle', '西北城堡', ['1', '2']), ('Southeast Castle', '东南城堡', ['32', '33'])]:
            if slot in assignment:
                # Variant identity is read directly from the castle assignment;
                # no inference from the POI icon or terrain is needed.
                battle_ids = ['gh-boss-' + p for p in positions if p in gh]
                if slot == 'Northwest Castle':
                    battle_ids += [item['id'] for item in encounters if item.get('slot') == 'Northwest Castle Basement']
                castle['variants'].append({'id': boss_key(slot), 'label': loc, 'type': assignment[slot],
                                           'guard': assignment[slot], 'encounterIds': battle_ids,
                                           'source': 'bossAssignments+greatHollow', 'status': 'known'})
        # Map features have their own layer, so a caption never turns into a
        # falsely positioned encounter (notably the Legendary Merchant note).
        chest_layer = remote['chestPositions']
        chest_points = {p['id']: p for p in chest_layer['greatHollowPositions' if terrain == 'Great Hollow' else 'positions']}
        for id_, present in remote['chestAssignments']['seeds'].get(sid, {}).items():
            if present:
                features.append(record('chest-' + id_, 'chest', '宝箱', 'chestAssignments+chestPositions', chest_points.get(id_), slot=id_))
        for layer, kind, label in [('rotBlessing', 'rot-blessing', '腐败赐福'), ('greatHollowMerchant', 'merchant', '城镇商人'), ('greatHollowDay2Circle', 'day-2-circle', '第 2 天圈提示')]:
            value = remote[layer]['seeds'].get(sid)
            if value:
                features.append(record(kind, kind, label, layer, remote[layer]['positions'].get(value), slot=value))
        if sid in remote['greatHollowLegendaryMerchant']['seeds']:
            features.append(record('legendary-merchant', 'legendary-merchant', '第 2 天传奇商人', 'greatHollowLegendaryMerchant',
                                   positionReason='来源明确为地图上方文字注记，并非商人实际坐标。', day=2))
        if seed.get('Event'):
            event = snapshot['eventInfo'].get(seed['Event'], [seed['Event'], '', ''])
            # The source renderer only uses @event for these three event keys.
            # Other sentinels include legacy placeholders, not target positions.
            anchor, anchor_source, position_kind = None, 'seedData', None
            if seed['Event'] == 'sorcerersrise':
                towers = [p for p in pattern['pois'] if p.get('rawType') == 'diff_sorcerers']
                if len(towers) == 1:
                    anchor, anchor_source, position_kind = towers[0], 'seedData+diff_sorcerers', 'building-slot'
            elif seed['Event'] in ('mausoleum', 'meteorstrikeDay1', 'meteorstrikeDay2'):
                anchors = [e for e in encounters if e.get('rawOccupantLabel') == '@event' and e['positionStatus'] == 'known']
                if len(anchors) == 1:
                    anchor, anchor_source, position_kind = anchors[0], 'seedData+poiLabels', 'source-recorded-event'
            features.append(record('event', 'event', ' · '.join(filter(None, event[:2])), anchor_source,
                                   {'x':anchor['x'], 'y':anchor['y']} if anchor else None,
                                   description=event[2], eventKey=seed['Event'], positionKind=position_kind,
                                   positionReason='' if anchor else '本来源没有可靠的事件地点绑定；不使用未经核实的占位点。'))
        if seed.get('hasOldGaol'):
            features.append(record('old-gaol', 'old-gaol', '旧监牢', 'seedData',
                                   positionReason='来源仅记录存在旧监牢，未提供经核验的独立坐标或首领绑定。'))
        if terrain == 'Great Hollow':
            limitations.append('大空洞据点的逐槽驻军/谜题不在 poiLabels 数据覆盖中；独立首领和谜题见大空洞记录。')
        if any(e['kind'] == 'field' and e['positionStatus'] == 'unknown' for e in encounters):
            limitations.append('部分野外首领的来源槽名无法可靠绑定地图坐标，列出身份但不在地图落点。')
        layouts.append({'id': int(sid), 'sourceId': sid, 'terrain': pattern['terrain'], 'nightlord': pattern['nightlord'],
                        'castle': castle, 'encounters': encounters, 'features': features, 'limitations': limitations,
                        'fieldBossRoster': {**identity([details.get(key, {'name': key})['name'] for key in old_bosses[sid]['fieldBosses']]),
                                            'source': 'catalog', 'positionStatus': 'unknown',
                                            'note': '旧目录的首领列表未绑定位置，不作为额外野外遭遇绘制。'}})
    counts = Counter(item['kind'] for layout in layouts for item in layout['encounters'])
    return {'version': 'map-intel-1', 'sourceVersion': snapshot['meta']['datasetVersion'], 'coordinateSize': 1000,
            'sources': sources, 'coverage': {'layouts': len(layouts), 'centralCastleKnown': sum(x['castle']['status'] == 'known' for x in layouts),
                                           'centralCastleUnknown': sum(x['castle']['status'] == 'unknown' for x in layouts),
                                           'encountersByKind': dict(sorted(counts.items())),
                                           'unpositionedEncounters': sum(x['positionStatus'] == 'unknown' for l in layouts for x in l['encounters'])},
            'layouts': layouts, 'bossCatalog': sorted(catalog.values(), key=lambda x: x['key'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'assets/source/observer.snapshot')
    parser.add_argument('--patterns', type=Path, default=ROOT / 'web_app/assets/data/patterns.json')
    parser.add_argument('--out', type=Path, default=ROOT / 'web_app/assets/data/map-intel.json')
    args = parser.parse_args()
    raw = args.snapshot.read_bytes()
    if args.snapshot.resolve() == (ROOT / 'assets/source/observer.snapshot').resolve():
        expected = json.loads((ROOT / 'tools/data_sources.json').read_text())['observer']['sha256']
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Observer snapshot SHA-256 differs from the pinned source; review provenance before importing.')
    result = build(json.loads(raw), json.loads(args.patterns.read_text()), raw)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(result['coverage'], ensure_ascii=False))


if __name__ == '__main__':
    main()
