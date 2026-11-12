/**
 * Read-only, fail-closed deduplication for both the AI preview and the
 * live writer. Published Strapi 5 documents retain a draft counterpart,
 * but we query BOTH statuses explicitly to avoid relying on that detail.
 */
export function cmsNewsReadOnly({baseUrl,token,fetchImpl=fetch}){
  let host;
  try{host=new URL(baseUrl);}catch{throw new Error('CMS read-only URL invalid');}
  if(host.protocol!=='http:'||!['cms','localhost','127.0.0.1'].includes(host.hostname)||
    (host.pathname!==''&&host.pathname!=='/'))
    throw new Error('CMS read-only URL must be private');
  if(typeof token!=='string'||token.length<10)
    throw new Error('Scoped CMS read token required');
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  async function lookupStatus(status,dedupeKey){
    if(!/^[a-f0-9]{64}$/i.test(dedupeKey||''))throw new Error('Invalid source fingerprint');
    const params=new URLSearchParams({
      status,'filters[dedupeKey][$eq]':dedupeKey,'pagination[pageSize]':'1',
    });
    let response;
    try{
      response=await fetchImpl(host.origin+'/api/news-articles?'+params,{
        method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(7000),
      });
    }catch{
      throw new Error('CMS read-only duplicate lookup unavailable');
    }
    if(!response?.ok)
      throw new Error('CMS read-only duplicate lookup failed (HTTP '+response?.status+')');
    let data;
    try{data=(await response.json())?.data;}catch{
      throw new Error('Invalid CMS read-only duplicate lookup response');
    }
    if(!Array.isArray(data)||data.length>1)
      throw new Error('Invalid CMS read-only duplicate lookup response');
    return data.length>0;
  }
  return Object.freeze({
    // Diagnostic endpoint checks only the draft query, preserving its existing
    // one-GET contract. Full deduplication must check both versions.
    async existingDraftOnly(dedupeKey){
      return lookupStatus('draft',dedupeKey);
    },
    async existing(dedupeKey){
      return await lookupStatus('draft',dedupeKey) ||
        await lookupStatus('published',dedupeKey);
    },
  });
}

/**
 * Only checks Redis seen keys and CMS read GETs. Never calls redis.set, eval,
 * expires, cms.create or cms.update. Quota metering for LLMs remains separate.
 */
export function previewDeduper({redis,cms}){
  if(!redis||typeof redis.exists!=='function'||!cms||typeof cms.existing!=='function'||
    'create' in cms||'publishApprovedDraft' in cms)
    throw new Error('Review preview requires read-only duplicate clients');
  return Object.freeze({
    async check(source){
      if(!/^[a-f0-9]{64}$/i.test(source?.dedupeKey||''))
        throw new Error('Invalid source fingerprint');
      let seen;
      try{seen=await redis.exists('ierc:curator:seen:'+source.dedupeKey);}catch{
        throw new Error('Redis read-only seen check unavailable');
      }
      if(!Number.isSafeInteger(seen)||seen<0)
        throw new Error('Invalid Redis seen lookup response');
      if(seen>0)return 'redis';
      return await cms.existing(source.dedupeKey)?'cms':null;
    },
  });
}
