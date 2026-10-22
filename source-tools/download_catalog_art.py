"""Restore pinned catalogue artwork; public assets only, never user photos."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,io,json,time,urllib.request
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'assets/source/catalog-expansion'
MANIFEST=ROOT/'tools/data/equipment/images.json'
def sha(data):return hashlib.sha256(data).hexdigest()
def restore(record):
 target=ROOT/'web_app'/record['image'];original=CACHE/record['cached']
 if target.exists() and record.get('sha256')==sha(target.read_bytes()):return record
 if not original.exists():
  for attempt in range(3):
   try:
    request=urllib.request.Request(record['url'],headers={'User-Agent':'NightLens-public-artwork'})
    raw=urllib.request.urlopen(request,timeout=40).read()
    if len(raw)>20*1024*1024:raise ValueError('Image exceeds artwork limit')
    with Image.open(io.BytesIO(raw)) as im:im.verify()
    original.parent.mkdir(parents=True,exist_ok=True);original.write_bytes(raw);break
   except Exception:
    if attempt==2:raise
    time.sleep(attempt+1)
 raw=original.read_bytes()
 if record.get('sourceSha256') and sha(raw)!=record['sourceSha256']:raise ValueError('Source image changed: '+record['id'])
 with Image.open(io.BytesIO(raw)) as image:
  image=image.convert('RGBA');source_size=image.size
  if not image.getbbox():raise ValueError('Empty artwork: '+record['id'])
  image.thumbnail((256,256),Image.Resampling.LANCZOS)
  target.parent.mkdir(parents=True,exist_ok=True);image.save(target,'WEBP',quality=92,method=6)
 return {**record,'sourceSha256':sha(raw),'sha256':sha(target.read_bytes()),'sourceSize':source_size,'packedSize':image.size}
def main():
 data=json.loads(MANIFEST.read_text());CACHE.mkdir(parents=True,exist_ok=True)
 with ThreadPoolExecutor(max_workers=6)as pool:data['images']=list(pool.map(restore,data['images']))
 MANIFEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('Verified',len(data['images']),'local illustrations;',round(sum((ROOT/'web_app'/r['image']).stat().st_size for r in data['images'])/1e6,2),'MB')
if __name__=='__main__':main()
