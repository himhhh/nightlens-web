from source_cache import fetch_snapshot
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,re,urllib.request
root=Path(__file__).resolve().parents[1];a=root/'web_app/assets';text=fetch_snapshot('crystalConfig').read_text()
points=[]
for m in re.finditer(r"\{ id: '([^']+)', x: ([\d.]+), y: ([\d.]+), zone: '(top|bottom)'(, isOptimal: true)? \}",text):
 points.append({'id':m[1],'x':float(m[2]),'y':float(m[3]),'zone':m[4],'optimal':bool(m[5])})
groups=[['g1-'+str(i) for i in range(1,9)],['g1-3','g2-1','g2-2','g2-3','g2-4','g1-6','g1-8','g2-5'],['g1-1','g2-3','g3-1','g1-4','g3-2','g3-3','g3-4','g3-5'],['g4-1','g3-1','g2-4','g4-2','g4-3','g2-5','g3-4','g3-3']]
data={'source':'https://github.com/luismartinezs/nightreign-guides/blob/main/features/great-hollow/config.ts','credit':'Alex0Goat、SisterNun 与 NightreignHub / luismartinezs','notice':'水晶组合独立于地图布局编号。以本局已发现水晶筛选；四组为社区记录，不保证覆盖后续版本。','points':points,'groups':[{'id':str(i+1),'name':'组合 '+chr(65+i),'crystalIds':g} for i,g in enumerate(groups)]}
(a/'data/crystals.json').write_text(json.dumps(data,ensure_ascii=False))
def download(name):
 p=a/'maps'/name
 if not p.exists():p.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/luismartinezs/nightreign-guides/main/public/features/great-hollow/'+name,timeout=40).read())
 return name
with ThreadPoolExecutor(max_workers=3) as pool:
 for f in as_completed([pool.submit(download,n) for n in ['great-hollow-top-crop.webp','great-hollow-bot-crop.webp','crystal.webp']]):print(f.result(),flush=True)
assert len(points)==21;assert all(len(g)==8 for g in groups)
print('21 positions, 4 groups, 8 crystals each',flush=True)
