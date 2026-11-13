import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { CmsSportCompetition } from "@/lib/cms";
import type { CbdvCompetition } from "@/lib/cbdv-calendar";
import { CBDV_CALENDAR_URL } from "@/lib/cbdv-calendar";
import {organizeSportCompetitions} from "@/lib/sport-competition-utils";

const dateLabel = (iso: string) => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso+"T12:00:00Z":iso);
  return new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Fortaleza",
    dateStyle:"medium"}).format(date);
};
const dateRange = (start:string,end?:string) => {
  if(!end || start.slice(0,10)===end.slice(0,10))return dateLabel(start);
  return dateLabel(start)+" a "+dateLabel(end);
};

export function SportCompetitions({cbdv,competitions}:{
  cbdv:CbdvCompetition[];
  competitions:CmsSportCompetition[];
}) {
  const {institutional,external}=organizeSportCompetitions(cbdv,competitions);
  return <section className="editorial-section" aria-labelledby="sport-competitions-title">
    <p className="eyebrow">Programação em atualização</p>
    <h2 id="sport-competitions-title" className="interior-subtitle">Competições e calendário esportivo</h2>
    <p className="editorial-intro">As competições divulgadas pela CBDV são consultadas
      automaticamente no calendário oficial. <strong>O calendário informa
      os torneios, mas não comprova, isoladamente, quais tiveram participação
      do IERC-RN.</strong> As participações documentadas permanecem no acervo
      histórico; competições adicionais informadas pela instituição entram
      após aprovação editorial.</p>

    <section aria-labelledby="local-sport-competitions">
      <h3 id="local-sport-competitions">Competições informadas pelo IERC-RN</h3>
      {institutional.length
        ? <div className="editorial-panels">
          {institutional.map(item => <article key={item.slug} className="detail-card editorial-event">
            <span>Cadastro institucional · {item.sportModality}</span>
            <h4>{item.title}</h4>
            {item.calendarLabel && <p>Calendário: {item.calendarLabel}</p>}
            {item.organizer && <p>Organização: {item.organizer}</p>}
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

    <section className="sport-cbdv-calendar" aria-labelledby="cbdv-sport-competitions">
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
      <p className="sport-cbdv-calendar-action"><a className="inline-link" href={CBDV_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
        Abrir calendário da CBDV <ArrowUpRight size={16} aria-hidden="true"/>
        <span className="sr-only"> (abre em nova aba)</span>
      </a></p>
    </section>
  </section>;
}
