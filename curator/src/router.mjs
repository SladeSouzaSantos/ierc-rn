import { providersFromEnv, settingsFromEnv } from './providers.mjs';
export class LlmExhaustedError extends Error {
  constructor(reason, diagnostics) { super(reason);this.name='LlmExhaustedError';this.diagnostics=diagnostics; }
}
class ModelHttpError extends Error {
  constructor(status,retryAfter) { super('Model HTTP status '+status);this.status=status;this.retryAfter=retryAfter; }
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
  const value=provider.kind==='ollama'
    ? payload?.message?.content
    : payload?.choices?.[0]?.message?.content;
  if (typeof value!=='string' || !value.trim() || value.length>20000) {
    const e=new Error('Model response is empty or invalid');
    e.name='InvalidModelOutput';throw e;
  }
  return value.trim();
}
export class FreeLlmRouter {
  constructor({providers,state,settings,fetchImpl=fetch,now=()=>Date.now(),logger=()=>{}}) {
    this.providers=providers;this.state=state;this.settings=settings;
    this.fetchImpl=fetchImpl;this.now=now;this.logger=logger;
  }
  async complete({system,prompt}) {
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
          : {model:provider.model,stream:false,max_tokens:900,temperature:0.2,messages:[{role:'system',content:system},{role:'user',content:prompt}]};
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
        this.logger({event:'llm_attempt',provider:provider.id,result:category,ms:this.now()-start});
      } finally {clearTimeout(timer);}
    }
    throw new LlmExhaustedError('all_free_providers_unavailable',attempts);
  }
}
export function routerFromEnv({env=process.env,state,fetchImpl=fetch,logger=()=>{}}) {
  return new FreeLlmRouter({providers:providersFromEnv(env),settings:settingsFromEnv(env),state,fetchImpl,logger});
}
