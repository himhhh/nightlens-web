#!/usr/bin/env python3
"""Build an auditable combat catalogue from pinned, public Nightreign param facts.

Normal (offline): python3 tools/import_boss_combat.py
Refresh facts: python3 tools/import_boss_combat.py --source-python /tmp/Enemy.py --names-python /tmp/Names.py
Only Python literals are read with ast.literal_eval; downloaded Python is never executed.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools/data/boss-combat/nightreign-npc-extract.json'
OUTPUT = ROOT / 'web_app/assets/data/boss-combat.json'
COMMIT = '399c0cc243cefb02d002e272eb636372c2ea4a60'
BASE = f'https://github.com/dash512/Nightreign-Calculator/blob/{COMMIT}/'
DAMAGE = {'standard':'Neutral', 'strike':'Strike', 'slash':'Slash', 'pierce':'Thrust', 'magic':'Magic', 'fire':'Fire', 'lightning':'Lightning', 'holy':'Holy'}
STATUS = {'poison':'Poison', 'scarletRot':'Rot', 'bleed':'Bleed', 'frostbite':'Frostbite', 'sleep':'Sleep', 'madness':'Madness', 'deathBlight':'Blight'}
# Explicit identity mapping. No fuzzy matching, and no Elden Ring or Dark Souls stats.
# First row is the displayed representative; variants are retained with separate param IDs.
ENTITIES = {
'ancestor_spirit': ('Ancestor Spirit','祖灵',[46700010]),
'ancient_dragon': ('Ancient Dragon','古龙',[45101110,45102010]),
'ancient_hero_of_zamor': ('Ancient Hero of Zamor','萨米尔的古英雄',[71000010,71000020,71000110]),
'artorias': ('Knight Artorias','骑士亚尔特留斯',[77200010]),
'astel': ('Astel','黑暗弃子',[46200010]),
'banished_knight_shield': ('Banished Knight (Shield)','失乡骑士（剑盾）',[30100190,30100010]),
'banished_knight_dual_swords': ('Banished Knight (Dual Swords)','失乡骑士（双剑）',[30101110,30101010]),
'banished_knight_halberd': ('Banished Knight (Halberd)','失乡骑士（戟）',[30102130,30102010]),
'battlefield_commander': ('Battlefield Commander','战场宿将',[30500110,30500100]),
'beastly_brigade': ('Beastly Brigade','野兽军团',[]),
'beastmen_of_farum_azula': ('Beastmen of Farum Azula','法姆·亚兹拉的兽人',[39701110,39702310,39703010]),
'bell_bearing_hunter': ('Bell Bearing Hunter','铃珠猎人',[31000010,31000020,31000030]),
'black_blade_kindred': ('Black Blade Kindred','黑剑眷属',[47701210]),
'black_knife_assassin': ('Black Knife Assassin','黑刀刺客',[21000020,21000030,21000040]),
'bloodbane_giant_crows': ('Bloodbane Giant Crow','血咒巨鸦',[45610010]),
'bloodhound_knight': ('Bloodhound Knight','猎犬骑士',[42900010,42900030]),
'centipede_demon': ('Centipede Demon','百足恶魔',[77100010]),
'chief_bloodfiend': ('Chief Bloodfiend','血怪首领',[50810020,50810010]),
'chief_purple_fiend': ('Chief Purple Fiend','紫血怪首领',[50811010]),
'cleanrot_knights': ('Cleanrot Knight','尊腐骑士',[38000010]),
'crucible_knight_sword': ('Crucible Knight (Sword)','熔炉骑士（剑）',[25000020,25000030,25000040]),
'crucible_knight_spear': ('Crucible Knight (Treespear)','熔炉骑士（矛）',[25001020,25001030]),
'crystalian_ringblade': ('Crystalian (Ringblade)','结晶人（环刃）',[33500010,33500020]),
'crystalian_spear': ('Crystalian (Spear)','结晶人（矛）',[33501010]),
'crystalian_staff': ('Crystalian (Staff)','结晶人（杖）',[33502010]),
'curseblade': ('Curseblade','咒剑士',[50400120,50400020,50400010]),
'dancer_of_the_boreal_valley': ('Dancer of the Boreal Valley','冷冽谷的舞娘',[79200010]),
'dancing_lion': ('Divine Beast Dancing Lion','神兽舞狮',[52100010]),
'death_knight_twinaxes': ('Death Knight (Twinaxes)','死骑士（双斧）',[50700010,50700020]),
'death_knight_longhaft_axe': ('Death Knight (Longhaft Axe)','死骑士（长柄斧）',[50701010]),
'death_rite_bird': ('Death Rite Bird','死亡仪式鸟',[49801020,49801010,49801030]),
'demi_human_queen': ('Demi-Human Queen','亚人女王',[41300020,41301010,41300030]),
'demi_human_swordmaster': ('Demi-Human Swordmaster','亚人剑圣',[58100910,58100920]),
'demon_from_below': ('Demon from Below','洞底恶魔',[79300010]),
'demon_in_pain': ('Demon in Pain','负伤恶魔',[79300110]),
'demon_prince_below': ('Demon Prince (Demon from Below)','恶魔王子（洞底恶魔分支）',[79301010]),
'demon_prince_pain': ('Demon Prince (Demon in Pain)','恶魔王子（负伤恶魔分支）',[79301110]),
'divine_beast_warrior': ('Divine Beast Warrior','神兽战士',[52501220,52501210]),
'draconic_tree_sentinel': ('Draconic Tree Sentinel','龙装大树守卫',[32500090,32500110]),
'royal_cavalrymen': ('Royal Cavalrymen','王城骑兵',[43531110,43531400]),
'dragonkin_soldier': ('Dragonkin Soldier','龙人士兵',[46500010,46500210,46500230]),
'dukes_dear_freja': ("The Duke's Dear Freja",'公爵的夫雷迪亚',[78000010]),
'elder_inquisitor': ('Elder Inquisitor','老年拷问官',[53120010]),
'elder_lion': ('Elder Lion','老狮子',[42700020,42700030,42700040]),
'erdtree_avatar': ('Erdtree Avatar','黄金树的化身',[48100010]),
'fallingstar_beast': ('Fallingstar Beast','坠星成兽',[46809010,46801020,46801010]),
'fire_prelates': ('Fire Prelate','火焰主教',[39100140,39101120]),
'flying_dragon': ('Flying Dragon','飞龙',[45000010]),
'gaping_dragon': ('Gaping Dragon','贪食魔龙',[77000010]),
'ghostflame_dragon': ('Ghostflame Dragon','灵火龙',[58600010]),
'giant_crabs': ('Giant Crab','巨蟹',[22700100]),
'giant_crows': ('Giant Crow','巨鸦',[45601020]),
'godskin_apostle': ('Godskin Apostle','神皮使徒',[35600010,35600020,35600110]),
'godskin_noble': ('Godskin Noble','神皮贵族',[35700010,35700020,35700110]),
'golden_hippopotamus': ('Golden Hippopotamus','黄金河马',[50110010,50110020,50110040]),
'grafted_monarch': ('Grafted Monarch','接肢君王',[47509010]),
'grafted_scion': ('Grafted Scion','接肢贵族后裔',[46900010,46900020]),
'grave_warden_duelist': ('Grave Warden Duelist','守墓斗士',[34001010]),
'great_red_bear': ('Great Red Bear','大红熊',[58200010]),
'great_wyrm': ('Great Wyrm','大土龙',[49110010]),
'headless_troll': ('Headless Troll','无头山妖',[46000230,46000220]),
'inquisitor': ('Inquisitor','拷问官',[53200010]),
'leonine_misbegotten': ('Leonine Misbegotten','狮子混种',[34600020,34600010,34600040]),
'magma_wyrm': ('Magma Wyrm','熔岩土龙',[49100190,49100120]),
'mimic_tears': ('Mimic Tears','仿身泪滴',[33201110,46000040]),
'miranda_blossom': ('Miranda Blossom','米兰达花',[44800020,44800410]),
'mohg': ('Mohg, Lord of Blood','鲜血君王蒙格',[48000010]),
'morgott': ('Fell Omen (Morgott)','恶兆妖鬼',[21300510,21300010]),
'mountaintop_ice_dragon': ('Mountaintop Ice Dragon','雪山冰龙',[45030010]),
'nameless_king': ('Nameless King','无名王者',[79000010,79000020]),
'king_of_the_storm': ('King of the Storm','风暴之王',[]),
'nights_cavalry_glaive': ("Night's Cavalry (Glaive)",'黑夜骑兵（长柄刀）',[31500010,31500020]),
'nights_cavalry_flail': ("Night's Cavalry (Flail)",'黑夜骑兵（连枷）',[31501020]),
'nox_monk': ('Nox Monk','诺克斯修士',[33000020]),
'nox_swordstress': ('Nox Swordstress','诺克斯剑士',[33001020]),
'omen': ('Omen','恶兆之子',[21400210]),
'outland_commander': ('Outland Commander','偏地老将',[30500010]),
'putrid_avatar': ('Putrid Avatar','腐败化身',[]),
'red_wolf': ('Red Wolf','红狼',[31810010,31810020]),
'royal_carian_knight': ('Royal Carian Knight','卡利亚禁卫骑士',[32520010]),
'royal_revenant': ('Royal Revenant','王室幽魂',[40210010,40210020,40210030]),
'smelter_demon': ('Smelter Demon','熔铁恶魔',[78200010]),
'snowfield_trolls': ('Snowfield Troll','雪原山妖',[46020030,46020050]),
'spider_scorpions': ('Spider Scorpion','蜘蛛蝎',[51920010,51920020]),
'spiritcaller_snail': ('Spiritcaller Snail','唤灵蜗牛',[41402210]),
'alabaster_lord': ('Alabaster Lord','白王',[36000020]),
'onyx_lord': ('Onyx Lord','黑王',[36001020]),
'tibia_mariner': ('Tibia Mariner','提比亚的唤声船',[49500010]),
'tree_sentinel': ('Tree Sentinel','大树守卫',[32510020,32510110]),
'ulcerated_tree_spirit': ('Ulcerated Tree Spirit','腐烂树灵',[46400010,46400020]),
'valiant_gargoyle': ('Valiant Gargoyle','英雄石像鬼',[47700020,47701030]),
'wormface': ('Wormface','蚯蚓脸',[45803010,45803020]),
# Nightlords: normal and Everdark are distinct records. Deep of Night effects are not included.
'gladius': ('Gladius, Beast of Night','三头野兽',[75000020]),
'gladius_everdark': ('Gladius (Everdark Sovereign)','三头野兽（永夜王）',[75000210]),
'adel': ('Adel, Baron of Night','贪食巨颚',[75100020]),
'adel_everdark': ('Adel (Everdark Sovereign)','贪食巨颚（永夜王）',[75110010]),
'gnoster': ('Gnoster, Wisdom of Night','慧心虫（飞蛾）',[75200020,75200110]),
'gnoster_everdark': ('Gnoster (Everdark Sovereign)','慧心虫（永夜王·飞蛾）',[75200120,75200030]),
'faurtis': ('Faurtis Stoneshield','慧心虫（蝎子）',[75300010,75300110]),
'faurtis_everdark': ('Faurtis (Everdark Sovereign)','慧心虫（永夜王·蝎子）',[75300120,75300020]),
'animus_everdark': ('Animus, Ascendant Light','慧心虫（永夜王·光虫）',[75210010]),
'maris': ('Maris, Fathom of Night','征兆',[75400020]),
'maris_everdark': ('Maris (Everdark Sovereign)','征兆（永夜王）',[75400100,75410000]),
'libra': ('Libra, Creature of Night','平衡律法的魔物',[75600020]),
'libra_everdark': ('Libra (Everdark Sovereign)','平衡律法的魔物（永夜王）',[75610010]),
'fulghor': ('Fulghor, Champion of Nightglow','暗中飞驰的猎人',[76000010]),
'fulghor_everdark': ('Fulghor (Everdark Sovereign)','暗中飞驰的猎人（永夜王）',[76001010]),
'caligo': ('Caligo, Miasma of Night','雾中裂缝',[49000010]),
'caligo_everdark': ('Caligo (Enhanced Boss)','雾中裂缝（永夜王）',[49010010]),
'heolstor': ('Heolstor, the Nightlord','黑夜化形者',[75800000,75809000]),
'straghess': ('Straghess','废弃物之王',[76100010,76109000]),
'harmonia_halberd': ('Harmonia (Halberd)','安定者（戟）',[76200010]),
'harmonia_spear': ('Harmonia (Spear)','安定者（矛）',[76200040]),
'harmonia_mace': ('Harmonia (Mace)','安定者（锤）',[76200070]),
'harmonia_everdark_halberd': ('Harmonia (Everdark; Halberd)','安定者（永夜王·戟）',[76200210]),
'harmonia_everdark_spear': ('Harmonia (Everdark; Spear)','安定者（永夜王·矛）',[76200240]),
'harmonia_everdark_mace': ('Harmonia (Everdark; Mace)','安定者（永夜王·锤）',[76200270]),
}
GROUPS = {
'godskin_duo':['godskin_apostle','godskin_noble'],
'banished_knights':['banished_knight_shield','banished_knight_dual_swords','banished_knight_halberd'],
'crucible_knight_and_golden_hippopotamus':['crucible_knight_sword','golden_hippopotamus'],
'crucible_knight_hippo':['crucible_knight_sword','golden_hippopotamus'],
'crucible_knight_with_spear':['crucible_knight_spear'], 'crucible_knight_with_sword':['crucible_knight_sword'],
'crucible_knights':['crucible_knight_sword','crucible_knight_spear'],
'crystalians':['crystalian_ringblade','crystalian_spear','crystalian_staff'],
'dancer':['dancer_of_the_boreal_valley'],
'dbw_and_curseblade':['divine_beast_warrior','curseblade'], 'dbw_curseblade':['divine_beast_warrior','curseblade'],
'death_knights':['death_knight_twinaxes','death_knight_longhaft_axe'],
'demi_human_queen_and_swordmaster':['demi_human_queen','demi_human_swordmaster'],
'demihuman_queen_swordmaster':['demi_human_queen','demi_human_swordmaster'],
'demon_prince':['demon_prince_below','demon_prince_pain'], 'demons':['demon_from_below','demon_in_pain'],
'draconic_tree_sentinel_and_royal_cavalrymen':['draconic_tree_sentinel','royal_cavalrymen'],
'duke_s_dear_freja':['dukes_dear_freja'],
'nameless_king':['nameless_king','king_of_the_storm'],
'night_s_cavalries':['nights_cavalry_glaive','nights_cavalry_flail'],
'nights_cavalry':['nights_cavalry_glaive'], 'nights_cavalry_duo':['nights_cavalry_glaive','nights_cavalry_flail'],
'nox_warriors':['nox_monk','nox_swordstress'], 'stoneskin_lords':['alabaster_lord','onyx_lord'],
'tree_sentinel_and_royal_cavalrymen':['tree_sentinel','royal_cavalrymen'],
}
NIGHTLORDS = {'Gladius':['gladius'],'Adel':['adel'],'Gnoster':['gnoster','faurtis'],'Maris':['maris'],'Libra':['libra'],'Fulghor':['fulghor'],'Caligo':['caligo'],'Heolstor':['heolstor'],'Straghess':['straghess'],'Harmonia':['harmonia_halberd','harmonia_spear','harmonia_mace']}
MODEL_NAMES = {7700:'Gaping Dragon',7710:'Centipede Demon',7800:"The Duke's Dear Freja",7820:'Smelter Demon',7900:'Nameless King',7920:'Dancer of the Boreal Valley'}


def literals(path):
    return {n.targets[0].id: ast.literal_eval(n.value) for n in ast.parse(path.read_text()).body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)}


def refresh(source, names):
    data = literals(source)
    ids = sorted({i for _,_,rows in ENTITIES.values() for i in rows})
    facts = {'upstreamCommit':COMMIT, 'upstreamSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'rows':{}, 'modelNames':{}}
    for i in ids:
        stat = data['Stats'][i]
        facts['rows'][str(i)] = {'type':stat['Type'], 'damageTaken':{k:stat.get(v+' Damage Taken') for k,v in DAMAGE.items()}, 'statusResistance':{k:data['Resistances'].get(i,{}).get(v) for k,v in STATUS.items()}}
    if names:
        character = literals(names)['Character']
        for model,name in MODEL_NAMES.items():
            matches = [v for k,v in character.items() if str(k).startswith('90'+str(model))]
            if name not in matches:
                raise ValueError(f'Model name missing: {model} {name}: {matches}')
            facts['modelNames'][str(model)] = {'name':name, 'evidenceNames':matches, 'identityMethod':'NPC model prefix joined to Character FMG model-prefix name; explicit curated mapping'}
        facts['namesSha256']=hashlib.sha256(names.read_bytes()).hexdigest()
    CACHE.parent.mkdir(parents=True,exist_ok=True)
    CACHE.write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n')


def variant_context(label):
    lower=label.lower()
    if 'everdark' in lower or 'enhanced boss' in lower: return 'everdark', '永夜王'
    if 'night boss' in lower or 'night group boss' in lower: return 'night', '夜间首领'
    if 'field boss' in lower: return 'field', '野外首领'
    if 'castle' in lower: return 'castle', '城堡'
    if 'evergaol' in lower or 'oldest gaol' in lower: return 'evergaol', '封印监牢'
    if 'remembrance' in lower: return 'remembrance', '追忆'
    if 'phase 1' in lower: return 'phase-1', '第一阶段'
    if 'phase 2' in lower: return 'phase-2', '第二阶段'
    if '(boss)' in lower: return 'boss', '首领基础参数'
    if 'ruins' in lower: return 'ruins', '遗迹'
    if 'noklateo' in lower: return 'noklateo', '隐城'
    if 'crater' in lower: return 'crater', '火山'
    if 'mountaintop' in lower: return 'mountaintop', '雪山'
    return 'base', '基础参数'


def build():
    facts=json.loads(CACHE.read_text())
    if facts['upstreamCommit'] != COMMIT: raise ValueError('Wrong upstream revision')
    sources=[
        {'id':'nr-param','title':'Aero / dash512 Nightreign Calculator · 游戏参数提取','url':BASE+'Nightreign/Enemy.py','game':'nightreign','kind':'game-param-extract','commit':COMMIT,'retrievedAt':'2026-10-20','sha256':facts['upstreamSha256'],'upstreamLicense':'GPL-3.0','version':'仓库固定提交；上游未声明对应游戏补丁版本'},
        {'id':'nr-names','title':'Nightreign Calculator · Character FMG 名称','url':BASE+'Nightreign/Names.py','game':'nightreign','kind':'game-name-extract','commit':COMMIT},
        {'id':'nr-author','title':'Aero 原作者说明：仓库包含游戏提取数据','url':'https://www.nexusmods.com/eldenringnightreign/mods/622','game':'nightreign','kind':'author-methodology'},
        {'id':'observer-catalog','title':'Nightreign Seed Finder · 布局与首领名录','url':'https://nightreign-seed-finder.com','game':'nightreign','kind':'encounter-names-only'},
        {'id':'zh-crosscheck','title':'巴哈姆特：黑夜君臨 BOSS 抗性表（贴吧作者授权转载）','url':'https://forum.gamer.com.tw/C.php?bsn=36726&snA=14848','game':'nightreign','kind':'community-crosscheck-only'},
        {'id':'zh-data-browser','title':'神奇妙妙动物园 · 黑夜君临数据一览','url':'https://elden.dingdangmarket.com/data-browser','game':'nightreign','kind':'community-crosscheck-only'},
        {'id':'wiki-crosscheck','title':'Eldenpedia · Nightreign:Enemies','url':'https://eldenring.wiki.gg/wiki/Nightreign:Enemies','game':'nightreign','kind':'wiki-crosscheck-only'},
    ]
    bosses=[]
    for id,(en,zh,rows) in ENTITIES.items():
        variants=[]
        for npc in rows:
            row=facts['rows'][str(npc)]
            damage={k:round(100*(1-v),5) if v is not None else None for k,v in row['damageTaken'].items()}
            status={k:('immune' if v==999 else v) for k,v in row['statusResistance'].items()}
            label=row['type']
            if label == 'Unknown': label=f'{en} · 参数 {npc}（以角色模型编号关联名称）'
            context,label_zh=variant_context(row['type'])
            variants.append({'npcParamId':npc,'label':label,'labelZh':label_zh,'context':context,'damageNegation':damage,'statusResistance':status,'sourceIds':['nr-param'],'scope':'npc-param-base'})
        primary=variants[0] if variants else None
        notes=['显示 NpcParam 基础参数；未叠加深夜、联机、第二天或战斗中阶段特效。异常数值不是最终三人触发阈值。']
        if primary:
            notes.append('当前代表参数：'+primary['label']+'。')
            if len(variants)>1: notes.append('存在地点、武器或阶段参数变体，完整变体另存于 variants；请勿将代表行视为所有遭遇通用值。')
            if all(v is None for v in primary['statusResistance'].values()): notes.append('该版本提取表缺少此实体异常阈值，保留未知。')
        else: notes.append('尚无可信且能精确对应本遭遇的 Nightreign 数值，全部保留未知。')
        if id.startswith('crystalian_'): notes.append('结晶人破甲前后伤害不同；此处为基础参数，不代表破甲后的实战减伤。')
        if id=='mimic_tears': notes.append('仿身/变形与组合个体未完整核验，不套用法环本体仿身泪滴的数据。')
        if id=='king_of_the_storm': notes.append('无名王者坐骑的NPC名称对应关系尚未独立核验，未按相邻模型编号猜数值。')
        if id=='putrid_avatar': notes.append('不把黄金树化身的数值直接复制给腐败化身。')
        if id=='royal_cavalrymen': notes.append('以夜间王城骑士/灵体参数为成员资料；遭遇中骑兵数量、骑马状态及坐骑本身另计。')
        damage=primary['damageNegation'] if primary else dict.fromkeys(DAMAGE)
        status=primary['statusResistance'] if primary else dict.fromkeys(STATUS)
        ids=['nr-param'] if primary else ['observer-catalog']
        if rows and rows[0]//10000 in MODEL_NAMES: ids.append('nr-names')
        aliases=[en,zh]
        bosses.append({'id':id,'nameEn':en,'nameZh':zh,'aliases':aliases,'gameData':'nightreign' if primary else 'unknown','evidenceStatus':'param-extract' if primary else 'unknown','sourceIds':ids,'npcParamId':rows[0] if rows else None,'scope':'npc-param-base','sourceVariant':primary['label'] if primary else None,'sourceContext':primary['context'] if primary else None,'damageNegation':damage,'statusResistance':status,'weaknesses':[k for k,v in damage.items() if v is not None and v<0],'relativeWeaknesses':[k for k,v in damage.items() if v is not None and v==min(x for x in damage.values() if x is not None)] if primary else [],'variants':variants,'notes':notes})
    catalogue=json.loads((ROOT/'web_app/assets/data/map-intel.json').read_text())['bossCatalog']
    encounters=[]
    for item in catalogue:
        key=item['key']; members=GROUPS.get(key,[key])
        if any(m not in ENTITIES for m in members):raise ValueError(f'Unmapped encounter {key}: {members}')
        encounters.append({'id':key,'nameEn':item['name'],'aliases':list(dict.fromkeys([key,item['name'],*item.get('aliases',[])])),'bossIds':members,'sourceIds':['observer-catalog'],'memberMode':'branches' if key=='demon_prince' else 'members','notes':['组合列出各个实体；不把多人首领合并成一套抗性。'] if len(members)>1 else []})
    for key,members in NIGHTLORDS.items():
        encounters.append({'id':key,'nameEn':key,'aliases':[key,key.lower()],'bossIds':members,'sourceIds':['nr-param'],'memberMode':'members','notes':[]})
        ed=[m.replace('harmonia_','harmonia_everdark_') for m in members] if key=='Harmonia' else [m+'_everdark' for m in members]
        if key=='Gnoster':ed.append('animus_everdark')
        if all(m in ENTITIES for m in ed):encounters.append({'id':key+'_everdark','nameEn':key+' (Everdark Sovereign)','aliases':['e'+key,key+'_everdark'],'bossIds':ed,'sourceIds':['nr-param'],'memberMode':'members','notes':[]})
    bosses_by_id={b['id']:b for b in bosses}
    result={'version':'1.0.0','generatedAt':'2026-10-20','gameVersion':None,'sourceRevision':COMMIT,'definitions':{
        'damageNegation':{'unit':'percent','formula':'100 × (1 − incoming damage multiplier)','description':'正值为减伤，0 为中性，负值为额外承伤；不等于最终伤害（另有防御、部位、增益）。'},
        'statusResistance':{'unit':'base-buildup-points','description':'NpcParam 首次异常积累基础阈值；immune=提取表999免疫标记，null=缺失。未应用联机/深夜/阶段或重复触发增长，不是百分比。'},
        'weaknesses':'仅列出减伤<0的真实负抗；relativeWeaknesses是同一实体八项中的最低值，即使最低值仍为正也只叫相对较低减伤。',
        'unknown':'null 一律为未知，不等于0；gameData=unknown时不可标称已核验Nightreign数值。',
        'variants':'保留精确NPC参数行与场景名称；代表行由人工选择，查询可用npcParamId指定其他行。',
        'limitations':['上游未声明游戏补丁版本，不能宣称匹配当前1.03.2布局版本。','无 Elden Ring 本体或 Dark Souls 原版数值混入；未来fallback必须单独标记gameData=elden-ring。','部分DLC实体只有伤害承受倍率，没有异常阈值。','未计算战斗中的身体部位倍率、护盾、破甲或阶段临时buff。']},'sources':sources,'coverage':{'mapEncounterNames':len(catalogue),'mappedMapEncounterNames':len(catalogue),'mapEncounterNamesWithDamage':sum(any(bosses_by_id[m]['npcParamId'] for m in GROUPS.get(c['key'],[c['key']])) for c in catalogue),'entities':len(bosses),'entitiesWithDamage':sum(bool(b['npcParamId']) for b in bosses),'entitiesWithAnyStatus':sum(any(v is not None for v in b['statusResistance'].values()) for b in bosses),'unknownEntities':[b['id'] for b in bosses if not b['npcParamId']],'eldenRingFallbackEntities':0},'bosses':bosses,'encounters':encounters}
    from supplement_boss_combat import enrich_combat
    result=enrich_combat(result)
    OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['coverage'],ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source-python',type=Path);parser.add_argument('--names-python',type=Path)
    args=parser.parse_args()
    if args.source_python: refresh(args.source_python,args.names_python)
    build()
