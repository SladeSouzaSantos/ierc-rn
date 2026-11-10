import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { athleteProfiles } from "@/lib/athlete-stories";
import type { CmsArticle, CmsEvent, CmsAthlete } from "@/lib/cms";

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" }).format(new Date(value));
}

export function CmsNewsList({ items }: { items: CmsArticle[] }) {
  if (!items.length) return null;
  const official = items.filter(item => item.originType !== "externa");
  const international = items.filter(item => item.originType === "externa");
  const list = (rows: CmsArticle[]) => <div className="editorial-panels editorial-panels-three">
    {rows.map(item => <article className="detail-card editorial-news" key={item.slug}>
      <span>{item.category || "Notícia"}{dateLabel(item.date) ? " · " : ""}{dateLabel(item.date) &&
        <time dateTime={item.date}>{dateLabel(item.date)}</time>}</span>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      {item.originType === "externa" && <p className="editorial-place">
        Fonte externa{item.sourceName ? ": " + item.sourceName : ""}{item.country ? " · " + item.country : ""}
      </p>}
      <Link className="editorial-source" href={"/noticias/" + item.slug}>
        Ler {item.originType === "externa" ? "síntese" : "notícia"} <ArrowUpRight size={16} aria-hidden="true"/>
      </Link>
    </article>)}
  </div>;
  return <>
    {official.length > 0 && <section className="editorial-section" aria-labelledby="cms-news-title">
      <p className="eyebrow">Publicações do Instituto</p>
      <h2 className="interior-subtitle" id="cms-news-title">Notícias da equipe do IERC-RN</h2>
      <p className="editorial-intro">Conteúdos cadastrados e aprovados no painel editorial.</p>
      {list(official)}
    </section>}
    {international.length > 0 && <section className="editorial-section" aria-labelledby="cms-world-title">
      <p className="eyebrow">Panorama internacional</p>
      <h2 className="interior-subtitle" id="cms-world-title">Radar da Inclusão — Brasil e Mundo</h2>
      <p className="editorial-intro">Sínteses em português de fontes externas, revisadas pela equipe do IERC-RN. Não representam parcerias ou ações do Instituto.</p>
      {list(international)}
    </section>}
  </>;
}

export function CmsEventsList({ items }: { items: CmsEvent[] }) {
  if (!items.length) return null;
  return <section className="editorial-section" aria-labelledby="cms-events-title">
    <p className="eyebrow">Agenda aprovada</p>
    <h2 className="interior-subtitle" id="cms-events-title">Programação do Instituto</h2>
    <div className="editorial-panels">
      {items.map(item => <article className="detail-card editorial-event" key={item.slug}>
        <span><CalendarDays size={17} aria-hidden="true"/> <time dateTime={item.startsAt}>{dateLabel(item.startsAt)}</time></span>
        <h3>{item.title}</h3><p>{item.summary}</p>
        {item.location && <p className="editorial-place">Local: {item.location}</p>}
        {item.registrationUrl && <a className="editorial-source" href={item.registrationUrl} target="_blank" rel="noopener noreferrer">
          Inscrição ou informações oficiais <ArrowUpRight size={16} aria-hidden="true"/>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>}
      </article>)}
    </div>
  </section>;
}

export function CmsAthletesList({ items }: { items: CmsAthlete[] }) {
  const newProfiles = items.filter(item => !athleteProfiles.some(profile => profile.id === item.slug));
  if (!newProfiles.length) return null;
  return <section className="editorial-section" aria-labelledby="cms-athletes-title">
    <p className="eyebrow">Acervo institucional em expansão</p>
    <h2 className="interior-subtitle" id="cms-athletes-title">Outras trajetórias aprovadas</h2>
    <div className="editorial-panels">
      {newProfiles.map(item => <article className="detail-card" key={item.slug}>
        <span>{item.discipline || "Esporte e inclusão"}</span>
        <h3>{item.name}</h3><p>{item.summary}</p><p><strong>Ligação com o IERC-RN:</strong> {item.connectionToIerc}</p>
        {item.sourceUrl && <a className="editorial-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
          {item.sourceName || "Consultar fonte"} <ArrowUpRight size={16} aria-hidden="true"/>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>}
      </article>)}
    </div>
  </section>;
}
