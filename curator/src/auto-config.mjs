/**
 * Pure, side-effect-free auto-publication policy gate.
 * Called by the CLI before connecting to Redis, providers or the CMS.
 * A deliberately narrow allowlist prevents preview-only sources being promoted.
 */
const WRITABLE_RSS_SOURCES=new Set(['perkins','w3c-wai']);
export function autoPublishSettingsFromEnv(env,cmd,{dryRun}){
  const autoPublish=env.CURATOR_AUTO_PUBLISH_ENABLED==='true';
  if(!autoPublish)return {autoPublish:false,allowedSources:[]};

  if(env.CURATOR_INSTANCE_KIND!=='dev'||dryRun||
      !['once','schedule'].includes(cmd)||
      env.CURATOR_FULL_ARTICLE_REVIEW_ENABLED!=='true'||
      env.CURATOR_AUTO_PUBLISH_ACK!=='FULL_ARTICLE_REVIEW_ACCEPTED')
    throw new Error('Auto publication requires explicit DEV licensed full-article review acknowledgment and live write mode');

  const allowedSources=(env.CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowedSources.length||
     !allowedSources.every(x=>WRITABLE_RSS_SOURCES.has(x))||
     new Set(allowedSources).size!==allowedSources.length)
    throw new Error('Explicit verified source allowlist required for auto publication');

  return {autoPublish:true,allowedSources};
}
