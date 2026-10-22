#!/usr/bin/env python3
"""Install the already signed local demo on a connected, provisioned iPhone."""
from pathlib import Path
import json,subprocess,tempfile,sys,plistlib
ROOT=Path(__file__).resolve().parents[1];APP=ROOT/'artifacts/NightLens.app'
def fail(message):print('\n'+message);return 1
def main():
 if not APP.exists():return fail('未找到安装文件。请确认 artifacts/NightLens.app 仍在当前目录。')
 subprocess.run(['codesign','--verify','--deep','--strict',str(APP)],check=True)
 profile=plistlib.loads(subprocess.check_output(['security','cms','-D','-i',str(APP/'embedded.mobileprovision')],stderr=subprocess.DEVNULL));allowed=set(profile.get('ProvisionedDevices',[]))
 with tempfile.TemporaryDirectory(prefix='nightlens-install-') as temp:
  path=Path(temp)/'devices.json'
  result=subprocess.run(['xcrun','devicectl','list','devices','--json-output',str(path)],capture_output=True,text=True)
  if result.returncode or not path.exists():return fail('无法读取 iPhone。请打开 Xcode / Device Hub，确认手机已与此 Mac 配对。')
  devices=json.loads(path.read_text()).get('result',{}).get('devices',[])
  phones=[]
  for device in devices:
   hardware=device.get('hardwareProperties',{});properties=device.get('deviceProperties',{})
   udid=hardware.get('udid','');product=hardware.get('productType','')
   if udid in allowed and (product.startswith('iPhone') or 'iPhone' in properties.get('name','')):phones.append(device)
  if '--check' in sys.argv:
   print(json.dumps({'signedAppVerified':True,'profilePhoneCount':len(phones),'connectedPhones':sum(d.get('connectionProperties',{}).get('tunnelState')=='connected' for d in phones)},ensure_ascii=False));return 0
  if not phones:return fail('请用数据线连接已配对的 iPhone，解锁并点“信任此电脑”，然后重新运行。')
  phone=next((d for d in phones if d.get('connectionProperties',{}).get('tunnelState')=='connected'),phones[0])
  name=phone.get('deviceProperties',{}).get('name','iPhone');identifier=phone.get('identifier') or phone['hardwareProperties']['udid']
  print('准备安装到：'+name,flush=True)
  print('请保持手机解锁；首次开发版安装可能要求在手机上开启开发者模式。',flush=True)
  command=['xcrun','devicectl','device','install','app','--device',identifier,'--timeout','120',str(APP)]
  result=subprocess.run(command)
  if result.returncode:return fail('安装未完成。请确认：手机已解锁并信任 Mac；设置 → 隐私与安全性 → 开发者模式已开启。必要时打开 Xcode / Device Hub 后重试。')
  print('\n安装完成：在 iPhone 主屏幕打开“黑夜地图镜”。',flush=True)
  subprocess.run(['xcrun','devicectl','device','process','launch','--device',identifier,'cn.jimmy.nightlens'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  return 0
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as error:sys.exit(fail('安装未完成：'+str(error)))
