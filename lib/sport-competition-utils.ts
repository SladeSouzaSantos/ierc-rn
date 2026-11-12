import type { CmsSportCompetition } from "./cms";
import type { CbdvCompetition } from "./cbdv-calendar-parser";

const normalized = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const identity = (title: string, start: string) =>
  normalized(title) + "-" + start.slice(0, 10);

/** Pure presentation deduplication; never changes approval or participation status. */
export function organizeSportCompetitions(cbdv: CbdvCompetition[], competitions: CmsSportCompetition[]) {
  const institutional = competitions.filter(item =>
    !!item.title && !!item.summary && !!item.sportModality &&
    !Number.isNaN(Date.parse(item.startsAt))
  ).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const seen = new Set(institutional.map(event => identity(event.title,event.startsAt)));
  const external = cbdv.filter(item =>
    !seen.has(identity(item.title,item.startsAt))
  ).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  return {institutional,external};
}
