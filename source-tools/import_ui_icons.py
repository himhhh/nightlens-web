"""Restore version-pinned public UI icons without reading user photos."""
from pathlib import Path
import json,hashlib,urllib.request
ROOT=Path(__file__).resolve().parents[1]
for source in json.loads((ROOT/'tools/ui_icon_sources.json').read_text())['files']:
 path=ROOT/source['file']
 if not path.exists():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(urllib.request.urlopen(source['url'],timeout=40).read())
 if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise RuntimeError('UI icon changed: '+source['file'])
print('UI icon hashes verified.')
