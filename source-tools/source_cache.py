from pathlib import Path
import json,hashlib,urllib.request
ROOT=Path(__file__).resolve().parents[1]
def fetch_snapshot(name):
 source=json.loads((ROOT/'tools/data_sources.json').read_text())[name]
 path=ROOT/'assets/source'/source['cacheFile'];path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists():path.write_bytes(urllib.request.urlopen(source['url'],timeout=60).read())
 if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:
  raise RuntimeError('上游数据内容已变化，请先复核版本和字段，再更新 tools/data_sources.json。')
 return path
