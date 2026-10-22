"""Pinned, explicitly mapped Nightreign status supplements; no downloaded JS executes.

Refresh: python3 tools/import_status_resistances.py --source-js /path/to/Affinity-B2fqUc4f.js
Normal catalogue builds use only the reviewed JSON cache (stdlib-only).
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools/data/boss-combat/status-supplement-2026-10-22.json'
ASSET_URL = 'https://nightfarerledger.com/assets/Affinity-B2fqUc4f.js'
KEYS = {'poison': 'poison', 'scarletRot': 'rot', 'bleed': 'bleed',
        'frostbite': 'frost', 'sleep': 'sleep', 'madness': 'madness', 'deathBlight': 'blight'}
# Entity ID, exact NPC ID, source encounter, exact source member. Never fuzzy-match.
TARGETS = [
    ('artorias', 77200010, 'Artorias', 'Artorias'),
    ('bloodbane_giant_crows', 45610010, 'Bloodbane Giant Crows', 'Bloodbane Giant Crows'),
    ('chief_bloodfiend', 50810020, 'Chief Bloodfiend', 'Chief Bloodfiend'),
    ('chief_bloodfiend', 50810010, 'Chief Bloodfiend', 'Chief Bloodfiend'),
    ('chief_purple_fiend', 50811010, 'Chief Purple Fiend', 'Chief Purple Fiend'),
    ('cleanrot_knights', 38000010, 'Cleanrot Knights', 'Cleanrot Knights'),
    ('curseblade', 50400020, 'Curseblade', 'Curseblade'),
    ('curseblade', 50400010, 'Curseblade', 'Curseblade'),
    ('dancing_lion', 52100010, 'Dancing Lion', 'Dancing Lion'),
    ('death_knight_twinaxes', 50700010, 'Death Knights', 'Death Knights'),
    ('death_knight_twinaxes', 50700020, 'Death Knight', 'Death Knight'),
    ('death_knight_longhaft_axe', 50701010, 'Death Knights', 'Death Knights'),
    ('demon_from_below', 79300010, 'Demons', 'Demon from Below'),
    ('demon_in_pain', 79300110, 'Demons', 'Demon in Pain'),
    ('demon_prince_below', 79301010, 'Demon Prince', 'Demon Prince'),
    ('demon_prince_pain', 79301110, 'Demon Prince', 'Demon Prince'),
    ('divine_beast_warrior', 52501220, 'DBW & Curseblade', 'Divine Beast Warrior'),
    ('divine_beast_warrior', 52501210, 'Divine Beast Warrior', 'Divine Beast Warrior'),
    ('elder_inquisitor', 53120010, 'Elder Inquisitor', 'Elder Inquisitor'),
    ('ghostflame_dragon', 58600010, 'Ghostflame Dragon', 'Ghostflame Dragon'),
    ('great_red_bear', 58200010, 'Great Red Bear', 'Great Red Bear'),
    ('inquisitor', 53200010, 'Inquisitor', 'Inquisitor'),
    ('mimic_tears', 33201110, 'Mimic Tears', 'Mimic Tear'),
    ('mimic_tears', 46000040, 'Mimic Tears', 'Troll'),
    ('mohg', 48000010, 'Mohg', 'Mohg'),
    ('spider_scorpions', 51920010, 'Spider Scorpions', 'Spider Scorpions (Marsh)'),
    ('spider_scorpions', 51920020, 'Spider Scorpions', 'Spider Scorpions (Ruins)'),
    ('spiritcaller_snail', 41402210, 'Spiritcaller Snail', 'Spiritcaller Snail'),
    ('king_of_the_storm', None, 'Nameless King', 'phase:1'),
]


def read_literal(path):
    """Read the published data object using a data parser, never eval/Node import."""
    import json5  # Only required when explicitly refreshing from the public asset.
    text = path.read_text()
    start = text.index('const r=') + len('const r=')
    depth, quote, escaped = 0, None, False
    for i in range(start, len(text)):
        char = text[i]
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
        elif char in ('"', "'"):
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return json5.loads(text[start:i + 1])
    raise ValueError('Unterminated source data object')


def refresh(path):
    data = read_literal(path)
    def row(profile, member):
        matches = [r for r in data[profile] if r['member'] == member]
        if len(matches) != 1:
            raise ValueError(f'Ambiguous member: {profile}/{member}')
        values = {key: matches[0]['status'][name] for key, name in KEYS.items()}
        if not all(v == 'immune' or (type(v) in (int, float) and 0 < v < 999) for v in values.values()):
            raise ValueError(f'Unexpected first-proc data: {profile}/{member}')
        return {'sourceProfile': profile, 'sourceMember': member, 'statusResistance': values}
    rows = {str(npc) if npc is not None else boss: {'bossId': boss, **row(profile, member)}
            for boss, npc, profile, member in TARGETS}
    refs = {
        '50400120': {'bossId': 'curseblade', **row('Curseblade', 'Curseblade'),
                     'label': '据点咒剑士', 'note': '仅作同名据点形态参考，夜间暗化形态尚无独立异常阈值。'},
        '42900030': {'bossId': 'bloodhound_knight', **row('Bloodhound Knight', 'Bloodhound Knight'),
                     'label': '监牢猎犬骑士', 'note': '监牢场景参考，不能视作西侧地下要塞精英的独立阈值。'},
    }
    result = {
        'source': {'id': 'ledger-status', 'title': 'Nightfarer Ledger / Nightmap · 黑夜君临异常耐受表',
                   'url': 'https://nightfarerledger.com/codex/bosses', 'game': 'nightreign',
                   'kind': 'named-community-table', 'retrievedAt': '2026-10-22',
                   'assetUrl': ASSET_URL, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                   'version': '异常字段未独立声明补丁版本；不将网页的血量1.03.5声明扩展到这些阈值'},
        'unit': 'base-buildup-points', 'rows': rows, 'references': refs,
        'limitations': ['仅补空缺，不覆盖已收录原始参数。',
                        '恶魔王子来源未区分两条分支，死骑士组合来源未按武器拆开；保留共用资料表说明。',
                        '夜间暗化咒剑士及永夜安定者仍须独立来源，不能复制普通形态。'],
    }
    CACHE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


def enrich_status(data):
    facts = json.loads(CACHE.read_text())
    data['sources'].append(facts['source'])
    filled = 0
    for boss in data['bosses']:
        for variant in boss['variants']:
            key = str(variant['npcParamId']) if variant['npcParamId'] is not None else boss['id']
            variant['statusEvidence'] = None
            variant['statusReference'] = None
            patch = facts['rows'].get(key)
            if patch:
                if patch['bossId'] != boss['id']:
                    raise ValueError(f'Wrong NPC/entity join: {key}')
                added = [k for k, v in variant['statusResistance'].items() if v is None]
                for k in added:
                    variant['statusResistance'][k] = patch['statusResistance'][k]
                if added:
                    filled += len(added)
                    variant['statusEvidence'] = {'game': 'nightreign', 'sourceIds': ['ledger-status'],
                        'sourceProfile': patch['sourceProfile'], 'sourceMember': patch['sourceMember'], 'keys': added}
                    variant['sourceIds'] = list(dict.fromkeys([*variant['sourceIds'], 'ledger-status']))
            reference = facts['references'].get(key)
            if reference:
                if reference['bossId'] != boss['id']:
                    raise ValueError(f'Wrong reference/entity join: {key}')
                variant['statusReference'] = {'game': 'nightreign', 'sourceIds': ['ledger-status'],
                    **{k: deepcopy(reference[k]) for k in ['label', 'note', 'statusResistance']}}
                variant['sourceIds'] = list(dict.fromkeys([*variant['sourceIds'], 'ledger-status']))
            if boss['id'] == 'mimic_tears':
                variant['labelZh'] = '泪滴形态 · 大教堂' if variant['npcParamId'] == 33201110 else '山妖形态 · 大教堂'
                variant['context'] = 'great-church'
            if boss['id'].startswith('demon_prince_') and variant['statusEvidence']:
                variant['statusEvidence']['note'] = '来源为恶魔王子共用异常资料，未独立区分两条分支。'
            if variant['npcParamId'] in (50700010, 50701010) and variant['statusEvidence']:
                variant['statusEvidence']['note'] = '来源为死骑士组合共用异常资料，未按武器类型分列。'
        if boss['variants']:
            primary = boss['variants'][0]
            for k in ['statusResistance', 'statusEvidence', 'statusReference']:
                boss[k] = deepcopy(primary[k])
            boss['sourceIds'] = list(dict.fromkeys([*boss['sourceIds'], *primary['sourceIds']]))
            if any(v is not None for v in boss['statusResistance'].values()):
                boss['notes'] = [n for n in boss['notes'] if '缺少此实体异常阈值' not in n]
            if boss['id'] == 'mimic_tears':
                boss['sourceContext'] = primary['context']
                boss['incompleteGroup'] = True
                boss['notes'] = [n for n in boss['notes'] if '仿身/变形与组合个体未完整核验' not in n]
                boss['notes'].append('泪滴与山妖采用两条独立黑夜君临NPC参数，异常阈值按来源同名成员补充；实际成员与变形关系尚未完整核验，暂不按单一形态自动推荐整个遭遇。未使用法环本体仿身泪滴数值。')
    data['coverage'].update(
        entitiesWithCompleteStatus=sum(all(v is not None for v in b['statusResistance'].values()) for b in data['bosses']),
        statusFieldsMissing=sum(v is None for b in data['bosses'] for v in b['statusResistance'].values()),
        statusFieldsSupplemented=filled,
    )
    data['definitions']['statusResistance']['description'] += ' 缺失项可按对应黑夜君临专用表补充，statusEvidence保留来源；其他场景参考不参与人数换算。'
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-js', required=True, type=Path)
    args = parser.parse_args()
    result = refresh(args.source_js)
    print(json.dumps({'rows': len(result['rows']), 'references': len(result['references'])}))
