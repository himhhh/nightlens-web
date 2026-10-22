from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parents[1];w=r/'web_app'
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
