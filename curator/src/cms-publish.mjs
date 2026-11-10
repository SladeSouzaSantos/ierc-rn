import {createHash} from 'node:crypto';

// Separate least-privilege REST client. It only receives a token with findOne
// and update for News-article. It cannot create drafts or modify other types.
export function cmsPublisher({baseUrl,token,draftToken,fetchImpl=fetch}){
  const host=new URL(baseUrl);
  if(host.protocol!=='http:'||!['cms','localhost','127.0.0.1'].includes(host.hostname)||
     (host.pathname!==''&&host.pathname!=='/'))
    throw new Error('Publisher CMS URL must be private');
  if(!token||token.length<10||token===draftToken)
    throw new Error('Separate scoped CMS publisher token required');
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  return {
    async publishApprovedDraft(documentId,expected){
      if(!/^[a-zA-Z0-9]{12,90}$/.test(documentId))
        throw new Error('Invalid CMS document ID');
      if(!expected||!/^https:\/\//.test(expected.sourceUrl||'')||
         !/^[a-f0-9]{64}$/i.test(expected.dedupeKey||''))
        throw new Error('Invalid approved source');
      const url=host.origin+'/api/news-articles/'+encodeURIComponent(documentId);
      // Authenticate against the exact draft just created by this worker.
      // This is not a bulk publish operation or an approval of existing drafts.
      let response;
      try{
        response=await fetchImpl(url+'?status=draft',{
          method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(8000),
        });
      }catch{throw new Error('Publisher read unavailable');}
      if(!response.ok)throw new Error('Publisher read failed (HTTP '+response.status+')');
      let current;
      try{current=(await response.json())?.data;}
      catch{throw new Error('Publisher draft response invalid');}
      if(!current||current.documentId!==documentId||current.publishedAt!==null||
         current.editorialStatus!=='em_revisao'||current.originType!=='externa'||
         current.aiAssisted!==true||current.dedupeKey!==expected.dedupeKey||
         current.sourceUrl!==expected.sourceUrl||current.slug!==expected.slug||
         current.title!==expected.title||current.summary!==expected.summary||
         current.body!==expected.body||current.image)
        throw new Error('Publisher preflight failed; draft changed or unverified');
      const reference='ai-rss-v1-'+createHash('sha256')
        .update(expected.dedupeKey).digest('hex').slice(0,12);
      // In Strapi 5 PUT with status=published publishes immediately. Explicit
      // query is intentional and must NEVER be used on a general write client.
      try{
        response=await fetchImpl(url+'?status=published',{
          method:'PUT',headers:{...headers,'Content-Type':'application/json'},
          body:JSON.stringify({data:{
            editorialStatus:'aprovado',
            approvalReference:reference,
            approvalNote:'Revisão automática por IA restrita ao título e resumo RSS. Fonte original identificada; sem validação humana.',
          }}),
          redirect:'error',signal:AbortSignal.timeout(9000),
        });
      }catch{throw new Error('Publisher write unavailable');}
      if(!response.ok)throw new Error('Publisher write failed (HTTP '+response.status+')');
      let published;
      try{published=(await response.json())?.data;}
      catch{throw new Error('Publisher published response invalid');}
      if(published?.documentId!==documentId||published?.editorialStatus!=='aprovado'||
         typeof published?.publishedAt!=='string'||!Number.isFinite(Date.parse(published.publishedAt)))
        throw new Error('Publisher did not confirm published status');
      return {published:true};
    },
  };
}
