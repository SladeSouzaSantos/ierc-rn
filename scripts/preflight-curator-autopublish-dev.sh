#!/usr/bin/env bash
# Fail closed before a persistent curator can create/publish anything.
# Read-only checks: local branch, restore rehearsal, Compose configuration,
# env policy, segregated tokens, model IDs. No CMS writes or model calls.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [ "$(git branch --show-current)" != "dev" ]; then
  echo "PRECHECK_FAILED: DEV branch required" >&2; exit 1
fi
if [ ! -f curator/.env ]; then
  echo "PRECHECK_FAILED: local curator/.env is missing" >&2; exit 1
fi
if [ ! -f cms/.env ]; then
  echo "PRECHECK_FAILED: DEV CMS credentials are missing" >&2; exit 1
fi
# Reject automatic publication without a verified restore rehearsal snapshot.
if [ ! -d cms-backups ]; then
  echo "PRECHECK_FAILED: CMS backup directory missing" >&2; exit 1
fi
RESTORE_CHECK=$(find cms-backups -maxdepth 3 -type f -name RESTORE_VERIFIED.txt -mtime -7 -print -quit)
if [ -z "$RESTORE_CHECK" ]; then
  echo "PRECHECK_FAILED: no restore-verified CMS backup in the last 7 days" >&2
  exit 1
fi
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator config --quiet
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker node --input-type=module - <<'JS'
import {providersFromEnv, settingsFromEnv} from './src/providers.mjs';
import {autoPublishSettingsFromEnv} from './src/auto-config.mjs';
import {scheduleDraftLimitFromEnv} from './src/schedule-config.mjs';
import {cmsPublisher} from './src/cms-publish.mjs';

const env=process.env;
if(env.CURATOR_INSTANCE_KIND!=='dev'||env.CURATOR_ENABLED!=='true'||
   env.CURATOR_WRITE_DRAFTS!=='true')
  throw new Error('DEV worker and draft writing must be explicitly enabled');
if(env.CURATOR_FULL_ARTICLE_REVIEW_ENABLED!=='true')
  throw new Error('Verified full-article review is required');
const {autoPublish,allowedSources}=autoPublishSettingsFromEnv(env,'schedule',{dryRun:false});
if(!autoPublish||allowedSources.length===0)
  throw new Error('Automatic publishing authorization not configured');
if(allowedSources.some(s=>!s.startsWith('agencia-brasil-')))
  throw new Error('Initial live activation is limited to original Agencia Brasil sources');
if(scheduleDraftLimitFromEnv(env)!==1)
  throw new Error('Unsafe scheduled draft limit');
if(env.CURATOR_AUTO_RECOVER_PENDING_ENABLED!=='false' &&
   !/^[a-fA-F0-9]{64}$/.test(env.CURATOR_EDITORIAL_PROGRESS_KEY||''))
  throw new Error('DEV automatic recovery requires a private 32-byte editorial progress encryption key');
settingsFromEnv(env);
const providers=providersFromEnv(env);
if(!providers.length)throw new Error('No verified free LLM configured');
const cmsUrl=env.CURATOR_CMS_URL||'http://cms:1337';
if(!env.CURATOR_STRAPI_DRAFT_TOKEN||env.CURATOR_STRAPI_DRAFT_TOKEN.length<10)
  throw new Error('Scoped draft token missing');
cmsPublisher({baseUrl:cmsUrl,token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
  draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN});
console.log('PREFLIGHT_OK: dev, restore-tested backup, one item/slot, separate tokens, allowed sources.');
console.log('Providers: '+providers.map(p=>p.id).join(' -> '));
console.log('Allowlisted editorial sources: '+allowedSources.join(', '));
console.log('No LLM/CMS publication call made by this preflight.');
JS
