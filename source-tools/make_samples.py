"""Create clearly labeled synthetic acceptance photos from real map patterns."""
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from pathlib import Path
import json,cv2,numpy as np
r=Path(__file__).resolve().parents[1];a=r/'web_app/assets';data=json.load(open(a/'data/patterns.json'))
paths={'Default':'default.jpg','Great Hollow':'great-hollow.webp'}
for key,pid in [('basic',0),('hollow',1005)]:
 p=next(p for p in data['patterns'] if p['id']==pid);im=Image.open(a/'maps'/paths[p['terrain']]).convert('RGBA').resize((1000,1000))
 for point in p['pois']:
  if point['type']=='empty':continue
  name=point['rawType'];path=a/'icons'/(name+'.webp')
  if not path.exists():path=a/'icons'/({'mage':'sorcerers','village':'township','camp':'mainencampment','other':'fort'}.get(point['type'],point['type'])+'.webp')
  if not path.exists():continue
  icon=Image.open(path).convert('RGBA');bbox=icon.getbbox();icon=icon.crop(bbox) if bbox else icon
  icon.thumbnail((39,42));im.alpha_composite(icon,(round(point['x']-icon.width/2),round(point['y']-icon.height/2)))
 frame=Image.new('RGB',(1120,1120),(20,23,19));frame.paste(im.convert('RGB'),(60,60));d=ImageDraw.Draw(frame);d.text((65,22),'NIGHTLENS SYNTHETIC SCREEN SAMPLE / '+str(pid),fill=(205,200,172));
 src=np.float32([[0,0],[1120,0],[1120,1120],[0,1120]]);dst=np.float32([[150,50],[1120,100],[1180,1110],[90,1060]])
 h=cv2.getPerspectiveTransform(src,dst);out=cv2.warpPerspective(np.array(frame),h,(1280,1180),borderValue=(32,34,29));out=cv2.GaussianBlur(out,(3,3),.35)
 Image.fromarray(out).save(a/'examples'/('sample-'+key+'.jpg'),quality=91)
 print(key,pid,flush=True)
# A consistent app icon designed from the demo's map / moon mark.
im=Image.new('RGB',(1024,1024),(18,28,21));d=ImageDraw.Draw(im);gold=(216,190,132)
d.rounded_rectangle((62,62,962,962),radius=205,outline=(79,95,67),width=8)
d.ellipse((214,191,818,795),fill=gold);d.ellipse((365,120,927,682),fill=(18,28,21));
d.line([(232,742),(410,605),(582,722),(773,564)],fill=(153,178,144),width=13)
for x,y in [(232,742),(410,605),(582,722),(773,564)]:d.ellipse((x-18,y-18,x+18,y+18),fill=gold)
for size in [192,512,1024]:im.resize((size,size),Image.Resampling.LANCZOS).save(a/'icons'/f'app-{size}.png')
