import type { CmsEvent } from "./cms";
import type { CbdvCompetition } from "./cbdv-calendar-parser";

const normalized = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const identity = (title: string, start: string) =>
  normalized(title) + "-" + start.slice(0, 10);

/** Pure presentation deduplication; never changes approval or participation status. */
export function organizeSportCompetitions(cbdv: CbdvCompetition[], events: CmsEvent[]) {
  const institutional = events.filter(event =>
    event.eventType === "competicao_esportiva" &&
    !!event.title && !!event.summary && !Number.isNaN(Date.parse(event.startsAt))
  ).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const seen = new Set(institutional.map(event => identity(event.title,event.startsAt)));
  const external = cbdv.filter(item =>
    !seen.has(identity(item.title,item.startsAt))
  ).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  return {institutional,external};
}
