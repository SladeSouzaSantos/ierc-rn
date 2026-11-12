// Atomic counters across worker replicas, inspired by ORBE's Redis budgets.
// All attempted calls, including failed calls and fallback calls, consume allowances.
const SCRIPT = [
  'local g=tonumber(redis.call("GET",KEYS[1]) or "0")',
  'local p=tonumber(redis.call("GET",KEYS[2]) or "0")',
  'if p>=tonumber(ARGV[2]) then return 0 end',
  'if g>=tonumber(ARGV[1]) then return -1 end',
  'if g==0 then redis.call("SET",KEYS[1],"1","PX",ARGV[3]) else redis.call("INCR",KEYS[1]) end',
  'if p==0 then redis.call("SET",KEYS[2],"1","PX",ARGV[3]) else redis.call("INCR",KEYS[2]) end',
  'return 1',
].join('\n');
const idPattern=/^[a-z][a-z0-9_-]{0,35}$/;
export class RedisQuotaState {
  constructor(redis, options) {
    this.redis=redis;
    this.globalMax=options.globalMax;
    this.windowMs=options.windowMs;
    this.prefix=options.prefix || 'ierc:curator:llm';
  }
  key(provider) {
    if (!idPattern.test(provider)) throw new Error('Invalid provider ID');
    return this.prefix+':'+provider;
  }
  async reserve(provider) {
    // A Redis outage is fatal and must not lead to unmetered LLM requests.
    const result=await this.redis.eval(SCRIPT,2,
      this.prefix+':global',this.key(provider.id),this.globalMax,provider.maxCalls,this.windowMs);
    if (result===1) return 'allowed';
    if (result===0) return 'provider_limited';
    if (result===-1) return 'global_limited';
    throw new Error('Corrupt LLM quota state');
  }
  async remainingCooldown(providerId) {
    const ttl=await this.redis.pttl(this.key(providerId)+':cooldown');
    if (ttl===-2) return 0;
    if (!Number.isSafeInteger(ttl) || ttl<1 || ttl>2678400000)
      throw new Error('Invalid cooldown state; refusing unmetered requests');
    return ttl;
  }
  async block(providerId, durationMs) {
    if (!Number.isSafeInteger(durationMs) || durationMs<1 || durationMs>2678400000)
      throw new Error('Invalid cooldown duration');
    const key=this.key(providerId)+':cooldown';
    const old=await this.remainingCooldown(providerId);
    if (old>=durationMs) return;
    await this.redis.set(key,'1','PX',durationMs);
  }
}
