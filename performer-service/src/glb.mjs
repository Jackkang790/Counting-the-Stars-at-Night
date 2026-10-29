import { readFile } from 'node:fs/promises';
export function inspectGLB(bytes,{requireRig=false,requireAnimation=false}={}) {
  if(bytes.length<20||bytes.length>64*1024*1024||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('64MiB 이하의 유효한 GLB 2.0이 필요합니다');
  const end=20+bytes.readUInt32LE(12);if(end>bytes.length||end>4*1024*1024)throw Error('GLB JSON 범위가 올바르지 않습니다');
  const json=JSON.parse(bytes.subarray(20,end).toString('utf8'));
  for(const r of [...(json.buffers??[]),...(json.images??[])])if(r.uri&&!r.uri.startsWith('data:'))throw Error('텍스처와 버퍼를 내장한 GLB가 필요합니다');
  if(!json.meshes?.length||json.scenes?.length!==1)throw Error('하나의 장면과 메시를 포함해야 합니다');
  const skins=json.skins?.length??0, animations=json.animations??[];
  if(requireRig&&(!skins||!json.nodes?.some(n=>Number.isInteger(n.skin))))throw Error('스킨과 본이 연결된 리깅 모델이 필요합니다');
  if(requireAnimation&&!animations.some(a=>a.channels?.length&&a.samplers?.length))throw Error('실제로 재생할 애니메이션 채널이 필요합니다');
  const joints=new Set((json.skins??[]).flatMap(s=>s.joints??[]));
  if(requireAnimation&&!animations.some(a=>a.channels?.some(c=>joints.has(c.target?.node))))throw Error('본에 연결된 애니메이션이 필요합니다. 모델 전체 회전만으로는 공연 동작이 아닙니다');
  if(requireAnimation){
    const binStart=end+8;
    const changing=animations.some(animation=>animation.channels.some(channel=>{
      if(!joints.has(channel.target?.node))return false;
      const sampler=animation.samplers[channel.sampler],a=json.accessors?.[sampler?.output],view=json.bufferViews?.[a?.bufferView];
      if(!a||a.componentType!==5126||a.sparse||!view||view.extensions?.EXT_meshopt_compression)throw Error('본 동작은 압축·sparse가 없는 float32 애니메이션 버퍼로 내보내세요');
      const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];if(!size)return false;
      const stride=view.byteStride??size*4,start=binStart+(view.byteOffset??0)+(a.byteOffset??0),step=sampler.interpolation==='CUBICSPLINE'?3:1,first=step===3?1:0;
      if(start<binStart||start+Math.max(0,a.count-1)*stride+size*4>bytes.length)throw Error('애니메이션 버퍼 범위 오류');
      let change=false;for(let i=first;i<a.count;i+=step)for(let k=0;k<size;k++){
        const value=bytes.readFloatLE(start+i*stride+k*4),initial=bytes.readFloatLE(start+first*stride+k*4);
        if(!Number.isFinite(value))throw Error('본 동작에 유효하지 않은 값이 있습니다');if(Math.abs(value-initial)>1e-5)change=true;
      }return change;
    }));
    if(!changing)throw Error('시간에 따라 실제로 변하는 본 동작이 필요합니다');
  }
  for(const a of json.accessors??[])for(const v of [...(a.min??[]),...(a.max??[])])if(!Number.isFinite(v))throw Error('유효하지 않은 애니메이션/기하 범위입니다');
  return {meshes:json.meshes.length,skins,bones:Math.max(0,...(json.skins??[]).map(s=>s.joints?.length??0)),animations:animations.map((a,i)=>({name:a.name??`clip-${i}`,channels:a.channels?.length??0})),extensions:json.extensionsRequired??[],syntheticCalibration:json.asset?.extras?.syntheticCalibration===true||(json.nodes??[]).some(n=>n.extras?.syntheticCalibration===true)};
}
export async function inspectFile(file,options){return inspectGLB(await readFile(file),options)}
