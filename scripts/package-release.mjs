import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root, python } from './python.mjs';
const output = resolve(root, '.tmp/releases');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const script = String.raw`
import hashlib,json,pathlib,sys,zipfile
root,out,commit=pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),sys.argv[3]
files={}
for source,target in [('dist','www'),('ar-engine/dist','www/ar'),('backend/app','backend/app'),('shared','shared'),('deploy','deploy')]:
 for path in (root/source).rglob('*'):
  if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ['.pyc','.pyo']:
   files[(pathlib.PurePosixPath(target)/path.relative_to(root/source).as_posix()).as_posix()]=path.read_bytes()
for name in ['requirements.txt','constraints.txt']:
 files[name]=(root/name).read_bytes()
files['.dockerignore']=(root/'deploy/Dockerfile.api.dockerignore').read_bytes()
for required in ['www/index.html','www/ar/index.html','www/ar/api/ar/v1/catalog.json','deploy/nginx.conf','deploy/Dockerfile.api','backend/app/integrated.py']:
 assert required in files,required
manifest={'commit':commit,'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(files.items())}}
identity=hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest()[:12]
manifest['release']='unified-'+commit[:7]+'-'+identity
out.mkdir(parents=True,exist_ok=True)
archive=out/(manifest['release']+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
 for name,data in sorted(files.items()):bundle.writestr(name,data)
 bundle.writestr('release.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
result={'release':manifest['release'],'commit':commit,'archive':str(archive),'bytes':archive.stat().st_size,'expandedBytes':sum(len(data) for data in files.values()),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(files)}
(out/'latest.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
`;
execFileSync(python(), ['-c', script, root, output, commit], { cwd: root, stdio: 'inherit' });
