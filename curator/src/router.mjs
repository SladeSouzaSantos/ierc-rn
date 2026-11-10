import { providersFromEnv, settingsFromEnv } from './providers.mjs';
export class LlmExhaustedError extends Error {
  constructor(reason, diagnostics) { super(reason);this.name='LlmExhaustedError';this.diagnostics=diagnostics; }
}
class ModelHttpError extends Error {
  constructor(status,retryAfter) { super('Model HTTP status '+status);this.status=status;this.retryAfter=retryAfter; }
}
// Fixed diagnostic labels only: never expose a provider body, prompt or credentials.
function invalidOutput(reason) {
  const error=new Error('Invalid model output');
  error.name='InvalidModelOutput';
  error.reason=reason;
  return error;
}
function editorialFailureReason(error) {
  const message=error?.message;
  if(message==='Model output is not JSON')return 'json_syntax';
  if(message==='Incomplete model draft')return 'incomplete_draft';
  if(message==='Unsafe draft markup')return 'unsafe_markup';
  if(message==='Invalid editorial payload')return 'invalid_structure';
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
  async complete({system,prompt,validateOutput}) {
    const attempts=[];
    if (!this.providers.length) throw new LlmExhaustedError('no_free_provider_configured',attempts);
    for (const provider of this.providers) {
      if (attempts.filter(x=>x.action==='attempt').length>=this.settings.maxAttempts) break;
      const remaining=await this.state.remainingCooldown(provider.id);
      if (remaining>0) {attempts.push({provider:provider.id,action:'cooldown'});continue;}
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
              messages:[{role:'system',content:system},{role:'user',content:prompt}]};
        const response=await this.fetchImpl(provider.url,{
          method:'POST',headers:{
            'Content-Type':'application/json',
            ...(provider.kind==='ollama'?{}:{Authorization:'Bearer '+provider.key}),
          },body:JSON.stringify(body),signal:controller.signal,redirect:'error',
        });
        if (!response.ok) throw new ModelHttpError(response.status,response.headers.get('retry-after'));
        // Never log provider error bodies, response contents or credentials.
        const data=await response.json();
        const content=contentFromResponse(provider,data);
        // An HTTP 200 with a malformed editorial JSON draft is not usable.
        // Count the attempt and try the next FREE provider, never a paid route.
        if (validateOutput) {
          try { validateOutput(content); }
          catch (error) {
            throw invalidOutput(editorialFailureReason(error));
          }
        }
        attempts.push({provider:provider.id,action:'attempt',result:'success'});
        this.logger({event:'llm_attempt',provider:provider.id,result:'success',ms:this.now()-start});
        return {content,provider:provider.id,attempts:attempts.filter(x=>x.action==='attempt').length,fallbackUsed:attempts.some(x=>x.provider!==provider.id)};
      } catch (error) {
        const category=fallbackFor(error);
        if (!category) {
          this.logger({event:'llm_attempt',provider:provider.id,result:'terminal'});
          throw new LlmExhaustedError('non_retryable_model_error',attempts);
        }
        const delay=retryDelay(error,this.now(),this.settings.cooldownMs,this.settings.maxCooldownMs,category);
        await this.state.block(provider.id,delay);
        attempts.push({provider:provider.id,action:'attempt',result:category});
        this.logger({event:'llm_attempt',provider:provider.id,result:category,
          ...(category==='invalid_output'?{reason:error?.reason||'invalid_response'}:{}),
          ms:this.now()-start});
      } finally {clearTimeout(timer);}
    }
    throw new LlmExhaustedError('all_free_providers_unavailable',attempts);
  }
}
export function routerFromEnv({env=process.env,state,fetchImpl=fetch,logger=()=>{}}) {
  return new FreeLlmRouter({providers:providersFromEnv(env),settings:settingsFromEnv(env),state,fetchImpl,logger});
}
