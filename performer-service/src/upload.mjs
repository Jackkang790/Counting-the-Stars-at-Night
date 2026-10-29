import busboy from 'busboy';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir,readFile,rm } from 'node:fs/promises';
import { basename,extname,join } from 'node:path';
import { finished } from 'node:stream/promises';
import { sha } from './pipeline.mjs';

export async function uploads(req,folder){
  await mkdir(folder,{recursive:true});const files=[],fields={},writes=[];let error,total=0;
  try{
    const parser=busboy({headers:req.headers,limits:{files:12,fields:20,fieldSize:32000,fileSize:200*1024*1024,parts:32}});
    const completion=new Promise((done,reject)=>{
      parser.on('field',(name,value,info)=>{if(info.valueTruncated)error=Error('입력 필드가 너무 큽니다');fields[name]=value});
      parser.on('file',(field,stream,info)=>{
        const ext=extname(info.filename).toLowerCase(),id=randomUUID(),name=basename(info.filename).replace(/[\x00-\x1f]/g,'').slice(0,160);
        const kind=field==='photos'?'photo':field==='video'?'video':field;
        const allowed=kind==='photo'?['.jpg','.jpeg','.png','.webp']:kind==='video'?['.mp4','.mov','.webm']:kind==='motion'?['.fbx','.bvh','.glb']:['.glb'];
        if(!['photo','video','model','motion','result'].includes(kind)||!allowed.includes(ext)){error=Error('사진은 JPEG/PNG/WebP, 영상은 MP4/MOV/WebM, 모델은 GLB, 모션은 FBX/BVH/GLB만 받습니다');stream.resume();return}
        const path=join(folder,id+ext),output=createWriteStream(path,{flags:'wx'});let count=0;
        stream.on('data',chunk=>{count+=chunk.length;total+=chunk.length;if(total>380*1024*1024||count>(kind==='photo'?20:kind==='video'?200:64)*1024*1024){error=Error('파일 크기 제한을 초과했습니다');output.destroy(error);stream.unpipe(output);stream.resume()}});
        stream.on('limit',()=>error=Error('파일 크기 제한을 초과했습니다'));stream.pipe(output);
        writes.push(finished(output).catch(e=>{error=e}));files.push({id,path,kind,originalName:name,name,mime:info.mimeType,ext});
      });
      for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>error=Error('파일 또는 필드 개수 제한 초과'));
      parser.on('error',reject);req.on('aborted',()=>reject(Error('업로드가 중단되었습니다')));parser.on('close',done);
    });
    req.pipe(parser);await completion;await Promise.all(writes);if(error)throw error;
    for(const file of files){const bytes=await readFile(file.path);if(!bytes.length)throw Error('빈 파일은 업로드할 수 없습니다');file.bytes=bytes.length;file.sha256=sha(bytes);
      if(file.kind==='photo'){
        if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))file.mime='image/png';
        else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)file.mime='image/jpeg';
        else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')file.mime='image/webp';
        else throw Error('사진 파일의 실제 형식이 JPEG/PNG/WebP가 아닙니다');
      }else if(file.kind==='video'){
        if(bytes.toString('ascii',4,8)==='ftyp')file.mime=file.ext==='.mov'?'video/quicktime':'video/mp4';
        else if(bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))file.mime='video/webm';
        else throw Error('영상 파일 헤더를 확인하세요');
      }else if(file.ext==='.glb'){file.mime='model/gltf-binary';if(bytes.toString('ascii',0,4)!=='glTF')throw Error('GLB 파일 헤더를 확인하세요')}
      else if(file.ext==='.bvh'){file.mime='text/plain';if(!bytes.toString('utf8',0,2048).includes('HIERARCHY')||!bytes.includes(Buffer.from('MOTION')))throw Error('BVH 모션 형식을 확인하세요')}
      else{file.mime='application/octet-stream';if(!bytes.toString('ascii',0,128).includes('FBX'))throw Error('FBX 모션 형식을 확인하세요')}
    }
    return {files,fields};
  }catch(e){await Promise.all(writes);await rm(folder,{recursive:true,force:true});throw e}
}
