"""Apply pinned, explicitly matched supplemental facts. No downloaded code is executed."""
import json
from pathlib import Path

def enrich_combat(data):
    facts=json.loads((Path(__file__).parent/'data/boss-combat/supplement-2026-10-20.json').read_text())
    data['sources'].extend(facts['sources']);data['playerScaling']=facts['playerScaling']
    data['bosses']=[b for b in data['bosses'] if b['id']!='heolstor_everdark']
    for b in data['bosses']:
        old=b['nameZh'];b['nameZh']=facts['names'].get(b['id'],old).replace('常夜王','永夜王')
        b['aliases']=list(dict.fromkeys([*b['aliases'],old,b['nameZh']]))
        for v in b['variants']:
            v.update(facts['rows'].get(str(v['npcParamId']),{}))
            patch=facts['patches'].get(str(v['npcParamId']))
            if patch:
                for k,value in patch['statusResistance'].items():v['statusResistance'][k]=value
                v['sourceIds']=list(dict.fromkeys([*v['sourceIds'],*patch['sourceIds']]))
                if patch.get('labelZh'):v['labelZh']=patch['labelZh']
                if patch['note'] not in b['notes']:b['notes'].append(patch['note'])
            v['labelZh']=v['labelZh'].replace('常夜王','永夜王')
        patch=facts['patches'].get(b['id'])
        if patch:
            v={'npcParamId':None,'label':'NightreignQuickRef · King of the Storm','labelZh':'第二夜 · 坐骑','context':patch['context'],'damageNegation':patch['damageNegation'],'statusResistance':dict.fromkeys(b['statusResistance']),'basePoise':patch['basePoise'],'sourceIds':patch['sourceIds'],'scope':'named-community-table'}
            v['statusResistance'].update(patch['statusResistance']);b['variants']=[v];b['gameData']='nightreign';b['evidenceStatus']='named-community-table';b['notes']=[patch['note']]
        if b['variants']:
            primary=b['variants'][0]
            for k in ['damageNegation','statusResistance','healthByPlayers','basePoise']:
                if k in primary:b[k]=primary[k]
            b['sourceIds']=list(dict.fromkeys([*b['sourceIds'],*primary['sourceIds']]))
            b['sourceVariant']=primary['label'];b['sourceContext']=primary['context']
            damage=b['damageNegation'];known=[v for v in damage.values() if v is not None]
            b['weaknesses']=[k for k,v in damage.items()if v is not None and v<0]
            b['relativeWeaknesses']=[k for k,v in damage.items()if v is not None and v==min(known)] if known else []
        b['notes']=[n.replace('常夜王','永夜王').replace('未叠加深夜、联机、第二天或战斗中阶段特效。异常数值不是最终三人触发阈值。','基础行未叠加深夜、第二天或战斗中临时特效；人数换算在界面单独计算。')for n in b['notes']if not('缺少此实体异常阈值' in n and any(v is not None for v in b['statusResistance'].values()))]
    ledger=json.loads((Path(__file__).parent/'data/boss-combat/ledger-2026-10-21.json').read_text())
    data['sources'].append(ledger['source'])
    for b in data['bosses']:
        patch=ledger['patches'].get(b['id'])
        if not patch:continue
        b['aliases']=list(dict.fromkeys([*b['aliases'],b['nameZh'],patch['nameZh']]))
        b['nameZh']=patch['nameZh'];b['variants']=patch['variants'];b['incompleteGroup']=patch.get('incompleteGroup',False)
        primary=b['variants'][0];b.update({k:primary[k] for k in ['damageNegation','statusResistance','healthByPlayers','basePoise']})
        b.update(gameData='nightreign',evidenceStatus='named-community-table',sourceIds=['nightfarer-ledger'],sourceVariant=primary['label'],sourceContext=primary['context'],notes=patch['notes'],variantKey=primary['variantKey'])
        damage=b['damageNegation'];known=[v for v in damage.values() if v is not None]
        b['weaknesses']=[k for k,v in damage.items() if v is not None and v<0];b['relativeWeaknesses']=[k for k,v in damage.items() if v is not None and v==min(known)]
    profiles=json.loads((Path(__file__).parent/'data/boss-combat/special-weaknesses.json').read_text())
    data['specialNightlordWeaknesses']=profiles
    members={'Gladius':['gladius'],'Adel':['adel'],'Gnoster':['gnoster','faurtis'],'Maris':['maris'],'Libra':['libra'],'Fulghor':['fulghor'],'Caligo':['caligo'],'Harmonia':['harmonia_halberd','harmonia_spear','harmonia_mace']}
    for key,profile in profiles.items():
        data['sources'].append(profile['source'])
        for b in data['bosses']:
            if b['id'] not in members[key]:continue
            b['specialWeakness']=profile;b['sourceIds'].append(profile['source']['id'])
            for v in b['variants']:v['sourceIds']=list(dict.fromkeys([*v['sourceIds'],profile['source']['id']]))
    from import_status_resistances import enrich_status
    data = enrich_status(data)
    bosses={b['id']:b for b in data['bosses']};known=lambda b:any(isinstance(v,(int,float))for v in b['damageNegation'].values())
    data['coverage'].update(entities=len(bosses),entitiesWithDamage=sum(known(b)for b in bosses.values()),entitiesWithAnyStatus=sum(any(v is not None for v in b['statusResistance'].values())for b in bosses.values()),unknownEntities=[b['id']for b in bosses.values()if not known(b)],mapEncounterNamesWithDamage=sum(any(known(bosses[k])for k in e['bossIds'])for e in data['encounters']if e['id'] in {x['id']for x in data['encounters'][:data['coverage']['mapEncounterNames']]}))
    data['definitions']['limitations']=[x for x in data['definitions']['limitations'] if '部分DLC实体' not in x]+['部分实体仍缺少异常阈值，已补充的数据保留逐项来源与阶段。']
    data['version']='1.2.0';data['generatedAt']='2026-10-22';return data
