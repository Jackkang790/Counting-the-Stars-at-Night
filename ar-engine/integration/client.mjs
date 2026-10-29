/** Public read-only AR discovery client. No camera, GPS or reward authority. */
export function createARClient({baseUrl='https://ar.lobodoc.com/'}={}) {
  const base=new URL(baseUrl);
  if(!['https:','http:'].includes(base.protocol))throw new TypeError('HTTP(S) baseUrl required');
  const endpoint=path=>new URL('api/ar/v1/'+path,base.href.endsWith('/')?base:new URL(base.href+'/'));
  async function read(path) {
    const response=await fetch(endpoint(path),{credentials:'omit',cache:'no-cache'});
    if(!response.ok)throw new Error(`AR_API_HTTP_${response.status}`);
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('AR_API_NOT_JSON');
    const data=await response.json();
    if(data.schemaVersion!==1)throw new Error('AR_API_VERSION_UNSUPPORTED');
    return data;
  }
  const valid=id=>{if(!['starseed','black-uniform'].includes(id))throw new TypeError('Unknown AR experience: '+id);return id;};
  return {
    getCatalog:()=>read('catalog.json'),
    getExperience:id=>read(`experiences/${valid(id)}.json`),
    getLaunchUrl(id) {
      valid(id);const url=new URL(base);url.search='';url.hash='';
      if(id==='black-uniform'){url.searchParams.set('musical','1');url.searchParams.set('show','quartet');}
      return url.href;
    },
    resolveAsset:asset=>new URL(asset.url,base).href,
  };
}
