import "server-only";
import {CBDV_CALENDAR_URL,parseCbdvGoalballCalendar} from "./cbdv-calendar-parser";
import type {CbdvCompetition} from "./cbdv-calendar-parser";
export {CBDV_CALENDAR_URL} from "./cbdv-calendar-parser";
export type {CbdvCompetition} from "./cbdv-calendar-parser";

/**
 * Read-through refresh: Next.js caches the fixed HTTPS calendar URL for six
 * hours. New posts appear on the next visit after cache expiry; there is
 * no background scheduler and no write to the CMS.
 */
export async function getCbdvGoalballCalendar():Promise<CbdvCompetition[]> {
  try{
    const res=await fetch(CBDV_CALENDAR_URL,{
      headers:{"Accept":"text/html","User-Agent":"IERC-RN-Public-Calendar/1.0"},
      redirect:"error",
      next:{revalidate:21600},
      signal:AbortSignal.timeout(6000),
    });
    if(!res.ok||!res.headers.get("content-type")?.includes("text/html"))return [];
    const declared=Number(res.headers.get("content-length")||0);
    if(declared>950_000)return [];
    const html=await res.text();
    return parseCbdvGoalballCalendar(html);
  }catch{return [];}
}
