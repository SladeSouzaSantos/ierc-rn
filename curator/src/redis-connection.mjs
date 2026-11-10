import Redis from 'ioredis';

/**
 * Explicitly await ioredis readiness before the FIRST command.
 * With enableOfflineQueue:false, an implicit connect + immediate PING races on
 * a fresh worker (especially Windows/Docker), then QUIT can hide the root error.
 * Any failure is closed: zero model calls can be made without Redis quotas.
 */
export async function connectQuotaRedis(url, createClient = (address, options) => new Redis(address, options)) {
  const redis = createClient(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 7000,
  });
  // Connection errors are handled through the explicit connect() rejection.
  // Never log a Redis URL or connection credentials.
  redis.on('error', () => {});
  try {
    await redis.connect();
    if (redis.status !== 'ready' || await redis.ping() !== 'PONG') {
      throw new Error('Redis did not reach ready state');
    }
    return redis;
  } catch {
    redis.disconnect();
    throw new Error('Redis is unavailable or not ready; quota enforcement blocked the AI request');
  }
}

/** Do not turn an earlier failed request into a second "stream isn't writable" error. */
export async function closeQuotaRedis(redis) {
  if (!redis) return;
  if (redis.status !== 'ready') {
    redis.disconnect();
    return;
  }
  try {
    await redis.quit();
  } catch {
    // A lost connection between readiness check and quit is not fatal;
    // avoid masking the preceding worker result/error.
    redis.disconnect();
  }
}
