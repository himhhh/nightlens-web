"""Rebuild version-checked DLC data, crystal data and deterministic demo samples.

The complete web assets and OpenCV runtime are shipped with this repository.
This command is optional and never overwrites the 520-layout set with legacy data.
"""
from pathlib import Path
import subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
for script in ['import_dlc.py','import_crystals.py','make_samples.py','import_nightlords.py','import_ui_icons.py','import_map_intel.py','import_boss_combat.py','import_weapons.py','package_assets.py']:
 subprocess.run([sys.executable,str(ROOT/'tools'/script)],cwd=ROOT,check=True)
