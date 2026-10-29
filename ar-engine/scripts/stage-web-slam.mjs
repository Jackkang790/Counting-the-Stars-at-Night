import { cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root=resolve(import.meta.dirname,".."), source=resolve(root,"vendor/xr8"), out=resolve(root,process.argv[2]??".assets/xr8");
mkdirSync(out,{recursive:true});cpSync(source,out,{recursive:true});
const hashes=[];function scan(dir,prefix=""){for(const item of readdirSync(dir,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())scan(resolve(dir,item.name),name+"/");else hashes.push({path:name,sha256:createHash("sha256").update(readFileSync(resolve(dir,item.name))).digest("hex")})}}scan(source);
writeFileSync(resolve(out,"SDK-MANIFEST.json"),JSON.stringify({package:"@8thwall/engine-binary",version:"1.0.0",source:"https://registry.npmjs.org/@8thwall/engine-binary/-/engine-binary-1.0.0.tgz",unmodifiedFiles:hashes},null,2));
console.log(`Staged unmodified XR engine: ${hashes.length} files -> ${out}`);
