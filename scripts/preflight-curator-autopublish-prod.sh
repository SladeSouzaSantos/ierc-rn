#!/usr/bin/env bash
# PROD auto-publication readiness gate. No model calls, no CMS writes and no scheduler.
# Requires fresh verified PROD DB backup and distinct scoped Strapi tokens.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
fail() { printf 'PROD_PREFLIGHT_FAILED: %s\n' "$*" >&2; exit 2; }

[[ "$(pwd -P)" == "/opt/projects/ierc-rn" ]] || fail "dedicated MAIN checkout required"
[[ "$(git branch --show-current)" == "main" ]] || fail "main branch required"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked working tree is not clean"
for file in cms/.env.prod curator/.env.prod; do
  [[ -f "$file" && -s "$file" && ! -L "$file" ]] || fail "missing or symlinked private PROD environment file: $file"
  mode=$(stat -c '%a' "$file")
  [[ "$mode" == "600" || "$mode" == "400" ]] || fail "private file needs chmod 600: $file"
done
# A marker appears ONLY after the PROD pg_restore rehearsal has completed.
[[ -d cms-backups ]] || fail "PROD backup/restore rehearsal missing"
restore=$(find cms-backups -maxdepth 2 -type f -path '*/prod-*/RESTORE_VERIFIED.txt' -mtime -7 -print -quit)
[[ -n "$restore" ]] || fail "no restore-verified PROD backup in last seven days"

for entry in 'CURATOR_INSTANCE_KIND=prod' 'CURATOR_CMS_URL=http://cms:1337' \
  'CURATOR_REDIS_URL=redis://redis:6379'; do
  grep -qxF "$entry" curator/.env.prod || fail "PROD identity, CMS or Redis endpoint mismatch"
done

docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator config --quiet || fail "PROD Compose validation failed"
docker compose --env-file curator/.env.prod -f compose.curator.prod.yml \
  --profile curator run --rm --no-deps -T worker node --input-type=module - <<'JS'
import {providersFromEnv,settingsFromEnv} from './src/providers.mjs';
import {autoPublishSettingsFromEnv,ebcArchivePublishingFromEnv} from './src/auto-config.mjs';
import {scheduleDraftLimitFromEnv} from './src/schedule-config.mjs';
import {cmsPublisher} from './src/cms-publish.mjs';

const env=process.env;
if(env.CURATOR_INSTANCE_KIND!=='prod' || env.CURATOR_ENABLED!=='true' ||
   env.CURATOR_WRITE_DRAFTS!=='true' ||
   env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED')
  throw new Error('PROD writer needs explicit opt-in and acknowledged instance');
if(env.CURATOR_PROD_AUTO_PUBLISH_ACK!=='PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED')
  throw new Error('PROD autonomous publication must be separately acknowledged');
if(env.CURATOR_CMS_URL!=='http://cms:1337' ||
   env.CURATOR_REDIS_URL!=='redis://redis:6379')
  throw new Error('PROD must use its own internal Strapi and Redis endpoints');
if(env.CURATOR_ONCE_LIMIT!=='1')
  throw new Error('PROD one-shot batch limit must be one');
if(scheduleDraftLimitFromEnv(env)!==1)
  throw new Error('PROD schedule limit must be one');
settingsFromEnv(env);
const providers=providersFromEnv(env);
if(!providers.length)throw new Error('At least one operator-confirmed free LLM is required');
// In PROD, refuse any fallback provider without an explicit zero-cost route.
// OpenRouter is model-level restricted. Groq/Gemini require account confirmation.
for(const provider of providers){
  if(provider.id==='openrouter' &&
    provider.model!=='openrouter/free' && !provider.model.endsWith(':free'))
    throw new Error('Nonfree OpenRouter model blocked');
  if(['gemini','groq'].includes(provider.id) &&
    env['CURATOR_'+provider.id.toUpperCase()+'_FREE_TIER_CONFIRMED']!=='true')
    throw new Error('Paid tier not confirmed disabled');
}
const {autoPublish,allowedSources}=autoPublishSettingsFromEnv(env,'schedule',{dryRun:false});
if(!autoPublish || allowedSources.length<1 ||
   allowedSources.some(s=>!s.startsWith('agencia-brasil-')))
  throw new Error('Only allowlisted, source-verified Agencia Brasil publications permitted');
ebcArchivePublishingFromEnv(env,'schedule',{autoPublish,allowedSources,dryRun:false});
if(!env.CURATOR_STRAPI_DRAFT_TOKEN || env.CURATOR_STRAPI_DRAFT_TOKEN.length<10 ||
   !env.CURATOR_STRAPI_PUBLISH_TOKEN || env.CURATOR_STRAPI_PUBLISH_TOKEN.length<10)
  throw new Error('Independent Custom Strapi draft and publish tokens missing');
cmsPublisher({baseUrl:env.CURATOR_CMS_URL,
  token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
  draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN});
console.log('PROD_PREFLIGHT_OK: independent CMS/Redis, fresh restored backup, licensed EBC sources, one item/slot and confirmed free LLMs.');
console.log('Providers: '+providers.map(p=>p.id).join(' -> '));
console.log('Sources: '+allowedSources.join(', '));
console.log('No CMS write, publication or LLM request was performed.');
JS
