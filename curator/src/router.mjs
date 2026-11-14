import { providersFromEnv, settingsFromEnv } from './providers.mjs';
// Apply structured responses only to exact, documented model routes
// during the independent review phase. Shape validation is NOT fact checking.
// Draft generation and any other model retain the previous request contract.
// Gemini and Groq support strict schema decoding; the free OpenRouter route
// uses best-effort schema with the exact same fail-closed local validators.
export const INDEPENDENT_REVIEW_JSON_SCHEMA=Object.freeze({
  type:'object',
  properties:{
    decision:{type:'string',enum:['approve','hold'],
      description:'Approve only if every drafted fact is directly supported by the numbered source blocks; otherwise hold.'},
    factualSupport:{type:'string',enum:['fully_supported','insufficient'],
      description:'Use fully_supported only when ALL claims in the draft match the evidence blocks. Otherwise insufficient.'},
    evidenceQuotes:{type:'array',items:{type:'string'},
      description:'If approve: exactly 2 nonempty LITERAL substrings (12-160 characters), each from a DIFFERENT numbered evidence block. If hold: [] is allowed. Do not put E01/E02 IDs inside the quote.'},
    unsupportedClaims:{type:'array',items:{type:'string'},
      description:'Required array. If approve: []. If hold: list short unsupported draft claims, or [] if none identifiable.'},
    issues:{type:'array',items:{type:'string'},
      description:'Required array. If approve: []. If hold: brief editorial reasons, no article text excerpts.'},
  },
  required:['decision','factualSupport','evidenceQuotes','unsupportedClaims','issues'],
  additionalProperties:false,
});
function structuredReviewFormat(provider,phase){
  if(phase!=='review'||provider.kind!=='openai')return null;
  const strict=provider.id==='groq'&&provider.model==='openai/gpt-oss-120b' ||
    provider.id==='gemini'&&provider.model==='gemini-2.5-flash';
  const bestEffort=provider.id==='openrouter'&&
    provider.model==='nvidia/nemotron-3.5-super-vl:free';
  if(!strict&&!bestEffort)return null;
  return {type:'json_schema',json_schema:{
    name:'ierc_independent_review',strict:!!strict,
    schema:INDEPENDENT_REVIEW_JSON_SCHEMA,
  }};
}

export class LlmExhaustedError extends Error {
  constructor(reason, diagnostics) { super(reason);this.name='LlmExhaustedError';this.diagnostics=diagnostics; }
}
class ModelHttpError extends Error {
  constructor(status,retryAfter) { super('Model HTTP status '+status);this.status=status;this.retryAfter=retryAfter; }
}
// Fixed diagnostic labels only: never expose a provider body, prompt or credentials.
const SAFE_EDITORIAL_FIELDS=new Set(['title','summary','body','whyItMatters','category']);
const SAFE_EDITORIAL_CONSTRAINTS=new Set(['too_short','too_long','unfinished_sentence','invalid_type']);
const SAFE_SOURCE_CONSTRAINTS=new Set([
  'source_new_number','source_new_name','unverified_visual_audience',
]);
function invalidOutput(reason,diagnostic=null) {
  const error=new Error('Invalid model output');
  error.name='InvalidModelOutput';
  error.reason=reason;
  // Trust ONLY fixed field/constraint labels from the local validator.
  // Never copy text, lengths, prompts, or free-form model diagnostics.
  if((reason==='incomplete_draft' &&
       SAFE_EDITORIAL_CONSTRAINTS.has(diagnostic?.constraint) ||
      reason==='unverified_source_claim' &&
       SAFE_SOURCE_CONSTRAINTS.has(diagnostic?.constraint)) &&
     SAFE_EDITORIAL_FIELDS.has(diagnostic?.field)){
    error.editorialField=diagnostic.field;
    error.editorialConstraint=diagnostic.constraint;
  }
  return error;
}
function editorialFailureReason(error) {
  const message=error?.message;
  if(message==='Model output is not JSON')return 'json_syntax';
  if(message==='Incomplete model draft')return 'incomplete_draft';
  if(message==='Unsafe draft markup')return 'unsafe_markup';
  if(message==='Invalid editorial payload')return 'invalid_structure';
  if(message==='Unsupported source-anchored editorial claim')return 'unverified_source_claim';
  // Never expose provider output or text from the copyrighted article.
  // Static diagnostic tokens pinpoint why a free reviewer was rejected.
  if(message==='Invalid AI review'){
    const allowed=new Set(['empty_or_oversize','json_syntax','not_object',
      'missing_fields','invalid_decision','invalid_support',
      'invalid_quotes_type','invalid_claims_type','invalid_issues_type']);
    return allowed.has(error?.reviewReason)
      ? 'review_'+error.reviewReason:'schema_rejected';
  }
  return 'schema_rejected';
}
const fallbackFor = (err) => {
  if (err instanceof ModelHttpError) {
    if ([400,403,413,422].includes(err.status)) return null; // malformed input or policy refusal: do not retry
    if ([401,404].includes(err.status)) return 'configuration';
    if (err.status===402) return 'quota';
    if (err.status===408) return 'timeout';
    if (err.status===429) return 'rate_limit';
    if (err.status>=500) return 'unavailable';
    return null;
  }
  if (err?.name==='AbortError' || err?.name==='TimeoutError') return 'timeout';
  if (err?.name==='InvalidModelOutput') return 'invalid_output';
  return 'network';
};
function retryDelay(err, now, base, maximum, category) {
  let delay=['quota','configuration'].includes(category)?maximum:base;
  if (typeof err?.retryAfter==='string') {
    const s=err.retryAfter.trim();
    const time=/^\d{1,9}$/.test(s) ? Number(s)*1000 : Date.parse(s)-now;
    if (Number.isFinite(time) && time>=0) delay=Math.max(delay,time);
  }
  return Math.min(maximum,Math.max(1,Math.ceil(delay)));
}
function contentFromResponse(provider,payload) {
  const choice=payload?.choices?.[0];
  // Never accept truncated JSON as a finished draft, even if it parses.
  if (provider.kind!=='ollama' && choice?.finish_reason==='length')
    throw invalidOutput('token_limit');
  const value=provider.kind==='ollama'
    ? payload?.message?.content
    : choice?.message?.content;
  if (typeof value!=='string' || !value.trim()) {
    const reasoning=choice?.message?.reasoning;
    const hasReasoning=(typeof reasoning==='string' && reasoning.trim().length>0)
      || (Array.isArray(choice?.message?.reasoning_details) && choice.message.reasoning_details.length>0)
      || (Number(payload?.usage?.completion_tokens_details?.reasoning_tokens)>0);
    throw invalidOutput(hasReasoning?'reasoning_without_text':'empty_content');
  }
  if (value.length>20000)throw invalidOutput('oversize_content');
  return value.trim();
}
export class FreeLlmRouter {
  constructor({providers,state,settings,fetchImpl=fetch,now=()=>Date.now(),logger=()=>{}}) {
    this.providers=providers;this.state=state;this.settings=settings;
    this.fetchImpl=fetchImpl;this.now=now;this.logger=logger;
  }
  async complete({system,prompt,validateOutput,phase='default'}) {
    if(!['default','draft','review'].includes(phase))
      throw new Error('Unsupported LLM editorial phase');
    const attempts=[];
    if (!this.providers.length) throw new LlmExhaustedError('no_free_provider_configured',attempts);
    for (const provider of this.providers) {
      if (attempts.filter(x=>x.action==='attempt').length>=this.settings.maxAttempts) break;
      // Provider API failures remain shared, but malformed prose in one phase
      // should not prevent a free provider from serving the different review task.
      const sharedCooldown=await this.state.remainingCooldown(provider.id);
      const phaseCooldown=phase==='default'?0:
        await this.state.remainingCooldown(provider.id+'_'+phase);
      if (Math.max(sharedCooldown,phaseCooldown)>0) {
        attempts.push({provider:provider.id,action:'cooldown'});continue;
      }
      const quota=await this.state.reserve(provider);
      if (quota==='global_limited') throw new LlmExhaustedError('global_quota_reached',attempts);
      if (quota==='provider_limited') {attempts.push({provider:provider.id,action:'local_quota'});continue;}
      const start=this.now();
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),this.settings.timeoutMs);
      try {
        const body=provider.kind==='ollama'
          ? {model:provider.model,stream:false,messages:[{role:'system',content:system},{role:'user',content:prompt}]}
          : {model:provider.model,stream:false,
              max_tokens:this.settings.outputMaxTokens||1600,temperature:0.2,
              ...(provider.id==='openrouter' && typeof provider.reasoningEnabled==='boolean'
                ? {reasoning:{enabled:provider.reasoningEnabled}} : {}),
              ...(provider.id==='gemini' && provider.reasoningEffort==='none'
                ? {reasoning_effort:'none'} : {}),
              // Schema-constrained reviewer output. An "approve" is not
              // accepted until independent fact/quote/license gates pass.
              ...(structuredReviewFormat(provider,phase)
                ? {response_format:structuredReviewFormat(provider,phase)} : {}),
              messages:[{role:'system',content:system},{role:'user',content:prompt}]};
        const response=await this.fetchImpl(provider.url,{
          method:'POST',headers:{
            'Content-Type':'application/json',
            ...(provider.kind==='ollama'?{}:{Authorization:'Bearer '+provider.key}),
          },body:JSON.stringify(body),signal:controller.signal,redirect:'error',
        });
        if (!response.ok) throw new ModelHttpError(response.status,response.headers.get('retry-after'));
        // Never log provider error bodies, response contents or credentials.
        let data;
        try {data=await response.json();}
        catch {throw invalidOutput('response_json');}
        const content=contentFromResponse(provider,data);
        // An HTTP 200 with a malformed editorial JSON draft is not usable.
        // Count the attempt and try the next FREE provider, never a paid route.
        if (validateOutput) {
          try { validateOutput(content); }
          catch (error) {
            throw invalidOutput(editorialFailureReason(error),{
              field:error?.editorialField,constraint:error?.editorialConstraint,
            });
          }
        }
        attempts.push({provider:provider.id,action:'attempt',result:'success'});
        this.logger({event:'llm_attempt',provider:provider.id,result:'success',ms:this.now()-start});
        return {content,provider:provider.id,attempts:attempts.filter(x=>x.action==='attempt').length,fallbackUsed:attempts.some(x=>x.provider!==provider.id)};
      } catch (error) {
        const category=fallbackFor(error);
        if (!category) {
          // HTTP status only, from a fixed allowlist. Provider response
          // bodies, prompts and tokens must never reach operational logs.
          const safeStatus=error instanceof ModelHttpError &&
            [400,403,413,422].includes(error.status) ? error.status : null;
          this.logger({event:'llm_attempt',provider:provider.id,
            result:'terminal',reason:safeStatus?`http_${safeStatus}`:'non_retryable'});
          throw new LlmExhaustedError('non_retryable_model_error',attempts);
        }
        const delay=retryDelay(error,this.now(),this.settings.cooldownMs,this.settings.maxCooldownMs,category);
        await this.state.block(category==='invalid_output'&&phase!=='default'
          ? provider.id+'_'+phase:provider.id,delay);
        attempts.push({provider:provider.id,action:'attempt',result:category});
        this.logger({event:'llm_attempt',provider:provider.id,result:category,
          ...(category==='invalid_output'?{
            reason:error?.reason||'invalid_response',
            ...(error?.editorialField&&error?.editorialConstraint?
              {field:error.editorialField,constraint:error.editorialConstraint}:{})
          }:{}),
          ms:this.now()-start});
      } finally {clearTimeout(timer);}
    }
    throw new LlmExhaustedError('all_free_providers_unavailable',attempts);
  }
}
export function routerFromEnv({env=process.env,state,fetchImpl=fetch,logger=()=>{}}) {
  return new FreeLlmRouter({providers:providersFromEnv(env),settings:settingsFromEnv(env),state,fetchImpl,logger});
}
