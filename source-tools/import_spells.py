"""Compile the pinned castable Nightreign catalogue, without ER stat fallback."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def build():
 data=json.loads((ROOT/'tools/data/equipment/spells-facts.json').read_text())
 for spell in data['spells']:
  assert spell['availability']['weaponIds'],spell['nameEn']
  assert (ROOT/'web_app'/spell['image']).is_file(),spell['image']
 (ROOT/'web_app/assets/data/spells.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 print('Compiled',len(data['spells']),'castable spells')
if __name__=='__main__':build()
