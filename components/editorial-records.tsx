import { ArrowUpRight, MapPin } from "lucide-react";
import { sources, timeline, clippings, pastEvents, serieAFeminina2026, verifiedAddress, type SourceId } from "@/lib/editorial-data";
import { sortNewsNewestFirst } from "@/lib/news-order";

/** Registros editoriais renderizados no servidor; sem integração externa em tempo de execução. */
export function SourceLink({ source, label }: { source: SourceId; label?: string }) {
  const info = sources[source];
  return <a className="editorial-source" href={info.url} target="_blank" rel="noopener noreferrer">
    {label ?? `Fonte: ${info.publisher}`} <ArrowUpRight size={16} aria-hidden="true" />
    <span className="sr-only"> (abre em nova aba)</span>
  </a>;
}

/** Display historical decade ranges as three intentional lines, not accidental wrapping. */
function TimelineYear({ year, date }: { year: string; date: string }) {
  const range = /^(\d{4})–(\d{2})$/.exec(year);
  if (!range) return <time className="timeline-year" dateTime={date}>{year}</time>;

  const start = range[1];
  const end = start.slice(0, 2) + range[2];
  return (
    <time className="timeline-year timeline-year-range" dateTime={date} aria-label={`${start} a ${end}`}>
      <span aria-hidden="true">{start}</span>
      <span aria-hidden="true" className="timeline-year-separator">a</span>
      <span aria-hidden="true">{end}</span>
    </time>
  );
}

export function Timeline() {
  return <section className="editorial-section" aria-labelledby="timeline-title">
    <p className="eyebrow">Marcos documentados</p>
    <h2 className="interior-subtitle" id="timeline-title">Uma trajetória que atravessa décadas</h2>
    <ol className="editorial-timeline">
      {timeline.map((item, index) => <li key={item.date + index} className="timeline-item">
        <TimelineYear year={item.year} date={item.date} />
        <div><h3>{item.title}</h3><p>{item.text}</p><SourceLink source={item.source}/></div>
      </li>)}
    </ol>
  </section>;
}

export function SportRecords() {
  return <section className="editorial-section" aria-labelledby="sport-records-title">
    <p className="eyebrow">Memória esportiva · temporada 2026</p>
    <h2 id="sport-records-title" className="interior-subtitle">Equipes registradas pela CBDV</h2>
    <p className="editorial-intro">Esses registros referem-se às competições de 2026 e não representam escalação atual, vínculo permanente ou biografia de qualquer atleta.</p>
    <div className="editorial-panels">
      <article className="detail-card sport-roster">
        <span>Série A brasileira · 2026</span>
        <h3>Equipe feminina do IERC-RN</h3>
        <p><strong>Técnica citada em 2026:</strong> {serieAFeminina2026.coach}</p>
        <h4>Atletas relacionadas pela CBDV</h4>
        <ul>{serieAFeminina2026.athletes.map((athlete) => <li key={athlete}>{athlete}</li>)}</ul>
        <SourceLink source="serieA" label="Consultar lista oficial da Série A"/>
      </article>
      <article className="detail-card sport-roster">
        <span>Regional Nordeste · abril de 2026</span>
        <h3>Equipes masculina e feminina</h3>
        <p>A CBDV incluiu o IERC-RN em ambas as categorias do Regional Nordeste de Goalball, disputado em Campina Grande (PB).</p>
        <p>A publicação oficial apresenta a composição dos elencos daquela competição.</p>
        <SourceLink source="regional" label="Consultar equipes do Regional"/>
      </article>
    </div>
  </section>;
}

export function ExternalClippings() {
  return <section className="editorial-section" aria-labelledby="clippings-title">
    <p className="eyebrow">Na mídia · fontes externas</p>
    <h2 id="clippings-title" className="interior-subtitle">Registros publicados sobre o IERC-RN</h2>
    <p className="editorial-intro">São resumos de publicações verificáveis de terceiros, não notícias criadas pelo Instituto nem comunicados sobre eventos futuros.</p>
    <div className="editorial-panels editorial-panels-three">
      {sortNewsNewestFirst(clippings, item => item.dateTime).map(item => <article className="detail-card editorial-news" key={item.dateTime + item.source}>
        <span>{item.category} · <time dateTime={item.dateTime}>{item.date}</time></span>
        <h3>{item.title}</h3><p>{item.summary}</p>
        <SourceLink source={item.source} label="Ler publicação original"/>
      </article>)}
    </div>
  </section>;
}

export function PastEvents() {
  return <section className="editorial-section" aria-labelledby="past-events-title">
    <p className="eyebrow">Arquivo esportivo</p>
    <h2 id="past-events-title" className="interior-subtitle">Competições de 2026</h2>
    <p className="editorial-intro">Registros de eventos passados documentados pela CBDV; esta lista não representa a agenda de competições futuras.</p>
    <div className="editorial-panels">
      {pastEvents.map(item => <article className="detail-card editorial-event" key={item.title}>
        <span><time dateTime={item.dateTime}>{item.date}</time></span>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <p className="editorial-place"><MapPin size={17} aria-hidden="true" />{item.location}</p>
        <SourceLink source={item.source} label="Ver registro na CBDV"/>
      </article>)}
    </div>
  </section>;
}

export function VerifiedAddress() {
  return <address className="verified-address">{verifiedAddress}</address>;
}
