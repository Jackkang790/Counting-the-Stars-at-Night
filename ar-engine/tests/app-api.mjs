import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createARClient} from '../integration/client.mjs';
const dist=resolve(import.meta.dirname,'../dist');
const read=p=>JSON.parse(readFileSync(resolve(dist,p),'utf8'));
const catalog=read('api/ar/v1/catalog.json');assert.equal(catalog.schemaVersion,1);
assert.deepEqual(catalog.experiences.map(e=>e.id),['starseed','black-uniform']);
for(const entry of catalog.experiences){
 const data=read('.'+entry.url);assert.equal(data.id,entry.id);assert.equal(data.revision,entry.revision);
 for(const asset of Object.values(data.assets)){
  const bytes=readFileSync(resolve(dist,'.'+asset.url));assert.equal(bytes.length,asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 }
 if(data.id==='black-uniform'){
  assert.equal(data.scene.duration,10);assert.equal(data.scene.actors.length,4);
  for(const actor of data.scene.actors)assert.equal(actor.model,data.assets[actor.id].url);
  assert.equal(data.scene.audio,data.assets.audio.url);assert.equal(data.platforms.ios.quickLookPerformance,false);
 }
}
const client=createARClient();assert.equal(client.getLaunchUrl('starseed'),'https://ar.lobodoc.com/');
assert.equal(client.getLaunchUrl('black-uniform'),'https://ar.lobodoc.com/?musical=1&show=quartet');
assert.throws(()=>client.getLaunchUrl('bogus'));assert.throws(()=>createARClient({baseUrl:'javascript:alert(1)'}));
const original=globalThis.fetch;
try {
 globalThis.fetch=async()=>new Response(JSON.stringify(catalog),{headers:{'content-type':'application/json'}});
 assert.equal((await client.getCatalog()).revision,catalog.revision);
 globalThis.fetch=async()=>new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}});
 await assert.rejects(client.getCatalog(),/NOT_JSON/);
 globalThis.fetch=async()=>new Response('{}',{status:404});await assert.rejects(client.getCatalog(),/HTTP_404/);
 globalThis.fetch=async()=>new Response('{"schemaVersion":99}',{headers:{'content-type':'application/json'}});await assert.rejects(client.getCatalog(),/VERSION/);
}finally{globalThis.fetch=original;}
console.log(JSON.stringify({result:'PASS',experiences:2,assetHashesVerified:true,unsupportedInputAndHTMLRejected:true,phoneARVerified:false}));
