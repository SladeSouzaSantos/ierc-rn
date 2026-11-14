import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {routerFromEnv} from './router.mjs';
import {cmsPublisher} from './cms-publish.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {autoPublishSettingsFromEnv} from './auto-config.mjs';
import {runEnemAiProd} from './enem-ai-prod.mjs';

// Only static internal reasons can leave this security boundary.
// Never print model outputs, CMS data, source paragraphs, tokens or stack traces.
const SAFE_DENIAL_REASONS=new Map([
  ['Dedicated acknowledged PROD environment required','prod_environment'],
  ['Explicit one-item licensed EBC PROD AI approval required','prod_policy'],
  ['Auto publication requires explicit licensed full-article review, environment-specific acknowledgment and live write mode','auto_publish_policy'],
  ['Explicit verified source allowlist required for auto publication','source_allowlist'],
  ['Separate scoped CMS publisher token required','publisher_credentials'],
  ['Pending Draft read unavailable','cms_unavailable'],
  ['Pending Draft read failed (HTTP 401)','cms_read_unauthorized'],
  ['Pending Draft read failed (HTTP 403)','cms_read_forbidden'],
  ['Pending Draft read failed (HTTP 404)','cms_read_missing'],
  ['Pending Draft response invalid','cms_response_invalid'],
  ['Article is already published','already_published'],
  ['Draft is not an unchanged AI-review-pending candidate','draft_not_pending'],
  ['ENEM source is not allowlisted for PROD autonomous publishing','source_allowlist'],
  ['PROD ENEM source policy mismatch','source_policy_mismatch'],
  ['PROD ENEM source or document identity mismatch','document_identity_mismatch'],
  ['PROD ENEM pending Draft status mismatch','draft_status_mismatch'],
  ['PROD ENEM source-derived slug mismatch','draft_slug_mismatch'],
  ['PROD ENEM article is outside verified 45-day evidence window','article_age_mismatch'],
  ['PROD ENEM draft failed exact content-integrity verification','draft_content_integrity'],
  ['Static ENEM editorial proposal is not canonical and publication-ready','proposal_validation'],
  ['PROD ENEM licensed full-article evidence unavailable','article_evidence_unavailable'],
  ['Invalid CMS document ID','cms_document_id'],
  ['Invalid model output','model_output'],
  ['ENEM PROD single-document review prerequisites missing','review_prerequisites'],
  ['Invalid immutable ENEM AI attempt claim','attempt_marker'],
  ['AI-approved ENEM candidate failed final canonical validation','final_draft_validation'],
  ['Publisher refuses incomplete editorial prose','publisher_content_validation'],
  ['Publisher preflight failed; draft changed or unverified','publisher_draft_changed'],
  ['Publisher write failed (HTTP 401)','publisher_unauthorized'],
  ['Publisher write failed (HTTP 403)','publisher_forbidden'],
]);
const SAFE_SOURCE_ERRORS=new Set([
  'source_permission_pending','article_rights_unverified',
  'article_url_invalid','article_redirect_blocked','article_http_error',
  'article_not_html','article_too_large','article_body_unavailable',
  'article_text_incomplete','article_unavailable',
]);
export function safeEnemProdDenial(error){
  const message=error?.message;
  if(typeof message==='string'&&SAFE_DENIAL_REASONS.has(message))
    return SAFE_DENIAL_REASONS.get(message);
  if(error?.name==='ArticleEvidenceError' && SAFE_SOURCE_ERRORS.has(error.reason))
    return 'evidence_'+error.reason;
  return 'unclassified';
}

async function main(){
  const env=process.env;
  const mode=process.argv[2];
  if(!['preview','publish'].includes(mode)||process.argv.length!==3)
    throw new Error('Use only preview or publish; target PROD ENEM ID is fixed');
  if(env.CURATOR_INSTANCE_KIND!=='prod'||
     env.CURATOR_ENABLED!=='true'||env.CURATOR_WRITE_DRAFTS!=='true'||
     env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
     env.CURATOR_CMS_URL!=='http://cms:1337'||
     env.CURATOR_REDIS_URL!=='redis://redis:6379')
    throw new Error('Dedicated acknowledged PROD environment required');
  const policy=autoPublishSettingsFromEnv(env,'once',{dryRun:false});
  if(!policy.autoPublish||!policy.allowedSources.includes('agencia-brasil-educacao')||
     env.CURATOR_ONCE_LIMIT!=='1')
    throw new Error('Explicit one-item licensed EBC PROD AI approval required');

  const publisher=cmsPublisher({
    baseUrl:env.CURATOR_CMS_URL,token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
    draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
  });
  const reader=(source,article)=>fetchArticleEvidence(source,article,{
    fetchImpl:createPacedEbcFetch(fetch),
  });
  const logger=event=>console.log(JSON.stringify({
    ts:new Date().toISOString(),...event,
  }));
  let redis=null;
  try{
    if(mode==='publish')
      redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
    const router=redis?routerFromEnv({
      env,state:new RedisQuotaState(redis,(await import('./providers.mjs')).settingsFromEnv(env)),
      logger,
    }):null;
    const result=await runEnemAiProd({
      mode,publisher,router,redis,articleReader:reader,
      allowedSources:policy.allowedSources,logger,
    });
    console.log(JSON.stringify(result));
  }finally{
    if(redis)await closeQuotaRedis(redis);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    console.error('ENEM_PROD_AI_DENIED: '+safeEnemProdDenial(error));
    process.exitCode=1;
  });
}
