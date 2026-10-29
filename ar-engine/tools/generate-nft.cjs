// Run the pinned official NFT creator WASM on correctly packed RGB pixels.
// Download tool files separately as documented; no paid API or image upload.
const fs=require('fs'),path=require('path');
const tool=path.resolve(process.argv[2]??'.tmp/nft-tools/NftMarkerCreator_wasm.cjs');
const out=path.resolve(process.argv[3]??'ar-engine/tracking-lab-assets');
const rgb=path.resolve(process.argv[4]??'.tmp/nft-tools/building.rgb');
const meta=JSON.parse(fs.readFileSync(path.join(out,'target.json'))),bytes=fs.readFileSync(rgb);
if(bytes.length!==meta.width*meta.height*3)throw Error('Expected tightly packed RGB24 pixels');
// Old Emscripten's Node loader predates global fetch; force its filesystem loader.
const originalFetch=global.fetch;global.fetch=undefined;const moduleInstance=require(tool);
moduleInstance.onRuntimeInitialized=()=>{
 global.fetch=originalFetch;const M=moduleInstance,pointer=M._malloc(bytes.length);M.HEAPU8.set(bytes,pointer);
 M._createImageSet(pointer,72,meta.width,meta.height,3,'building',2,[0,0]);M._free(pointer);
 for(const ext of ['iset','fset','fset3']){const data=M.FS.readFile('asa.'+ext);fs.writeFileSync(path.join(out,'building.'+ext),data);console.log('Generated',ext,data.length);}
};
