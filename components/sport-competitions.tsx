import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { CmsEvent } from "@/lib/cms";
import type { CbdvCompetition } from "@/lib/cbdv-calendar";
import { CBDV_CALENDAR_URL } from "@/lib/cbdv-calendar";

const normalized = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const identity = (title: string, start: string) =>
  normalized(title) + "-" + start.slice(0, 10);

export function organizeSportCompetitions(cbdv: CbdvCompetition[], events: CmsEvent[]) {
  const institutional = events.filter(event =>
    event.eventType === "competicao_esportiva" &&
    !!event.title && !!event.summary && !Number.isNaN(Date.parse(event.startsAt))
  ).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  // A manually approved institutional record takes precedence when a CBDV
  // event is also listed. Neither source is silently converted to a roster.
  const seen = new Set(institutional.map(event => identity(event.title,event.startsAt)));
  const external = cbdv.filter(item =>
    !seen.has(identity(item.title,item.startsAt))
  ).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  return {institutional,external};
}
const dateLabel = (iso: string) => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso+"T12:00:00Z":iso);
  return new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Fortaleza",
    dateStyle:"medium"}).format(date);
};
const dateRange = (start:string,end?:string) => {
  if(!end || start.slice(0,10)===end.slice(0,10))return dateLabel(start);
  return dateLabel(start)+" a "+dateLabel(end);
};

export function SportCompetitions({cbdv,events}:{
  cbdv:CbdvCompetition[];
  events:CmsEvent[];
}) {
  const {institutional,external}=organizeSportCompetitions(cbdv,events);
  return <section className="editorial-section" aria-labelledby="sport-competitions-title">
    <p className="eyebrow">Programação em atualização</p>
    <h2 id="sport-competitions-title" className="interior-subtitle">Competições e calendário esportivo</h2>
    <p className="editorial-intro">As competições divulgadas pela CBDV são consultadas
      automaticamente no calendário oficial. <strong>Estar no calendário da CBDV
      não significa que o IERC-RN participará.</strong> Competições adicionais
      informadas pela instituição são incluídas somente após aprovação editorial.</p>

    <section aria-labelledby="local-sport-competitions">
      <h3 id="local-sport-competitions">Competições informadas pelo IERC-RN</h3>
      {institutional.length
        ? <div className="editorial-panels">
          {institutional.map(item => <article key={item.slug} className="detail-card editorial-event">
            <span>Cadastro institucional · {item.sportModality || "Esporte"}</span>
            <h4>{item.title}</h4>
            <p><CalendarDays size={17} aria-hidden="true"/> <time dateTime={item.startsAt}>
              {dateRange(item.startsAt,item.endsAt)}
            </time></p>
            {item.location && <p><MapPin size={17} aria-hidden="true"/> {item.location}</p>}
            <p>{item.summary}</p>
            <p><strong>Participação do IERC-RN:</strong> {
              item.participationStatus === "confirmada" ? "confirmada pela equipe editorial" :
                "não confirmada"
            }</p>
            {item.sourceUrl && <a className="editorial-source"
              href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              Consultar referência <ArrowUpRight size={16} aria-hidden="true"/>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>}
          </article>)}
        </div>
        : <p className="editorial-intro">Ainda não há competições externas ao calendário da
            CBDV cadastradas, publicadas e aprovadas pela instituição.</p>}
    </section>

    <section aria-labelledby="cbdv-sport-competitions">
      <h3 id="cbdv-sport-competitions">Calendário oficial da CBDV · Goalball</h3>
      {external.length
        ? <div className="editorial-panels">
          {external.map(item => <article key={item.key} className="detail-card editorial-event">
            <span>Fonte: CBDV · {item.modality}</span>
            <h4>{item.title}</h4>
            <p><CalendarDays size={17} aria-hidden="true"/> <time dateTime={item.startsAt}>
              {dateRange(item.startsAt,item.endsAt)}
            </time></p>
            <p><MapPin size={17} aria-hidden="true"/> {item.location}</p>
            <p><strong>Participação do IERC-RN:</strong> não confirmada.</p>
            <a className="editorial-source" href={item.sourceUrl}
              target="_blank" rel="noopener noreferrer">
              Consultar calendário oficial da CBDV <ArrowUpRight size={16} aria-hidden="true"/>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </article>)}
        </div>
        : <p className="editorial-intro">Nenhuma competição de goalball foi identificada
            na janela consultada. Isso não comprova ausência de competições;
            confira a agenda oficial.</p>}
      <p><a className="inline-link" href={CBDV_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
        Abrir calendário da CBDV <ArrowUpRight size={16} aria-hidden="true"/>
        <span className="sr-only"> (abre em nova aba)</span>
      </a></p>
    </section>
  </section>;
}
