from pathlib import Path
import subprocess,shutil,zipfile,hashlib,json,plistlib,argparse
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source-app',type=Path);args=parser.parse_args()
source=args.source_app or ROOT/'build/ios/iphoneos/Runner.app';target=ROOT/'artifacts/NightLens.app';ipa=ROOT/'artifacts/NightLens-iPhone-Demo.ipa'
subprocess.run(['codesign','--verify','--deep','--strict',str(source)],check=True)
assetRoot=source/'Frameworks/App.framework/flutter_assets/web_app'
for original in (ROOT/'web_app').rglob('*'):
 if not original.is_file() or original.name=='.DS_Store':continue
 name=original.relative_to(ROOT/'web_app')
 assert hashlib.sha256(original.read_bytes()).digest()==hashlib.sha256((assetRoot/name).read_bytes()).digest(),str(name)+' was not rebuilt'
if target.exists():shutil.rmtree(target)
shutil.copytree(source,target,symlinks=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(target)],check=True)
with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in target.rglob('*'):
  if p.is_file():z.write(p,Path('Payload/NightLens.app')/p.relative_to(target))
profile=plistlib.loads(subprocess.check_output(['security','cms','-D','-i',str(target/'embedded.mobileprovision')],stderr=subprocess.DEVNULL))
info=plistlib.loads((target/'Info.plist').read_bytes())
report={'appVersion':info.get('CFBundleShortVersionString'),'buildNumber':info.get('CFBundleVersion'),'signatureVerified':True,'latestWebAssetsVerified':True,'profileExpirationUTC':str(profile['ExpirationDate']),'bundleId':'cn.jimmy.nightlens','ipaBytes':ipa.stat().st_size,'sha256':hashlib.sha256(ipa.read_bytes()).hexdigest()}
(ROOT/'docs/verification/final-package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report)
