from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import urllib.request,subprocess,hashlib,zipfile
sdk=Path('/Users/jimmy/.local/share/nightlens/flutter');engine=(sdk/'bin/internal/engine.version').read_text().strip()
base=sdk/'bin/cache/downloads/storage.googleapis.com/flutter_infra_release/flutter'/engine
# These are the exact official engine artifacts Flutter will validate and extract.
def get(flavour):
 target=base/flavour/'artifacts.zip';target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  try:
   with zipfile.ZipFile(target) as z:z.testzip()
   return str(target)+' cached'
  except zipfile.BadZipFile:pass
 url=f'https://storage.flutter-io.cn/flutter_infra_release/flutter/{engine}/{flavour}/artifacts.zip'
 result=subprocess.run(['curl','-fL','--retry','3','--connect-timeout','20','--max-time','600','-o',str(target),url],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 if result.returncode:raise RuntimeError(flavour+' download failed')
 with zipfile.ZipFile(target) as z:
  if z.testzip():raise RuntimeError(flavour+' invalid zip')
 return flavour+' downloaded '+str(target.stat().st_size)
with ThreadPoolExecutor(max_workers=3) as pool:
 for f in as_completed([pool.submit(get,n) for n in ['ios','ios-profile','ios-release']]):print(f.result(),flush=True)
