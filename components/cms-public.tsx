import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { athleteProfiles } from "@/lib/athlete-stories";
import type { CmsArticle, CmsEvent, CmsAthlete } from "@/lib/cms";

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" }).format(new Date(value));
}

/** News published by the Institute is deliberately separate from external editorial synthesis. */
function CmsNewsCard({ item, external = false }: { item: CmsArticle; external?: boolean }) {
  const date = dateLabel(item.date);
  return <article className="detail-card editorial-news" key={item.slug}>
    <span>{item.category || (external ? "Inclusão" : "Notícia")}
      {date && item.date && <> · <time dateTime={item.date}>{date}</time></>}
    </span>
    <h3>{item.title}</h3>
    <p>{item.summary}</p>
    {external && <p className="editorial-place">
      <strong>Fonte externa:</strong> {item.sourceName}{item.country ? " · " + item.country : ""}
    </p>}
    <Link className="editorial-source" href={"/noticias/" + item.slug}>
      {external ? "Ler síntese em português" : "Ler notícia"} <ArrowUpRight size={16} aria-hidden="true"/>
    </Link>
    {external && item.sourceUrl && <a className="editorial-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
      Ler publicação original <ArrowUpRight size={16} aria-hidden="true"/>
      <span className="sr-only"> (abre em nova aba)</span>
    </a>}
  </article>;
}

export function CmsNewsList({ items }: { items: CmsArticle[] }) {
  const official = items.filter(item => item.originType !== "externa");
  if (!official.length) return null;
  return <section className="editorial-section" aria-labelledby="cms-news-title">
    <p className="eyebrow">Publicações do Instituto</p>
    <h2 className="interior-subtitle" id="cms-news-title">Notícias da equipe do IERC-RN</h2>
    <p className="editorial-intro">Comunicados e notícias institucionais publicados após aprovação editorial.</p>
    <div className="editorial-panels editorial-panels-three">
      {official.map(item => <CmsNewsCard key={item.slug} item={item}/>)}
    </div>
  </section>;
}

/** Only published, editorially approved stories with an attributable external source. */
export function CmsRadarList({ items }: { items: CmsArticle[] }) {
  const external = items.filter(item => item.originType === "externa" &&
    !!item.sourceName && !!item.sourceUrl && item.sourceUrl.startsWith("https://"));
  if (!external.length) {
    return <section className="radar-empty" aria-labelledby="radar-empty-heading">
      <h2 id="radar-empty-heading">Conteúdos em revisão editorial</h2>
      <p>O Radar ainda não possui sínteses externas aprovadas para publicação. Novos conteúdos serão exibidos somente após verificação das fontes e aprovação humana.</p>
      <Link className="inline-link" href="/noticias">
        Consultar notícias do IERC-RN <ArrowUpRight size={18} aria-hidden="true"/>
      </Link>
    </section>;
  }
  return <section className="editorial-section" aria-labelledby="radar-list-heading">
    <p className="eyebrow">Conteúdos verificados · Brasil e mundo</p>
    <h2 id="radar-list-heading" className="interior-subtitle">Sínteses de fontes externas</h2>
    <p className="editorial-intro">Cada síntese identifica a publicação de origem e oferece acesso ao texto original. Não representa uma ação, parceria ou comunicado do IERC-RN.</p>
    <div className="editorial-panels editorial-panels-three">
      {external.map(item => <CmsNewsCard key={item.slug} item={item} external/>)}
    </div>
  </section>;
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
