import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
// DEV-only GET to find exact documentIds of AI drafts held for review.
// A Strapi list row's numeric ID is NOT its documentId. Never list tokens,
// article bodies, evidence excerpts, or other private CMS content.
export function pendingDraftLookup({baseUrl,token,fetchImpl=fetch}={}){
  let host;
  try{host=new URL(baseUrl);}catch{throw new Error('DEV pending lookup requires private CMS URL');}
  if(host.protocol!=='http:' ||
     !['cms','localhost','127.0.0.1'].includes(host.hostname) ||
     (host.pathname!==''&&host.pathname!=='/')||
     typeof token!=='string'||token.length<10)
    throw new Error('DEV pending lookup requires private CMS URL and read-only token');
  return async function list(){
    const params=new URLSearchParams({
      status:'draft',
      'filters[originType][$eq]':'externa',
      'filters[aiAssisted][$eq]':'true',
      'filters[editorialStatus][$eq]':'em_revisao',
      'sort[0]':'createdAt:desc',
      'pagination[pageSize]':'20',
      'fields[0]':'title',
    });
    let response;
    try{
      response=await fetchImpl(host.origin+'/api/news-articles?'+params,{
        method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
        redirect:'error',signal:AbortSignal.timeout(9000),
      });
    }catch{
      throw new Error('DEV pending lookup unavailable');
    }
    if(!response?.ok)
      throw new Error('DEV pending lookup failed (HTTP '+response?.status+')');
    let data;
    try{data=(await response.json())?.data;}catch{
      throw new Error('DEV pending lookup invalid CMS response');
    }
    if(!Array.isArray(data)||data.length>20)
      throw new Error('DEV pending lookup invalid CMS response');
    const documents=data.map(record=>{
      const documentId=record?.documentId;
      const title=record?.title;
      if(typeof documentId!=='string'||!/^[a-zA-Z0-9]{12,90}$/.test(documentId)||
         typeof title!=='string'||title.length<1||title.length>160)
        throw new Error('DEV pending lookup invalid CMS record');
      return {documentId,title};
    });
    return {count:documents.length,documents};
  };
}

async function main(){
  if(process.env.CURATOR_INSTANCE_KIND!=='dev')
    throw new Error('Pending draft lookup is DEV-only');
  if(!process.env.CURATOR_STRAPI_READ_TOKEN)
    throw new Error('Dedicated DEV read token required');
  const lookup=pendingDraftLookup({
    baseUrl:process.env.CURATOR_CMS_URL||'http://cms:1337',
    token:process.env.CURATOR_STRAPI_READ_TOKEN,
  });
  console.log(JSON.stringify({event:'pending_drafts_dev',...await lookup()}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{
    console.error('PENDING_DRAFT_LOOKUP_UNAVAILABLE: verify DEV CMS Reader permissions');
    process.exitCode=1;
  });
}
