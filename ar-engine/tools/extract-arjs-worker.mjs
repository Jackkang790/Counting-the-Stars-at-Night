import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
const source=readFileSync(process.argv[2]??'.tmp/nft-tools/ar-threex.mjs');
if(createHash('sha256').update(source).digest('hex')!=='6c9aa037be052f9741defe725bc3d22b01c8ba09500a41796a11f6417eb6fd34')throw Error('Only the pinned official AR.js 3.4.8 build is accepted');
const text=source.toString('utf8'),prefix='function y(){return F()(',start=text.indexOf(prefix)+prefix.length,end=text.indexOf(',"Worker"',start);
const worker=vm.runInNewContext(text.slice(start,end),{},{timeout:2000});
if(createHash('sha256').update(worker).digest('hex')!=='be534a96259992be8dc0b9338e396780bb53ea82dc3b9145395e0f6e0c628b57')throw Error('Unexpected NFT worker');
writeFileSync(process.argv[3]??'ar-engine/src/tracking-lab/vendor/nft-worker.js',worker);
