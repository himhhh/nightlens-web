from pathlib import Path
import shutil,subprocess,plistlib,os,sys,json
ROOT=Path(__file__).resolve().parents[1];RUNTIME=Path.home()/'.local/share/nightlens/preview';ART=ROOT/'artifacts';UID=os.getuid()
labels=['local.nightlens.demo.server','local.nightlens.demo.awake']
def owns_tailnet_port():
 if not shutil.which('tailscale'):return False,False
 try:
  raw=subprocess.check_output(['tailscale','serve','status','--json'],stderr=subprocess.DEVNULL,text=True)
  web=json.loads(raw).get('Web',{})
  routes=[value for key,value in web.items() if key.endswith(':10000')]
  return not routes,all(route.get('Handlers',{}).get('/',{}).get('Proxy')=='http://127.0.0.1:8767' for route in routes)
 except Exception:return False,False

if '--stop' in sys.argv:
 for label in labels:subprocess.run(['launchctl','bootout',f'gui/{UID}/{label}'],capture_output=True)
 empty,owned=owns_tailnet_port()
 if owned and not empty:subprocess.run(['tailscale','serve','--https=10000','off'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 print('已停止本 Demo 的预览服务与保活任务。其他端口的服务未变。');raise SystemExit(0)
(RUNTIME/'tools').mkdir(parents=True,exist_ok=True);shutil.copytree(ROOT/'web_app',RUNTIME/'web_app',dirs_exist_ok=True);shutil.copy2(ROOT/'tools/serve.py',RUNTIME/'tools/serve.py')
for label,args in [(labels[0],[sys.executable,str(RUNTIME/'tools/serve.py'),'--port','8767']), (labels[1],['/usr/bin/caffeinate','-i','-t','28800'])]:
 subprocess.run(['launchctl','bootout',f'gui/{UID}/{label}'],capture_output=True)
 path=ART/(label+'.plist');path.write_bytes(plistlib.dumps({'Label':label,'ProgramArguments':args,'WorkingDirectory':str(RUNTIME),'RunAtLoad':True,'KeepAlive':label.endswith('server'),'StandardOutPath':str(RUNTIME/(label+'.log')),'StandardErrorPath':str(RUNTIME/(label+'.log'))}))
 subprocess.run(['launchctl','bootstrap',f'gui/{UID}',str(path)],check=True)
print('预览已启动：http://127.0.0.1:8767/。后台运行，8 小时内阻止闲置睡眠；合盖仍可能让 Mac 睡眠。')

empty,owned=owns_tailnet_port()
if empty or owned:subprocess.run(['tailscale','serve','--https=10000','--bg','--yes','http://127.0.0.1:8767'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
