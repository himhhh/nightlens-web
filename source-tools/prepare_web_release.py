"""Isolate each published UI so an older service worker cannot mix versions.

Run on the public staging checkout after copying web_app, never on the iOS
bundle. Only small JS/CSS files are duplicated; maps and images stay shared.
"""
from pathlib import Path
import argparse,hashlib,json,re,shutil

def prepare(root):
    modules=sorted(p for p in root.iterdir() if p.is_file() and p.suffix in {'.js','.css'} and p.name!='sw.js')
    revision=hashlib.sha256(b''.join(p.name.encode()+p.read_bytes() for p in modules)).hexdigest()[:12]
    folder=root/'releases'/revision
    folder.mkdir(parents=True,exist_ok=True)
    for path in modules:
        target=folder/path.name
        if path.suffix=='.css':target.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines())+'\n')
        else:shutil.copy2(path,target)
    index=root/'index.html';html=index.read_text()
    for path in modules:
        name=re.escape(path.name)
        html=re.sub(r'(["\'])(?:releases/[a-f0-9]+/)?'+name+r'(?:\?__nl_asset=[a-f0-9]+)?(["\'])',lambda m:m[1]+'releases/'+revision+'/'+path.name+m[2],html)
    index.write_text(html)
    paths=json.loads((root/'asset-manifest.json').read_text())
    paths=sorted(set(p for p in paths if not p.startswith('releases/'))|{str(p.relative_to(root)) for p in folder.iterdir()})
    (root/'asset-manifest.json').write_text(json.dumps(paths,ensure_ascii=False))
    fingerprint=hashlib.sha256(b''.join((root/p).read_bytes() for p in paths)).hexdigest()[:12]
    (root/'sw.js').write_text("const CACHE='nightlens-%s';\nconst FILES=%s;\nimportScripts('./offline_worker.js');\n"%(fingerprint,json.dumps(['./'+p for p in paths],ensure_ascii=False)))
    return {'revision':revision,'cache':fingerprint,'files':len(paths)+2}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('directory',type=Path);args=parser.parse_args()
    print(json.dumps(prepare(args.directory),ensure_ascii=False))
