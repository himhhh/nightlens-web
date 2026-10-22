"""Build fixed portrait templates from public source assets; no user photos are read."""
from pathlib import Path
from PIL import Image
import json,hashlib,urllib.request,io,base64
ROOT=Path(__file__).resolve().parents[1]
COMMIT='f1e52248e3c4e84a9e2002cda1503a5be7eb9268'
BASE=f'https://raw.githubusercontent.com/NeuraXmy/nightreign-overlay-helper/{COMMIT}/src/nightreign_overlay/plugins/map_detect/data/icons/nightlord/'
IDS=['Gladius','Adel','Gnoster','Maris','Libra','Fulghor','Caligo','Heolstor','Harmonia','Straghess']
cache=ROOT/'assets/source/nightlord-portraits';cache.mkdir(parents=True,exist_ok=True)
records=[];output=bytearray();side=64
foreground_masks={}
for file in [f'{i}.png' for i in range(10)]+[f'e{i}.png' for i in range(9)]+['unk.png']:
 path=cache/file
 if not path.exists():path.write_bytes(urllib.request.urlopen(BASE+file,timeout=45).read())
 raw=path.read_bytes();rgb=Image.open(io.BytesIO(raw)).convert('RGB').crop((55,55,195,195)).resize((side,side),Image.Resampling.LANCZOS)
 image=Image.open(io.BytesIO(raw)).convert('RGB').convert('L').crop((55,55,195,195)).resize((side,side),Image.Resampling.LANCZOS)
 colors=[((r-g)/(r+g+b),(b-g)/(r+g+b)) for r,g,b in zip(*[iter(rgb.tobytes())]*3) if r+g+b>90 and max(r,g,b)<250]
 chroma=[round(sum(p[i] for p in colors)/len(colors),6) for i in range(2)]
 index=None if file=='unk.png' else int(file.removeprefix('e').split('.')[0])
 # Derive the head/highlight mask from the PUBLIC ordinary portrait. The dark
 # purple background must not dominate the form decision in a TV photograph.
 if index is not None and not file.startswith('e'):
  luminance=list(rgb.convert('L').tobytes());cutoff=sorted(luminance)[int(len(luminance)*.75)]
  foreground_masks[index]=[i for i,value in enumerate(luminance) if value>=cutoff]
 mask=foreground_masks.get(index,[]);pixels=list(zip(*[iter(rgb.tobytes())]*3))
 foreground=[((pixels[i][0]-pixels[i][1])/sum(pixels[i]),(pixels[i][2]-pixels[i][1])/sum(pixels[i])) for i in mask if sum(pixels[i])>90 and max(pixels[i])<250]
 form_chroma=[round(sum(p[i] for p in foreground)/len(foreground),6) for i in range(2)] if foreground else None
 entry={'id':None if index is None else IDS[index],'variant':'unknown' if index is None else 'everdark' if file.startswith('e') else 'normal','offset':len(output),'colorOffset':len(output)+side**2,'chroma':chroma,'foregroundChroma':form_chroma,'source':BASE+file,'sourceSha256':hashlib.sha256(raw).hexdigest()}
 if mask and not file.startswith('e'):
  bits=bytearray(side*side//8)
  for i in mask:bits[i//8]|=1<<(i%8)
  entry['foregroundMask']=base64.b64encode(bits).decode('ascii')
 records.append(entry)
 output.extend(image.tobytes())
 output.extend(rgb.tobytes())
model=ROOT/'web_app/assets/models/nightlord-templates.bin';model.write_bytes(output)
metadata={'version':3,'side':side,'license':'AGPL-3.0','source':'https://github.com/NeuraXmy/nightreign-overlay-helper','sourceCommit':COMMIT,'method':'Public grayscale identity templates and public foreground-chroma prototypes; no user photos or derived images are bundled','formBasis':f'https://github.com/NeuraXmy/nightreign-overlay-helper/blob/{COMMIT}/src/nightreign_overlay/plugins/map_detect/detector.py#L90','sha256':hashlib.sha256(output).hexdigest(),'templates':records}
(ROOT/'web_app/assets/data/nightlords.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print('Built',len(records),'public portrait templates;',len(output),'bytes; no user-photo inputs')
