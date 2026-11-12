/** Curator schedule is DEV-only and may create at most one human-review draft per slot. */
export function scheduleDraftLimitFromEnv(env=process.env){
  const raw=env.CURATOR_SCHEDULE_LIMIT ?? '1';
  // Deliberate strict gate: higher throughput needs a separate review/approval.
  if(raw!=='1')throw new Error('CURATOR_SCHEDULE_LIMIT must be 1 in DEV');
  return 1;
}
