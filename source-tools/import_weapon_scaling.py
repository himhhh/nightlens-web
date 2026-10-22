"""Import public numeric parameter snapshots; never execute downloaded JavaScript."""
from pathlib import Path
import hashlib
import json
import re
import json5

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT/'assets/source/catalog-expansion'
OUTPUT = ROOT/'web_app/assets/data'
CHARACTERS = {'Wylder':'Fe','Guardian':'he','Ironeye':'ye','Duchess':'Me','Raider':'me','Revenant':'be','Recluse':'Se','Executor':'Xe','Scholar':'ve','Undertaker':'fe'}
ATTRS = ['VIG','MND','END','STR','DEX','INT','FAI','ARC']
DAMAGE = {'Phys':'standard','Magic':'magic','Fire':'fire','Thunder':'lightning','Lightning':'lightning','Holy':'holy'}
BASE = 'https://relics.pro/assets/'

def literal(source, name):
    match = re.search(r'(?<![\w$])'+re.escape(name)+r'=\{', source)
    if not match:
        raise ValueError('Missing literal: '+name)
    start = source.index('{', match.start())
    depth, quote, escaped = 0, None, False
    for i in range(start, len(source)):
        char = source[i]
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
        elif char in '\"\'':
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                value = source[start:i+1]
                value = re.sub(r'([,{])(\d+(?:e[+-]?\d+)?):', lambda m: m[1]+json.dumps(str(int(float(m[2]))))+':', value)
                return json5.loads(value.replace('!0', 'true').replace('!1', 'false'))
    raise ValueError('Incomplete literal: '+name)

def write(name, data):
    (OUTPUT/name).write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')

def damage_map(values):
    return {DAMAGE[k]:v for k,v in values.items() if k in DAMAGE}

def build():
    source = (CACHE/'scaling-relics-AttackPowerTab.js').read_text()
    weapon_source = (CACHE/'scaling-relics-weapons-dSd6emJz.js').read_text()
    wiki = json.loads((CACHE/'scaling-wikigg-attributes.json').read_text())
    names = {c['name']['engus']:c['name']['zhocn'] for c in json.loads((CACHE/'scaling-characters.json').read_text())}
    references = [
        {'id':'relics-scaling','title':'Relics.pro · 渡夜者逐级能力值与武器攻击参数','url':'https://relics.pro/compendium/attack-power'},
        {'id':'eldenpedia-attributes','title':'Eldenpedia · 渡夜者逐级能力值（交叉参考）','url':'https://eldenring.wiki.gg/wiki/Nightreign:Attributes?oldid='+str(wiki['revision'])},
    ]
    fingerprints = {name:hashlib.sha256((CACHE/name).read_bytes()).hexdigest() for name in ['scaling-relics-AttackPowerTab.js','scaling-relics-weapons-dSd6emJz.js','scaling-wikigg-attributes.json']}
    characters = []
    for name, variable in CHARACTERS.items():
        levels = literal(source, variable)
        if set(levels) != set(map(str,range(1,16))):
            raise ValueError('Incomplete level table: '+name)
        table = next(t for t in wiki['tables'] if t.get('heading') == name and 'Pre-' not in (t.get('caption') or ''))
        differences = {}
        for row in table['rows'][2:]:
            level = str(int(re.search(r'\d+',row[0]).group()))
            alternative = {key:int(value) for key,value in zip(ATTRS,row[1:9])}
            diff = {key:{'used':levels[level][key],'alternative':value} for key,value in alternative.items() if levels[level][key] != value}
            if diff:
                differences[level] = diff
        characters.append({'id':name,'nameZh':names[name],'grades':dict(zip(ATTRS,table['rows'][1][1:9])),'levels':levels,'sourceDifferences':differences})
    common = {'version':1,'snapshotDate':'2026-10-21','sources':references,'inputHashes':fingerprints,'notice':'采用 Relics.pro 的完整逐级参数快照；不同社区表有差异时保留差异记录，不插值或拼接成未经证实的逐级数据。补丁号尚未由原始游戏文件独立核验。'}
    write('nightfarers.json', {**common,'characters':characters})

    weapons = literal(weapon_source, re.search(r'const (\w+)=\{',weapon_source).group(1))
    catalog = json.loads((OUTPUT/'weapons.json').read_text())
    models = {}
    for weapon in catalog['weapons']:
        for variant in weapon['variants']:
            raw = weapons.get(str(variant['id']))
            if not raw:
                continue
            models[str(variant['id'])] = {'attack':damage_map(raw['baseDamage']),'scaling':raw['scaling'],'graphs':damage_map(raw['correctType']),'elementCorrect':int(raw['attackElementCorrectId']),'reinforceType':int(raw['reinforceTypeId'])}
    reinforce = {key:{'attack':damage_map(row['elementRate']),'scaling':row['statRate']} for key,row in literal(source,'pe').items()}
    elements = {key:{'enabled':damage_map(row['enabled']),'overwrite':damage_map(row['overwriteRate'])} for key,row in literal(source,'ke').items()}
    graphs = {key:row['breakpoints'] for key,row in literal(source,'we').items()}
    write('weapon-scaling.json', {**common,'weapons':models,'reinforce':reinforce,'elements':elements,'graphs':graphs})
    print('已整理',len(characters),'位渡夜者的150条等级记录，以及',len(models),'个武器变体的补正参数；未编译或运行 App 测试。')

if __name__ == '__main__':
    build()
