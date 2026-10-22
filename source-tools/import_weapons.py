"""Build a Chinese Nightreign armament catalogue from pinned public facts."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
TYPES={'Dagger':'短剑','Straight Sword':'直剑','Greatsword':'大剑','Colossal Sword':'特大剑','Thrusting Sword':'刺剑','Heavy Thrusting Sword':'重刺剑','Curved Sword':'曲剑','Curved Greatsword':'大曲剑','Katana':'刀','Twinblade':'双头剑','Hammer':'槌','Great Hammer':'大槌','Flail':'连枷','Axe':'斧','Greataxe':'大斧','Colossal Weapon':'特大武器','Spear':'矛','Great Spear':'大矛','Halberd':'戟','Reaper':'镰刀','Whip':'软鞭','Fist':'拳头','Claw':'钩爪','Bow':'弓','Greatbow':'大弓','Crossbow':'弩','Ballista':'弩炮','Glintstone Staff':'手杖','Sacred Seal':'圣印记','Small Shield':'小盾','Medium Shield':'中盾','Greatshield':'大盾','Torch':'火把'}
ATTR={'Magic':'magic','Fire':'fire','Lightning':'lightning','Holy':'holy','Frostbite':'frostbite','Bleed':'bleed','Poison':'poison','Rot':'scarletRot','Sleep':'sleep','Madness':'madness'}
# Only explicit skill-name translations; other skills retain their source name.
SKILLS={'Moonlight Greatsword':'月光大剑','Night-and-Flame Stance':'夜与火的架式','Taker\'s Flames':'掠夺火焰','Wave of Gold':'黄金波动','Starcaller Cry':'唤星','Bloodboon Ritual':'授血仪式','Waterfowl Dance':'水鸟乱舞','Destined Death':'命定之死','Ancient Lightning Spear':'古雷枪','Eochaid\'s Dancing Blade':'欧赫剑舞','Golden Order':'高举黄金律法','Oath of Vengeance':'复仇誓言','Wave of Destruction':'崩坏波','Gold Breaker':'黄金碎击','Devourer of Worlds':'吞世','Nebula':'星云','Transient Moonlight':'隙间月影','Bloodhound\'s Finesse':'猎犬剑技','Dragon King\'s Cragblade':'雷云化身','Thundercloud Form':'雷云化身','Stormcaller':'唤起风暴','Quickstep':'碎步','Parry':'格挡','Buckler Parry':'小圆盾格挡','Stamp (Upward Cut)':'箭步（上砍）','Determination':'决心','Royal Knight\'s Resolve':'侍王骑士的决心','Spinning Slash':'回旋斩','Unsheathe':'居合','Spinning Weapon':'转啊转','Mists of Slumber':'催眠烟雾','Fires of Slumber':'催眠之火','Frenzyflame Thrust':'癫火突击','No Skill':'无战技','Kick':'踢击','Endure':'忍耐','Impaling Thrust':'贯穿','Square Off':'准备架式','War Cry':'战吼','Wild Strikes':'盲击'}
def build():
 f=json.loads((ROOT/'tools/data/weapons/facts.json').read_text());bless={}
 for entry in f['blessings']:bless.update(entry)
 # Community spelling variants are matched explicitly to the game's Simplified Chinese name.
 aliases={'玛莲妮亚的义手刀':['玛莲尼亚义手刃'],'狮子大弓':['狮子大弓'],'葛孚雷的王斧':['葛孚雷的王斧']}
 groups={}
 for a in f['rows']:
  gid=a['id']//10000*10000;group=groups.setdefault(gid,{'id':gid,'variants':[]})
  attack={k:a.get(v)for k,v in {'standard':'attackBasePhysics','magic':'attackBaseMagic','fire':'attackBaseFire','lightning':'attackBaseThunder','holy':'attackBaseHoly'}.items()}
  skill={**a['skill'],'nameZh':SKILLS.get(a['skill'].get('nameEn'))}
  physical={'Hammer':'strike','Great Hammer':'strike','Flail':'strike','Thrusting Sword':'pierce','Heavy Thrusting Sword':'pierce','Spear':'pierce','Great Spear':'pierce','Bow':'pierce','Greatbow':'pierce','Crossbow':'pierce','Ballista':'pierce','Katana':'slash','Curved Sword':'slash','Curved Greatsword':'slash','Claw':'slash','Reaper':'slash'}.get(a['type'],'standard')
  if a['name']['en']=='Warpick':physical='pierce'
  v={'id':a['id'],'nameZh':a['name']['zh'],'nameEn':a['name']['en'],'type':a['type'],'typeZh':TYPES[a['type']],'requiredLevel':a['requiredLevel'],'rarity':a['rarity'],'attack':attack,'scaling':{k:a[k]for k in ['STR','DEX','INT','FAI','ARC']},'guard':{k:a.get(v)for k,v in {'standard':'physGuardCutRate','magic':'magGuardCutRate','fire':'fireGuardCutRate','lightning':'thunGuardCutRate','holy':'holyGuardCutRate'}.items()},'guardStability':a['guardStability'],'poiseDamage':a['poiseDamage'],'reviveDamage':a['reviveDamage'],'criticalMultiplier':a['criticalMultiplier'],'attribute':('poison' if a['name']['en'].startswith('Poison ') else 'bleed' if a['name']['en'].startswith('Blood ') else 'frostbite' if a['name']['en'].startswith('Cold ') else ATTR.get(a['attribute'])),'extraAttributes':(['madness'] if a['id']==17050000 else ['sleep'] if a['id'] in [2190000,24040000] else []),'skill':skill,'physicalStyle':physical,'physicalStyleBasis':'weapon-class-reference; moves can differ','sourceIds':['armament','calculator']}
  group['variants'].append(v)
 for g in groups.values():
  g['variants'].sort(key=lambda v:v['id']);base=g['variants'][0];g.update({k:base[k]for k in ['nameZh','nameEn','type','typeZh','requiredLevel','rarity']});name=next((n for n in [g['nameZh'],*aliases.get(g['nameZh'],[])]if n in bless),None)
  g['blessing']=bless.get(name)if name else None
  if g['blessing']:g['sourceIds']=['armament','calculator','quickref']
  else:g['sourceIds']=['armament','calculator']
  g['aliases']=aliases.get(g['nameZh'],[])
 art_path=ROOT/'tools/data/equipment/images.json'
 if art_path.exists():
  art=json.loads(art_path.read_text());registry={r['id']:r for r in art['images']}
  for g in groups.values():
   picture=registry['weapon-'+str(g['id'])];g['image']=picture['image'];g['sourceIds'].append(picture['sourceId'])
  f['sources'].extend(s for s in art['sources'] if s['id'] in {g['sourceIds'][-1] for g in groups.values()})
 output={'version':'0.7.0','generatedAt':'2026-10-21','sources':f['sources'],'inputHashes':f['inputHashes'],'types':TYPES,'weapons':list(groups.values()),'coverage':{'weapons':len(groups),'variants':len(f['rows']),'blessings':sum(bool(g['blessing'])for g in groups.values())},'notice':'Nightreign基础参数；不套用本体能力值需求。最低使用等级与能力补正分开记录。攻击力未计入角色属性、稀有度变化、遗物及随机词条；具体动作与战技可使用不同伤害类型。'}
 (ROOT/'web_app/assets/data/weapons.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');print(output['coverage'])
if __name__=='__main__':build()
