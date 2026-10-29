import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { open,rename,unlink } from 'node:fs/promises';
const suffixes=['amazonaws.com','googleapis.com','tripo3d.ai','tripo3d.com','aliyuncs.com','bcebos.com'];
export function privateAddress(address){
  const a=address.toLowerCase();
  if(isIP(a)===6)return a==='::1'||a==='::'||a.startsWith('fc')||a.startsWith('fd')||a.startsWith('fe80:')||a.startsWith('::ffff:');
  if(isIP(a)!==4)return true;
  const [x,y]=a.split('.').map(Number);return x===0||x===10||x===127||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x>=224||x===100&&y>=64&&y<=127;
}
export async function trustedArtifact(value,extra=[]){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('제공자 결과는 HTTPS 주소여야 합니다');
  if(![...suffixes,...extra].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))throw Error('제공자 파일 호스트가 허용 목록에 없습니다. ARTIFACT_HOSTS를 확인하세요');
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>privateAddress(a.address)))throw Error('내부 네트워크 파일 주소는 허용되지 않습니다');return url;
}
export async function transfer(value,{method='GET',body,headers={},destination,maxBytes=64*1024*1024,hosts=[],fetcher=fetch}={}){
  let url=value;
  for(let redirects=0;redirects<4;redirects++){
    await trustedArtifact(url,hosts);
    const response=await fetcher(url,{method,body,headers,redirect:'manual',signal:AbortSignal.timeout(120000)});
    if([301,302,303,307,308].includes(response.status)){
      if(method!=='GET')throw Error('파일 업로드 리다이렉트는 허용하지 않습니다');
      url=new URL(response.headers.get('location'),url).href;continue;
    }
    if(!response.ok)throw Error(`제공자 파일 전송 실패 (${response.status})`);
    if(!destination){await response.body?.cancel();return}
    if(Number(response.headers.get('content-length'))>maxBytes)throw Error('제공자 결과 파일이 너무 큽니다');
    const temp=destination+'.partial',file=await open(temp,'w');let total=0;
    try{for await(const chunk of response.body){total+=chunk.length;if(total>maxBytes)throw Error('제공자 파일 크기 제한 초과');await file.write(chunk)}await file.sync();await file.close();await rename(temp,destination);return}
    catch(e){await file.close().catch(()=>{});await unlink(temp).catch(()=>{});throw e}
  }
  throw Error('제공자 파일 리다이렉트 제한 초과');
}
