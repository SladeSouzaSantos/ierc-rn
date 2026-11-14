/**
 * Pure, side-effect-free auto-publication policy gate.
 * Called by the CLI before connecting to Redis, providers or the CMS.
 * A deliberately narrow allowlist prevents preview-only sources being promoted.
 */
export const AUTO_PUBLISH_LICENSED_SOURCES=Object.freeze([
  'agencia-brasil-direitos','agencia-brasil-educacao',
  'agencia-brasil-esportes','agencia-brasil-internacional','eu-commission-news',
]);
const WRITABLE_RSS_SOURCES=new Set(AUTO_PUBLISH_LICENSED_SOURCES);
export function autoPublishSettingsFromEnv(env,cmd,{dryRun}){
  const autoPublish=env.CURATOR_AUTO_PUBLISH_ENABLED==='true';
  if(!autoPublish)return {autoPublish:false,allowedSources:[]};

  const instance=env.CURATOR_INSTANCE_KIND;
  if(!['dev','prod'].includes(instance)||dryRun||
      !['once','schedule'].includes(cmd)||
      env.CURATOR_FULL_ARTICLE_REVIEW_ENABLED!=='true'||
      env.CURATOR_AUTO_PUBLISH_ACK!=='FULL_ARTICLE_REVIEW_ACCEPTED'||
      (instance==='prod'&&(
        env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
        env.CURATOR_PROD_AUTO_PUBLISH_ACK!=='PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED')))
    throw new Error('Auto publication requires explicit licensed full-article review, environment-specific acknowledgment and live write mode');

  const allowedSources=(env.CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowedSources.length||
     !allowedSources.every(x=>WRITABLE_RSS_SOURCES.has(x))||
     new Set(allowedSources).size!==allowedSources.length)
    throw new Error('Explicit verified source allowlist required for auto publication');

  return {autoPublish:true,allowedSources};
}


/**
 * Independent, explicit opt-in for OFF-RSS EBC discovery. A previously
 * authorized RSS auto-publisher NEVER gains archive crawling implicitly.
 * Check this before Redis, CMS, any LLM client or external HTTP request.
 */
export function ebcArchivePublishingFromEnv(env,cmd,{autoPublish,allowedSources,dryRun}){
  const flag=env.CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED;
  if(flag===undefined||flag===''||flag==='false')return false;
  if(flag!=='true'||!['dev','prod'].includes(env.CURATOR_INSTANCE_KIND)||
    (env.CURATOR_INSTANCE_KIND==='prod'&&
      env.CURATOR_PROD_EBC_ARCHIVE_ACK!=='PROD_EBC_ARCHIVE_APPROVED')||
    !['schedule','once'].includes(cmd)||!autoPublish||dryRun||
    !Array.isArray(allowedSources)||
    !allowedSources.includes('agencia-brasil-educacao')||
    env.CURATOR_FULL_ARTICLE_REVIEW_ENABLED!=='true'||
    env.CURATOR_AUTO_PUBLISH_ACK!=='FULL_ARTICLE_REVIEW_ACCEPTED')
    throw new Error('Archive discovery requires explicit environment authorization and licensed EBC Education auto-publication');
  return true;
}


/**
 * Read-only CLI commands must never inherit the autonomous publishing policy
 * from the already-running DEV/PROD schedule. That policy is intentionally
 * strict for write-capable commands, but cannot gate an isolated preview.
 *
 * This is resolved BEFORE Redis, CMS or LLM clients are constructed.
 */
export function publishingPolicyForCommand(env,cmd,{dryRun}={}){
  if(['preview','generate-preview','review-preview','review-full-preview'].includes(cmd))
    return {autoPublish:false,allowedSources:[],archiveDiscovery:false};

  const {autoPublish,allowedSources}=autoPublishSettingsFromEnv(env,cmd,{dryRun});
  const archiveDiscovery=ebcArchivePublishingFromEnv(env,cmd,
    {autoPublish,allowedSources,dryRun});
  return {autoPublish,allowedSources,archiveDiscovery};
}
