// The DEV and PROD curators use the same timezone and a single atomic
// Redis claim per time slot. Only record a claim or first duplicate for that
// slot; remaining 30s polling is intentionally silent.
export const CURATOR_SCHEDULE_TIMEZONE='America/Fortaleza';
export const CURATOR_SCHEDULE_HOURS=Object.freeze(['08','13','19']);
export const CURATOR_SCHEDULE_LEASE_SECONDS=172800;

export function currentCuratorSlot(now=new Date()){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new Error('Scheduler requires a valid date');
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:CURATOR_SCHEDULE_TIMEZONE,year:'numeric',
    month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
    hourCycle:'h23',
  }).formatToParts(now);
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return Object.freeze({
    id:v.year+'-'+v.month+'-'+v.day+':'+v.hour,
    hour:v.hour,minute:v.minute,
  });
}

export function createCuratorSlotClaimer({redis,logger=()=>{},now=()=>new Date()}={}){
  if(!redis||typeof redis.set!=='function'||
    typeof logger!=='function'||typeof now!=='function')
    throw new Error('Scheduler requires Redis, logger and clock');
  let lastReportedSlot=null;
  return async function claim(){
    const slot=currentCuratorSlot(now());
    // Preserve EXACTLY the previous 3-minute window and 30s tick cadence.
    if(!CURATOR_SCHEDULE_HOURS.includes(slot.hour) || Number(slot.minute)>2)
      return {state:'outside_window',slot:slot.id};
    const key='ierc:curator:job:'+slot.id;
    const acquired=await redis.set(key,'1','EX',CURATOR_SCHEDULE_LEASE_SECONDS,'NX');
    if(acquired!=='OK' && acquired!==null)
      throw new Error('Unexpected Redis scheduler lease response');
    if(acquired==='OK'){
      lastReportedSlot=slot.id;
      logger({event:'schedule_slot_claimed',slot:slot.id});
      return {state:'claimed',slot:slot.id};
    }
    if(lastReportedSlot!==slot.id){
      lastReportedSlot=slot.id;
      logger({event:'schedule_slot_skipped',slot:slot.id,reason:'already_claimed'});
    }
    return {state:'already_claimed',slot:slot.id};
  };
}
