import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {FreeLlmRouter,LlmExhaustedError} from './router.mjs';
import {validateReview} from './auto-review.mjs';
import {VERIFIED_REVIEW_SYSTEM,verifyFullArticleReview} from './full-article-review.mjs';

// Standalone, DEV-only review-contract diagnostic. All source and draft text
// is invented for the test, never from an article, CMS or Redis draft.
// It cannot publish, create drafts, edit CMS data, or fetch news feeds.
const blocks=Object.freeze([
  {id:'E01',text:'Em um exercício inteiramente fictício, a biblioteca instalou placas táteis nas estantes para orientar visitantes.'},
  {id:'E02',text:'O teste simulado também incluiu mapas em relevo junto à entrada principal do prédio.'},
  {id:'E03',text:'A equipe fictícia apresentou os recursos em uma reunião interna sobre acessibilidade.'},
]);
const source=Object.freeze({
  source:'Laboratório sintético IERC-RN',
  title:'Exercício fictício de recursos táteis em biblioteca',
  url:'https://example.invalid/diagnostico-nao-publicavel',
  publishedAt:'2026-01-01T12:00:00.000Z',
  language:'pt-BR',coverageTrack:'internacional',
});
const draft=Object.freeze({
  title:'Biblioteca fictícia testa recursos de orientação tátil',
  summary:'Em um exercício fictício, uma biblioteca testou placas táteis nas estantes e mapas em relevo na entrada para orientar visitantes.',
  body:'O material simulado descreveu a instalação de placas táteis nas estantes de uma biblioteca fictícia. Também apresentou mapas em relevo junto à entrada principal. A equipe incluiu esses recursos em uma reunião interna.',
  whyItMatters:'O exercício demonstra como recursos táteis podem ser descritos em materiais educativos sobre acessibilidade.',
  category:'educacao',
});
const evidence=Object.freeze({
  verified:true,mode:'full_article',sourceUrl:source.url,sourceId:'synthetic',
  digest:createHash('sha256').update('FICTICIO: IERC-RN test fixture').digest('hex'),
  licenseReference:'SYNTHETIC_TEST_ONLY',blocks,
});
const prompt=JSON.stringify({
  source:{name:source.source,url:source.url,originalTitle:source.title,
    date:source.publishedAt,language:source.language,coverageTrack:source.coverageTrack,
    relevanceToBrazil:'Avaliar SOMENTE se a síntese fictícia é sustentada pelos blocos simulados'},
  blocks,draft,
});

const safeFailure=new Set(['global_quota_reached','all_free_providers_unavailable',
  'non_retryable_model_error','no_free_provider_configured']);
const safeReasons=new Set(['full_article_review_passed','ai_review_hold',
  'unverifiable_full_article_quotes','sensitive_claims']);

export async function runSyntheticReviewDiagnostic({
  providers,state,settings,fetchImpl=fetch,logger=()=>{},
}){
  if(!Array.isArray(providers)||providers.length<1||providers.length>4||
    !providers.every(p=>['groq','gemini','openrouter','ollama'].includes(p?.id))||
    !state||!settings)
    throw new Error('Synthetic diagnostic requires scoped free providers and Redis quota state');
  const results=[];
  for(const provider of providers){
    let attempt=null;
    const router=new FreeLlmRouter({
      providers:[provider],state,settings:{...settings,maxAttempts:1},fetchImpl,
      logger:event=>{
        // Router emits static failure codes only. Never serialize model output.
        if(event.event==='llm_attempt')attempt={
          result:event.result,
          ...(event.result==='invalid_output'?{reason:event.reason}:{}),
        };
      },
    });
    let result;
    try{
      const completion=await router.complete({
        system:VERIFIED_REVIEW_SYSTEM,prompt,validateOutput:validateReview,
        phase:'review',
      });
      const parsed=validateReview(completion.content);
      const verdict=verifyFullArticleReview(source,draft,evidence,parsed);
      result={provider:provider.id,status:'schema_valid',
        decision:parsed.decision,
        evidenceGate:safeReasons.has(verdict.reason)?verdict.reason:'review_held'};
    }catch(error){
      result={provider:provider.id,status:'schema_unavailable',
        category:attempt?.result||'skipped_or_unavailable',
        ...(attempt?.reason?{reason:attempt.reason}:{}),
        ...(error instanceof LlmExhaustedError && safeFailure.has(error.message)
          ?{gate:error.message}:{}),
      };
    }
    logger({event:'review_schema_diagnostic',synthetic:true,...result});
    results.push(result);
  }
  return results;
}

async function main(){
  const env=process.env;
  if(env.CURATOR_INSTANCE_KIND!=='dev')
    throw new Error('Synthetic LLM diagnostic is restricted to DEV');
  // Optional single-provider scope avoids spending Gemini/OpenRouter
  // quota when diagnosing only Groq. Reject unknown/multiple arguments.
  const selected=process.argv[2];
  if(process.argv.length>3 || (selected &&
      !['groq','gemini','openrouter','ollama'].includes(selected)))
    throw new Error('Select at most one configured free provider');
  // Only model/Redis credential and quota clients are constructed. No CMS
  // token, publisher, writer, source discovery, or draft interface is touched.
  const providers=providersFromEnv(env).filter(p=>!selected||p.id===selected);
  if(providers.length===0)
    throw new Error('Selected free provider is not configured');
  const settings=settingsFromEnv(env);
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL||'redis://redis:6379');
  try{
    const state=new RedisQuotaState(redis,settings);
    const results=await runSyntheticReviewDiagnostic({
      providers,state,settings,logger:data=>console.log(JSON.stringify(data)),
    });
    console.log(JSON.stringify({event:'review_schema_diagnostic_completed',
      synthetic:true,providersChecked:results.length,cmsWrites:0,
      schemaValid:results.filter(x=>x.status==='schema_valid').length}));
  }finally{
    await closeQuotaRedis(redis);
  }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{
    // No exception details because provider/Redis errors may include secrets.
    console.error('SYNTHETIC_DIAGNOSTIC_UNAVAILABLE: check DEV Redis and free-provider readiness');
    process.exitCode=1;
  });
}
