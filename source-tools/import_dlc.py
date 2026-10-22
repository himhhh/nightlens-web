"""Normalize public 1.03.2 observations; retain provenance for every layer."""
from source_cache import fetch_snapshot
import json,pathlib,urllib.request,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];A=ROOT/'web_app/assets';D=json.load(open(fetch_snapshot('observer')))
remote=D['remote'];terrains={'Normal':'Default','Rotted':'Rotted Woods','Great Hollow':'Great Hollow'}
lords={'1_Gladius':'Gladius','2_Adel':'Adel','3_Gnoster':'Gnoster','4_Maris':'Maris','5_Libra':'Libra','6_Fulghor':'Fulghor','7_Caligo':'Caligo','8_Heolstor':'Heolstor','9_Balancers':'Harmonia','10_Greg':'Straghess'}
bosses={s['seed_id']:s for s in D['bossAssignments']};details={s['key']:s for s in D['bossDetails']}
def kind(raw):
 if not raw or raw in ['empty','empty_spawn']:return 'empty'
 if raw.startswith('church'):return 'church'
 if raw in ['sorcerers','diff_sorcerers']:return 'mage'
 if raw.startswith('forge'):return 'forge'
 if raw=='township':return 'village'
 if raw.startswith('greatchurch'):return 'greatchurch'
 if raw.startswith('WUF'):return 'wuf'
 if raw.startswith('EUF'):return 'euf'
 if raw.startswith('fort'):return 'fort'
 if raw.startswith('marsh'):return 'marsh'
 if raw.startswith('ruins'):return 'ruins'
 if raw.startswith('mainencampment'):return 'camp'
 return 'other'
D['poiLabels'].update({'WUF_fire':'西北要塞·火焰','WUF_magic':'西北要塞·魔法','EUF_holy':'东南要塞·圣属性','EUF_rot':'东南要塞·腐败','marsh_bleed':'沼泽·出血','marsh_frostbite':'沼泽·冻伤','marsh_madness':'沼泽·疯狂','marsh_poison':'沼泽·毒','marsh_rot':'沼泽·腐败','marsh_sleep':'沼泽·睡眠'})
patterns=[]
for s in D['seeds']:
 sid=s['seed_id'];terrain=terrains.get(s['map_type'],s['map_type']);coords=D['coordinates']['greatHollowSlots' if terrain=='Great Hollow' else 'baseSlots'];byid={str(p['id']):p for p in coords};pois=[]
 for key,raw in s['slots'].items():
  if key not in byid:continue
  p=byid[key];pois.append({'id':int(key),'x':p['x'],'y':p['y'],'type':kind(raw),'rawType':raw,'label':D['poiLabels'].get(raw,raw),'spawn':raw in ['church_spawn','empty_spawn']})
 circles=remote['nightCircles']['seeds'].get(str(int(sid)),remote['nightCircles']['seeds'].get(sid,{}));circleRecords=[]
 for day in [1,2]:
  c=circles.get('night'+str(day),{});pos=remote['nightCircles']['positions'].get(c.get('circle'))
  if c and pos:circleRecords.append({'day':day,'name':c['circle'],'boss':c.get('boss',''),'x':pos['x'],'y':pos['y'],'kind':'night-final-centre'})
 ghKey=remote['greatHollowDay2Circle']['seeds'].get(str(int(sid))) if terrain=='Great Hollow' else None
 b=bosses.get(sid,{})
 def boss(key):return details.get(b.get(key),{}).get('name',b.get(key) or '')
 event=D['eventInfo'].get(s.get('Event'),[])
 ghBosses=[]
 if terrain=='Great Hollow':
  for key,v in remote['greatHollow']['seeds'].get(str(int(sid)),{}).items():
   pos=remote['greatHollowPositions']['positions'].get(key)
   if pos:ghBosses.append({'id':key,'x':pos['x'],'y':pos['y'],**v})
 patterns.append({'id':int(sid),'nightlord':lords[s['nightlord']],'terrain':terrain,'pois':pois,'spawn':next((f"点位 {p['id']}" for p in pois if p['spawn']),''),'event':' · '.join(event[:2]),'eventDescription':event[2] if len(event)>2 else '', 'night1Boss':circles.get('night1',{}).get('boss') or boss('night1'),'night2Boss':circles.get('night2',{}).get('boss') or boss('night2'),'extraBoss':boss('extraNight1') or boss('extraNight2'),'night1Circle':circles.get('night1',{}).get('circle',''),'night2Circle':circles.get('night2',{}).get('circle',''),'circles':circleRecords,'hollowDay2':({'direction':ghKey,**remote['greatHollowDay2Circle']['positions'][ghKey]} if ghKey else None),'hollowBosses':ghBosses,'fieldBosses':[details.get(k,{}).get('name',k) for k in b.get('fieldBosses',[])],'landmarks':[]})
(A/'data/patterns.json').write_text(json.dumps({'version':'nightlens-demo-2026-10-20','sourceVersion':D['meta']['datasetVersion'],'coordinateSize':1000,'scope':'520 布局 · 含 DLC / 深夜新增布局 · 大空洞 80 布局','patterns':patterns,'bundledTactical':[0,1,20,25,30,35,40,80,120,160,200,240,280],'sourceMeta':D['meta'],'circleMeta':remote['nightCircles']['_readme'],'greatHollowCircleMeta':remote['greatHollowDay2Circle']['_readme']},ensure_ascii=False,separators=(',',':')))
files={'Default.png':'default.jpg','Crater.png':'crater.jpg','Mountaintop.png':'mountaintop.jpg','RottedWoods.png':'rotted-woods.jpg','Noklateo.png':'noklateo.jpg','GreatHollow.webp':'great-hollow.webp'}
def dl(item):
 name,out=item;path=ROOT/'assets/source'/name
 for n in range(4):
  try:
   if not path.exists():path.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/stockholm754-source/nightreign-seed-observer/main/assets/'+name,timeout=45).read())
   im=Image.open(path).convert('RGB');im.thumbnail((1536,1536));im.save(A/'maps'/out,quality=95,subsampling=0);return out
  except Exception:
   if n==3:raise
   time.sleep(n+1)
with ThreadPoolExecutor(max_workers=6) as pool:
 for f in as_completed([pool.submit(dl,x) for x in files.items()]):print(f.result(),flush=True)
# Download all icon variants used by the richer dataset.
iconNames=set(p['rawType'] for s in patterns for p in s['pois'] if p['rawType'])
def icon(name):
 path=A/'icons'/(name+'.webp')
 try:
  if not path.exists():path.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/stockholm754-source/nightreign-seed-observer/main/assets/icons/'+name+'.webp',timeout=35).read())
  return name
 except Exception:return None
with ThreadPoolExecutor(max_workers=6) as pool:
 print('Icons',sum(bool(f.result()) for f in as_completed([pool.submit(icon,k) for k in iconNames])),flush=True)
print('DLC import complete:',len(patterns),'patterns',sum(p['terrain']=='Great Hollow' for p in patterns),'Great Hollow',sum(len(p['circles']) for p in patterns),'circle centres',flush=True)

import subprocess,sys
subprocess.run(['node',str(ROOT/'tools/normalize_catalog.mjs')],cwd=ROOT,check=True)
