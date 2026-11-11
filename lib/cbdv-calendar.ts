import "server-only";

/**
 * CBDV official calendar reader. It NEVER infers that the IERC-RN is a
 * participant. Entries are announcements for the CBDV circuit only.
 * No LLM, scraping of third-party links, DB writes or remote forms.
 */
export const CBDV_CALENDAR_URL = "https://www.cbdv.org.br/calendario";
export type CbdvCompetition = {
  key: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  modality: "Goalball";
  sourceUrl: typeof CBDV_CALENDAR_URL;
  participation: "nao_confirmada";
};

const monthIndex: Record<string,number> = {
  jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,
  jul:6,ago:7,set:8,out:9,nov:10,dez:11,
};
const unescapeHtml = (s:string) => s.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|[0-9]+));/gi, entity => {
  const known:Record<string,string> = {"&nbsp;":" ","&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"};
  const key=entity.toLowerCase();
  if(known[key])return known[key];
  const raw=entity.slice(2,-1);
  if(entity.startsWith("&#")){
    const n=raw.startsWith("x")?parseInt(raw.slice(1),16):parseInt(raw,10);
    return Number.isInteger(n)&&n>=32&&n<=0x10ffff?String.fromCodePoint(n):" ";
  }
  return " ";
});
const textFrom = (html:string) => unescapeHtml(html.replace(/<[^>]*>/g," "))
  .replace(/\s+/g," ").trim();
const normalize = (s:string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const monthDay = (text:string,year:number) => {
  const match=/^(\d{1,2})\s*\/\s*([a-zçãé]+)$/i.exec(normalize(text));
  if(!match || !(match[2] in monthIndex))return null;
  const day=Number(match[1]),month=monthIndex[match[2]];
  const date=new Date(Date.UTC(year,month,day,12));
  if(date.getUTCDate()!==day || date.getUTCMonth()!==month)return null;
  return date;
};
const dateIso=(date:Date)=>date.toISOString().slice(0,10);

/**
 * Looks only at tables below the TORNEIOS heading and a YYYY calendar
 * heading, excluding athlete rankings, old newsletters and training camps.
 */
export function parseCbdvGoalballCalendar(html:string,{now=new Date(),limit=20}:
  {now?:Date;limit?:number}={}):CbdvCompetition[] {
  if(typeof html!=="string" || html.length>950_000 || !Number.isFinite(now.getTime()))return [];
  const headings=[...html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m=>({
    at:m.index!, end:m.index!+m[0].length, level:Number(m[1]),
    title:normalize(textFrom(m[2])),
  }));
  const from=new Date(now.getTime()-90*86400000);
  const to=new Date(now.getTime()+550*86400000);
  const results:CbdvCompetition[]=[];
  const unique=new Set<string>();
  for(let k=0;k<headings.length;k++){
    const h=headings[k];
    const match=/^calendario\s+(20\d{2})$/.exec(h.title);
    if(!match)continue;
    const preceding=headings.slice(0,k).reverse().find(x=>x.level===2);
    if(preceding?.title!=="torneios")continue;
    const year=Number(match[1]);
    if(year<now.getUTCFullYear()-1||year>now.getUTCFullYear()+2)continue;
    const next=headings[k+1]?.at??html.length;
    const start=html.slice(h.end,next).search(/<table\b/i);
    if(start<0)continue;
    const source=html.slice(h.end+start,next);
    const end=source.search(/<\/table>/i);
    if(end<0)continue;
    const table=source.slice(0,end+8);
    for(const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
      const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>textFrom(m[1]));
      if(cells.length<5)continue;
      const [startRaw,endRaw,titleRaw,locationRaw,modalityRaw]=cells;
      const title=titleRaw.slice(0,180),location=locationRaw.slice(0,130);
      if(!/goalball/i.test(normalize(modalityRaw)) || !/goalball/i.test(normalize(title)))continue;
      if(/arbitrag|treinamento|camp\b|seminario|reuniao|forum/i.test(normalize(title)))continue;
      if(!title||!location||!/^[\p{L}\p{N} .,/()'’–—-]+$/u.test(title))continue;
      const starts=monthDay(startRaw,year),ends=monthDay(endRaw,year);
      if(!starts||!ends)continue;
      if(ends.getTime()<starts.getTime())ends.setUTCFullYear(year+1);
      if(ends<from||starts>to)continue;
      const key=normalize(title)+"|"+dateIso(starts);
      if(unique.has(key))continue;
      unique.add(key);
      results.push({
        key:dateIso(starts)+"-"+key.replace(/[^a-z0-9]+/g,"-").slice(0,90),
        title,startsAt:dateIso(starts),endsAt:dateIso(ends),
        location,modality:"Goalball",sourceUrl:CBDV_CALENDAR_URL,
        participation:"nao_confirmada",
      });
    }
  }
  return results.sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.title.localeCompare(b.title))
    .slice(0,Math.max(0,Math.min(30,limit)));
}

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
