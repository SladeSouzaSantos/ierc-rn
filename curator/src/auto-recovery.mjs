import {createHash} from 'node:crypto';
import {retryPendingDraft} from './retry-pending.mjs';

// Bounded, opt-in autonomous recovery is not a way to override an AI HOLD.
// It reuses the original source rights checks and the single-correction +
// independent rereview gates. Attempts survive worker restarts in DEV Redis.
export const MAX_SCHEDULED_RECOVERY_ATTEMPTS=2;
const COUNTER_TTL_SECONDS=45*24*60*60;
const COUNTER_SCRIPT=[
  'local previous=tonumber(redis.call("GET",KEYS[1]) or "0")',
  'if previous>=tonumber(ARGV[1]) then return 0 end',
  'local next=redis.call("INCR",KEYS[1])',
  'if next==1 then redis.call("EXPIRE",KEYS[1],tonumber(ARGV[2])) end',
  'return next',
].join('; ');

export async function recoverOnePendingInSchedule({
  listPending,publisher,router,redis,allowedSources,logger=()=>{},
  recover=retryPendingDraft,
}={}){
  if(typeof listPending!=='function'||typeof recover!=='function'||
    !publisher||!router||!redis||typeof redis.eval!=='function'||
    !Array.isArray(allowedSources)||allowedSources.length===0)
    throw new Error('Scheduled recovery requires explicit licensed DEV clients');
  let documents;
  try{
    const list=await listPending();
    if(!Array.isArray(list?.documents)||list.documents.length>20)
      throw new Error('Invalid pending CMS response');
    documents=list.documents;
  }catch{
    logger({event:'pending_auto_scan_unavailable'});
    return null; // The normal licensed global discovery remains operational.
  }
  // Newest entries are presented first by Strapi. Pick oldest first so
  // one persistently held article does not monopolize each daily slot.
  for(const {documentId} of [...documents].reverse()){
    if(typeof documentId!=='string'||!/^[a-zA-Z0-9]{12,90}$/.test(documentId)){
      logger({event:'pending_auto_scan_unavailable'});
      return null;
    }
    const documentIdHash=createHash('sha256').update(documentId).digest('hex').slice(0,12);
    let attempt;
    try{
      attempt=await redis.eval(COUNTER_SCRIPT,1,
        'ierc:curator:auto-recovery:'+documentIdHash,
        MAX_SCHEDULED_RECOVERY_ATTEMPTS,COUNTER_TTL_SECONDS);
    }catch{
      logger({event:'pending_auto_quota_unavailable'});
      return {results:[{status:'pending_recovery_unavailable',reusedDraft:true}],
        preview:false,count:1,aiGenerated:false};
    }
    if(!Number.isInteger(attempt)||attempt<0||attempt>MAX_SCHEDULED_RECOVERY_ATTEMPTS)
      throw new Error('Invalid Redis recovery counter');
    if(attempt===0)continue;
    logger({event:'pending_auto_started',documentIdHash,attempt,
      maxAttempts:MAX_SCHEDULED_RECOVERY_ATTEMPTS});
    let result;
    try{
      result=await recover({documentId,publisher,router,store:redis,
        allowedSources,logger});
      if(!result||typeof result.status!=='string'||
         !['draft_published','draft_review_pending','locked'].includes(result.status))
        throw new Error('Invalid pending recovery result');
    }catch{
      logger({event:'pending_auto_failed',documentIdHash});
      result={status:'pending_recovery_failed'};
    }
    logger({event:'pending_auto_completed',documentIdHash,
      status:result.status,attempt});
    return {results:[{status:result.status,reusedDraft:true}],preview:false,
      count:1,aiGenerated:false};
  }
  if(documents.length>0)logger({event:'pending_auto_exhausted',
    inspected:documents.length,maxAttempts:MAX_SCHEDULED_RECOVERY_ATTEMPTS});
  return null;
}
