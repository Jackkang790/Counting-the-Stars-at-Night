"""Prepare an isolated buildless Sites source; assets and dependencies are bundled."""
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PROJECT=ROOT/'blender/.tools/alignment-remote-preview'
DIST=PROJECT/'dist'
VENDOR=ROOT/'blender/.tools/qa/node_modules/three'


def main():
    for d in [DIST,DIST/'models',DIST/'assets',DIST/'vendor']:
        d.mkdir(parents=True,exist_ok=True)
    for name in ['index.html','app.js']:
        shutil.copy2(ROOT/'blender/preview_alignment'/name,DIST/name)
    for name in ['alignment_test_facade.glb','alignment_test_facade.manifest.json']:
        shutil.copy2(ROOT/'public/models'/name,DIST/'models'/name)
    shutil.copy2(ROOT/'blender/renders/alignment_oblique.png',DIST/'assets/alignment_oblique.png')
    for source,name in [('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),
                        ('examples/jsm/loaders/GLTFLoader.js','GLTFLoader.js'),
                        ('examples/jsm/controls/OrbitControls.js','OrbitControls.js'),
                        ('examples/jsm/environments/RoomEnvironment.js','RoomEnvironment.js'),
                        ('LICENSE','LICENSE.three.txt')]:
        shutil.copy2(VENDOR/source,DIST/'vendor'/name)
    # GLTFLoader has one relative import, bundled at its expected ../../utils path
    # after rewriting that single import to a sibling to keep this distribution flat.
    loader=DIST/'vendor/GLTFLoader.js'
    text=loader.read_text(encoding='utf-8').replace("'../utils/BufferGeometryUtils.js'", "'./BufferGeometryUtils.js'")
    text=text.replace("'../utils/SkeletonUtils.js'", "'./SkeletonUtils.js'")
    loader.write_text(text,encoding='utf-8')
    shutil.copy2(VENDOR/'examples/jsm/utils/BufferGeometryUtils.js',DIST/'vendor/BufferGeometryUtils.js')
    shutil.copy2(VENDOR/'examples/jsm/utils/SkeletonUtils.js',DIST/'vendor/SkeletonUtils.js')
    for module in (DIST/'vendor').glob('*.js'):
        for specifier in re.findall(r"(?:import|export)[^;]*?\bfrom\s*['\"]([^'\"]+)['\"]",module.read_text(encoding='utf-8')):
            if specifier.startswith('.'):
                assert (module.parent/specifier).is_file(), f'Missing dependency: {module.name}: {specifier}'
    meta=json.loads((DIST/'models/alignment_test_facade.manifest.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((DIST/'models/alignment_test_facade.glb').read_bytes()).hexdigest()==meta['sha256']
    (PROJECT/'README.md').write_text('Temporary synthetic facade asset viewer. No tracking or WebXR engine.\n',encoding='utf-8')
    print(json.dumps({'project_directory':str(PROJECT),'static_directory':'dist','glb_sha256':meta['sha256'],'files':len(list(DIST.rglob('*')))}))


if __name__=='__main__':main()
