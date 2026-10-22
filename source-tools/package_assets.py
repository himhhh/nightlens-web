from pathlib import Path
import json,hashlib,re
r=Path(__file__).resolve().parents[1];w=r/'web_app'
# Existing workers must fetch the new entry script and stylesheet together with
# the new HTML instead of pairing it with their older cached UI.
index=w/'index.html';html=index.read_text()
for name in ['app.js','style.css']:
 stamp=hashlib.sha256((w/name).read_bytes()).hexdigest()[:12]
 html=re.sub(r'(["\'])'+re.escape(name)+r'(?:\?__nl_asset=[a-f0-9]+)?(["\'])',lambda m:m[1]+name+'?__nl_asset='+stamp+m[2],html)
index.write_text(html)
paths=sorted(str(p.relative_to(w)) for p in w.rglob('*') if p.is_file() and p.name not in ['asset-manifest.json','sw.js','.DS_Store'])
(w/'asset-manifest.json').write_text(json.dumps(paths,ensure_ascii=False))
fingerprint=hashlib.sha256(''.join(hashlib.sha256((w/p).read_bytes()).hexdigest() for p in paths).encode()).hexdigest()[:12]
files=json.dumps(['./'+p for p in paths],ensure_ascii=False)
sw="""const CACHE='nightlens-%s';
const FILES=%s;
importScripts('./offline_worker.js');
"""%(fingerprint,files)
(w/'sw.js').write_text(sw)
print('Packaged',len(paths),'assets; fingerprint',fingerprint,'total MB',round(sum((w/p).stat().st_size for p in paths)/1e6,1))

# Keep the overnight preview daemon in sync, outside macOS protected Documents.
import shutil
preview=Path.home()/".local/share/nightlens/preview/web_app"
if preview.exists():shutil.copytree(w,preview,dirs_exist_ok=True)
