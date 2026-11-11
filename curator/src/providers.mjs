// Ordered failover derived from ORBE: OpenRouter → Gemini → Groq → optional local Ollama.
// No generic provider URL or paid model route is accepted.
const positive = (v, def, max) => {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('Invalid positive integer in curator configuration');
  return n;
};
export function settingsFromEnv(env = process.env) {
  const globalMax = positive(env.CURATOR_GLOBAL_MAX_CALLS, 30, 10000);
  const windowMs = positive(env.CURATOR_WINDOW_MS, 86400000, 2678400000);
  const maxAttempts = positive(env.CURATOR_MAX_ATTEMPTS, 4, 4);
  const timeoutMs = positive(env.CURATOR_ATTEMPT_TIMEOUT_MS, 15000, 60000);
  const outputMaxTokens = positive(env.CURATOR_MAX_OUTPUT_TOKENS, 1600, 4096);
  const cooldownMs = positive(env.CURATOR_COOLDOWN_MS, 60000, 2678400000);
  const maxCooldownMs = positive(env.CURATOR_MAX_COOLDOWN_MS, 86400000, 2678400000);
  if (maxCooldownMs < cooldownMs) throw new Error('Invalid cooldown interval');
  return {globalMax,windowMs,maxAttempts,timeoutMs,outputMaxTokens,cooldownMs,maxCooldownMs};
}
export function providersFromEnv(env = process.env) {
  const out = [];
  const add = (id, kind, url, key, model, cap) => {
    if (!key || !model) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,200}$/.test(model)) throw new Error('Invalid model identifier for '+id);
    out.push({id,kind,url,key,model,maxCalls:positive(cap,10,10000)});
  };
  if (env.CURATOR_OPENROUTER_API_KEY?.trim()) {
    const model = (env.CURATOR_OPENROUTER_MODEL || 'openrouter/free').trim();
    if (model !== 'openrouter/free' && !model.endsWith(':free'))
      throw new Error('OpenRouter paid models are blocked; use :free or openrouter/free');
    const reasoningEnv=env.CURATOR_OPENROUTER_REASONING_ENABLED;
    if(reasoningEnv && !['true','false'].includes(reasoningEnv))
      throw new Error('CURATOR_OPENROUTER_REASONING_ENABLED must be true or false');
    add('openrouter','openai','https://openrouter.ai/api/v1/chat/completions',
      env.CURATOR_OPENROUTER_API_KEY,model,env.CURATOR_OPENROUTER_MAX_CALLS);
    // This exact NVIDIA model defaults to reasoning, which can exhaust a short
    // editorial JSON token budget. Disable unless explicitly re-enabled.
    if (reasoningEnv==='false' ||
        (!reasoningEnv && model==='nvidia/nemotron-3.5-super-vl:free'))
      out[out.length-1].reasoningEnabled=false;
    if (reasoningEnv==='true')out[out.length-1].reasoningEnabled=true;
  }
  const gated = [
    ['gemini','https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'],
    ['groq','https://api.groq.com/openai/v1/chat/completions'],
  ];
  for (const [id,url] of gated) {
    const prefix = 'CURATOR_'+id.toUpperCase();
    const key = env[prefix+'_API_KEY']?.trim();
    if (!key) continue;
    // These accounts can have paid tiers: explicit operator confirmation is mandatory.
    if (env[prefix+'_FREE_TIER_CONFIRMED'] !== 'true')
      throw new Error(id+' requires an operator-confirmed free-tier-only account');
    if (!env[prefix+'_MODEL']?.trim()) throw new Error(id+' requires an explicit free-tier model');
    add(id,'openai',url,key,env[prefix+'_MODEL'].trim(),env[prefix+'_MAX_CALLS']);
    // Gemini 2.5 Flash spends output tokens on thinking by default, which can
    // truncate short editorial JSON. Google's OpenAI-compatible API accepts
    // reasoning_effort:none for 2.5 Flash (not 2.5 Pro or Gemini 3).
    if(id==='gemini' && /^gemini-2\\.5-flash(?:-|$)/.test(out[out.length-1].model))
      out[out.length-1].reasoningEffort='none';
  }
  if (env.CURATOR_OLLAMA_MODEL?.trim()) {
    const address = env.CURATOR_OLLAMA_URL || 'http://ollama:11434';
    const endpoint = new URL(address);
    if (endpoint.protocol !== 'http:' ||
       !['ollama','localhost','127.0.0.1'].includes(endpoint.hostname) ||
       (endpoint.pathname !== '/' && endpoint.pathname !== ''))
      throw new Error('Ollama must be an internal HTTP endpoint');
    add('ollama','ollama',endpoint.origin+'/api/chat','LOCAL_ONLY',
      env.CURATOR_OLLAMA_MODEL.trim(),env.CURATOR_OLLAMA_MAX_CALLS);
  }
  return out;
}
