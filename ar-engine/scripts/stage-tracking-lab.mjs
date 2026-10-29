import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'.assets/tracking-lab');
mkdirSync(out,{recursive:true});cpSync(resolve(root,'tracking-lab-assets'),out,{recursive:true});
for(const name of ['nft-worker.js','camera_para.dat','LICENSE.AR-js','LICENSE.ARToolkit','THIRD_PARTY.md'])cpSync(resolve(root,'src/tracking-lab/vendor',name),resolve(out,name));
for(const name of ['LICENSE.mind-ar','LICENSE.apache-2.0'])cpSync(resolve(root,'src/musical/vendor',name),resolve(out,name));
const target=JSON.parse(readFileSync(resolve(out,'target.json'),'utf8'));
target.files={};for(const name of ['building.png','building.iset','building.fset','building.fset3','building.mind']){
 const bytes=readFileSync(resolve(out,name));target.files[name]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}
const model=readFileSync(resolve(root,'musical-assets/quartet/performer-01.glb'));
if(target.imageSha256!==target.files['building.png'].sha256)throw Error('Photo changed without recompiling both targets');
target.modelSha256=createHash('sha256').update(model).digest('hex');
writeFileSync(resolve(out,'target.json'),JSON.stringify(target,null,2)+'\n');
console.log('Tracking lab assets staged; same image and GLB for both trackers.');
