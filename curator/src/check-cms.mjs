import {cmsClient} from './editorial.mjs';

// One-shot authenticated GET preflight. No Redis, model calls, CMS writes or scheduler.
/**
 * On a 400, isolate which supported Strapi REST parameter is rejected.
 * All probes are authenticated GETs to the already-validated private CMS host.
 * Never log response data, bodies, headers, tokens, query values or URLs.
 */
async function diagnoseInvalidQuery({baseUrl,token}){
  const root=new URL(baseUrl).origin+'/api/news-articles';
  const dedupeKey='0'.repeat(64);
  const filters={'filters[dedupeKey][$eq]':dedupeKey};
  const pagination={'pagination[pageSize]':'1'};
  const probes=[
    ['collection',{}],
    ['draft_status',{status:'draft'}],
    ['pagination',pagination],
    ['dedupe_filter',filters],
    ['combined',{status:'draft',...filters,...pagination}],
  ];
  const results=[];
  for (const [step,query] of probes){
    let result;
    try {
      const parameters=new URLSearchParams(query).toString();
      const response=await fetch(root+(parameters?'?'+parameters:''),{
        method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
        redirect:'error',signal:AbortSignal.timeout(7000),
      });
      result={step,httpStatus:response.status};
      if(response.ok){
        try{
          const payload=await response.json();
          result.responseValid=Array.isArray(payload?.data);
        }catch{result.responseValid=false;}
      }
    }catch{
      result={step,outcome:'unreachable'};
    }
    results.push(result);
    if(result.httpStatus===401||result.httpStatus===403)break;
  }
  return results;
}
const env=process.env;
async function main(){
  if(env.CURATOR_INSTANCE_KIND!=='dev'){
    console.error('CMS_READ_CHECK_FAILED: check is restricted to DEV');
    return 2;
  }
  let cms;
  try{
    cms=cmsClient({baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
      token:env.CURATOR_STRAPI_DRAFT_TOKEN});
  }catch{
    console.error('CMS_READ_CHECK_FAILED: private DEV CMS URL or scoped token missing');
    return 2;
  }
  try{
    // A deterministic impossible-to-guess test key exercises the exact
    // authenticated Draft + dedupeKey filter without reading real article text.
    await cms.existing('0'.repeat(64));
    console.log(JSON.stringify({event:'cms_draft_lookup_check',status:'ok',readOnly:true}));
    return 0;
  }catch(error){
    const message=error?.message||'';
    // Only fixed reason codes and three-digit status. NEVER print response body,
    // the key/token, request options, or untrusted exception contents.
    const match=/^Strapi draft lookup failed \(HTTP ([1-5]\d\d)\)$/.exec(message);
    const status=match?Number(match[1]):null;
    const category=status===401?'authentication':
      status===403?'permission':
      status===400?'invalid_query':
      status===404?'endpoint_missing':
      status!==null && status>=500?'cms_server_error':
      message==='Invalid Strapi lookup response'?'response_shape':
      'connection_or_configuration';
    const diagnosticChecks=status===400
      ? await diagnoseInvalidQuery({baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
          token:env.CURATOR_STRAPI_DRAFT_TOKEN})
      : null;
    console.error(JSON.stringify({event:'cms_draft_lookup_check',status:'failed',
      category,...(status===null?{}:{httpStatus:status}),
      ...(diagnosticChecks?{diagnosticChecks}:{}),readOnly:true}));
    return 1;
  }
}
process.exitCode=await main();
