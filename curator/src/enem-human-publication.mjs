import {createHash} from 'node:crypto';
import {SOURCES} from './feeds.mjs';
import {validateDraft,slugFor} from './editorial.mjs';

export const ENEM_DOCUMENT_ID='nxh3gri9njyrag8uvbtgux4i';
export const ENEM_SOURCE_URL='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-2026-estreia-apoio-emocional-e-novas-regras-de-acessibilidade';
export const ENEM_EVIDENCE_DIGEST_PREFIX='ee5278825708';

// Original synthesis in pt-BR, grounded in the official 08/11/2026 EBC story.
// Do not copy the source, imply that all requests were fulfilled, or reuse
// the inconsistent minister surname in the source body vs image caption.
export const ENEM_EDITORIAL_PROPOSAL=Object.freeze({
  title:'Enem 2026 prevê apoio emocional e novos recursos de acessibilidade',
  summary:'O Enem 2026 prevê acompanhante ou cão de apoio emocional para participantes com solicitação de atendimento especializado aprovada pelo Inep. A edição também inclui a fibromialgia entre as condições que podem motivar esse atendimento.',
  body:'Segundo a Agência Brasil, o Enem 2026 passou a prever acompanhante ou cão de apoio emocional para participantes com histórico de crises de ansiedade, Transtorno Obsessivo-Compulsivo (TOC) ou outras alterações emocionais. O atendimento especializado precisava ser solicitado durante a inscrição e aprovado pelo Inep. A reportagem registra 138.329 solicitações confirmadas de atendimento especializado e informa a inclusão da fibromialgia entre as condições que podem motivar esse pedido. Entre os recursos solicitados estão tempo adicional, correção diferenciada e auxílio para leitura.',
  whyItMatters:'Para pessoas com deficiência visual, a notícia destaca recursos previstos no Enem, como o auxílio para leitura, e apresenta diferentes necessidades consideradas no atendimento especializado.',
  category:'Educação inclusiva',
});

const sha=value=>createHash('sha256').update(value).digest('hex');
const FIELDS=['title','summary','body','whyItMatters','category'];

function validateProposal(){
  const valid=validateDraft(JSON.stringify(ENEM_EDITORIAL_PROPOSAL));
  if(!valid||FIELDS.some(k=>valid[k]!==ENEM_EDITORIAL_PROPOSAL[k])||
     ENEM_EDITORIAL_PROPOSAL.title.length>150||
     ENEM_EDITORIAL_PROPOSAL.summary.length>250||
     ENEM_EDITORIAL_PROPOSAL.body.length>1000||
     ENEM_EDITORIAL_PROPOSAL.whyItMatters.length>350||
     ![valid.summary,valid.body,valid.whyItMatters]
       .every(s=>/[.!?…]$/u.test(s)))
    throw new Error('Manual editorial proposal must be complete and canonical');
  return valid;
}

function sameCmsDraft(a,b){
  return ['documentId','title','summary','body','whyItMatters','category',
    'slug','sourceUrl','dedupeKey','editorialStatus','approvalNote',
    'originalTitle','originalPublishedAt','sourceName','sourceLanguage',
    'originType','aiAssisted'].every(k=>a?.[k]===b?.[k])&&
    a?.publishedAt===null&&b?.publishedAt===null&&
    a?.image==null&&b?.image==null;
}

export async function prepareEnemEditorialPublication({
  publisher,articleReader,now=Date.now(),
}={}){
  if(typeof publisher?.readPendingDraft!=='function'||
     typeof articleReader!=='function')
    throw new Error('Scoped DEV publisher and licensed evidence reader required');
  const pending=await publisher.readPendingDraft(ENEM_DOCUMENT_ID);
  const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');
  if(!source||pending.documentId!==ENEM_DOCUMENT_ID||
     pending.sourceUrl!==ENEM_SOURCE_URL||
     pending.sourceName!==source.name||
     pending.sourceLanguage!==source.language||
     pending.originalTitle!=='Enem 2026 estreia apoio emocional e novas regras de acessibilidade'||
     !pending.originalPublishedAt?.startsWith('2026-11-08')||
     pending.dedupeKey!==sha(ENEM_SOURCE_URL)||
     pending.slug!==slugFor({dedupeKey:pending.dedupeKey},pending.title)||
     !Number.isFinite(Date.parse(pending.originalPublishedAt))||
     now-Date.parse(pending.originalPublishedAt)>45*86400000||
     Date.parse(pending.originalPublishedAt)>now+86400000||
     pending.editorialStatus!=='em_revisao')
    throw new Error('ENEM DEV document or source does not match reviewed candidate');
  const sourceArticle={
    url:ENEM_SOURCE_URL,title:pending.originalTitle,
    publishedAt:pending.originalPublishedAt,dedupeKey:pending.dedupeKey,
  };
  const evidence=await articleReader(source,sourceArticle);
  if(evidence?.verified!==true||evidence.mode!=='full_article'||
     evidence.sourceUrl!==ENEM_SOURCE_URL||
     evidence.sourceId!=='agencia-brasil-educacao'||
     evidence.licenseReference!==source.fullTextAccess.reference||
     !evidence.digest?.startsWith(ENEM_EVIDENCE_DIGEST_PREFIX)||
     !Array.isArray(evidence.blocks)||evidence.blocks.length<3)
    throw new Error('Licensed EBC article evidence changed or cannot be verified');
  const proposal=validateProposal();
  const proposalSlug=slugFor({dedupeKey:pending.dedupeKey},proposal.title);
  const approvalDigest=sha(JSON.stringify({
    version:1,documentId:ENEM_DOCUMENT_ID,
    sourceUrl:ENEM_SOURCE_URL,sourceDigest:evidence.digest,
    previousCmsDraft: FIELDS.map(k=>pending[k]),
    originalCmsSlug:pending.slug,originalApprovalNote:pending.approvalNote,
    proposed: FIELDS.map(k=>proposal[k]),proposedSlug:proposalSlug,
  }));
  return {
    preview:{
      event:'human_editorial_review_required',
      documentId:ENEM_DOCUMENT_ID,
      sourceUrl:ENEM_SOURCE_URL,
      licenseReference:evidence.licenseReference,
      evidenceDigest:evidence.digest,
      oldStatus:'Draft',
      approvalDigest,
      newDraft:{...proposal,slug:proposalSlug},
      warning:'Only publish after operator reads and fact-checks all proposed fields; never treat this as AI approval.',
    },
    pending,proposal,proposalSlug,approvalDigest,
  };
}

export async function publishEnemHumanReviewed({
  publisher,articleReader,fetchImpl=fetch,baseUrl='http://cms:1337',
  token,draftToken,approvalDigest,now=Date.now(),
}={}){
  if(typeof approvalDigest!=='string'||!/^[a-f0-9]{64}$/.test(approvalDigest)||
     !token||token===draftToken||token.length<10)
    throw new Error('Explicit human approval digest and distinct publisher token required');
  const host=new URL(baseUrl);
  if(host.protocol!=='http:'||!['cms','localhost','127.0.0.1'].includes(host.hostname)||
     !['','/'].includes(host.pathname)||host.search||host.hash)
    throw new Error('DEV private CMS URL required');
  const ready=await prepareEnemEditorialPublication({publisher,articleReader,now});
  if(approvalDigest!==ready.approvalDigest)
    throw new Error('Editorial approval digest mismatch; do not publish');
  const url=host.origin+'/api/news-articles/'+ENEM_DOCUMENT_ID;
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  // Re-read immediately before write; reject any intervening editorial edits.
  const get=await fetchImpl(url+'?status=draft',{
    method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(9000),
  });
  if(!get.ok)throw new Error('Fresh DEV Draft preflight unavailable');
  let current;
  try{current=(await get.json())?.data;}catch{throw new Error('Invalid CMS preflight response');}
  if(!sameCmsDraft(current,ready.pending))
    throw new Error('Draft changed after approval; refusing publication');
  const fields={...ready.proposal,slug:ready.proposalSlug,
    editorialStatus:'aprovado',
    approvalReference:'human-editorial-v1-'+approvalDigest.slice(0,12),
    approvalNote:'Revisão editorial supervisionada confirmada pelo operador em DEV. Síntese original com base na reportagem Agência Brasil de 08/11/2026. Fonte: '+ENEM_SOURCE_URL+'. Evidência SHA256 '+ready.preview.evidenceDigest+'. Aprovação de conteúdo SHA256 '+approvalDigest+'. Não é uma aprovação automática por IA.',
  };
  const response=await fetchImpl(url+'?status=published',{
    method:'PUT',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({data:fields}),redirect:'error',
    signal:AbortSignal.timeout(9000),
  });
  if(!response.ok)throw new Error('DEV CMS editorial publish failed (HTTP '+response.status+')');
  let saved;
  try{saved=(await response.json())?.data;}catch{throw new Error('Invalid published CMS response');}
  if(saved?.documentId!==ENEM_DOCUMENT_ID||
     saved?.editorialStatus!=='aprovado'||
     saved?.approvalReference!==fields.approvalReference||
     !Number.isFinite(Date.parse(saved?.publishedAt||''))||
     Object.entries(fields).some(([k,v])=>saved[k]!==v))
    throw new Error('CMS did not confirm exact human-reviewed publication');
  // A read-back is stronger than trusting the PUT response alone.
  const readBack=await fetchImpl(url+'?status=published',{
    method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(9000),
  });
  if(!readBack.ok)throw new Error('Published CMS read-back unavailable');
  let published;
  try{published=(await readBack.json())?.data;}catch{throw new Error('Invalid published read-back');}
  if(published?.documentId!==ENEM_DOCUMENT_ID||
     published?.editorialStatus!=='aprovado'||
     !Number.isFinite(Date.parse(published?.publishedAt||''))||
     Object.entries(fields).some(([k,v])=>published[k]!==v))
    throw new Error('Published CMS read-back did not match reviewed content');
  return {event:'human_reviewed_draft_published_dev',documentId:ENEM_DOCUMENT_ID,
    status:'Published',editorialStatus:'aprovado',slug:fields.slug,
    approvalReference:fields.approvalReference};
}
