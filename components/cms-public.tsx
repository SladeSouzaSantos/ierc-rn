import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { athleteProfiles } from "@/lib/athlete-stories";
import type { CmsArticle, CmsEvent, CmsAthlete } from "@/lib/cms";
import { sortNewsNewestFirst } from "@/lib/news-order";
import { groupInstitutionalEvents, institutionalEventNews } from "@/lib/institutional-events";

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" }).format(new Date(value));
}

/** News published by the Institute is deliberately separate from external editorial synthesis. */
function CmsNewsCard({ item, external = false, grouped = false }:
  { item: CmsArticle; external?: boolean; grouped?: boolean }) {
  const date = dateLabel(item.date);
  return <article className="detail-card editorial-news" key={item.slug}>
    <span>{item.category || (external ? "Inclusão" : "Notícia")}
      {date && item.date && <> · <time dateTime={item.date}>{date}</time></>}
    </span>
    {grouped ? <h4>{item.title}</h4> : <h3>{item.title}</h3>}
    <p>{item.summary}</p>
    {external && <p className="editorial-place">
      <strong>Fonte externa:</strong> {item.sourceName}{item.country ? " · " + item.country : ""}
    </p>}
    {external && item.aiAssisted && <p className="radar-ai-note">
      {item.autoReviewed
        ? ( item.autoReviewBasis === "full_article"
          ? "Síntese gerada e revisada automaticamente por IA · fundamentada em texto integral autorizado"
          : "Síntese gerada e revisada automaticamente por IA · baseada em resumo RSS" )
        : "Síntese assistida por IA · revisão editorial humana"}
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
  const official = sortNewsNewestFirst(
    items.filter(item => item.originType !== "externa"), item => item.date,
  );
  return <section className="editorial-section" aria-labelledby="cms-news-title">
    <p className="eyebrow">Direto do IERC-RN · Publicações oficiais</p>
    <h2 className="interior-subtitle" id="cms-news-title">Notícias da equipe do IERC-RN</h2>
    <p className="editorial-intro">Comunicados, projetos e atividades divulgados pela instituição após aprovação editorial.</p>
    {official.length > 0
      ? <div className="editorial-panels editorial-panels-three">
        {official.map(item => <CmsNewsCard key={item.slug} item={item}/>)}
      </div>
      : <div className="detail-card solo-card">
        <h3>Publicações institucionais em preparação</h3>
        <p>Ainda não há notícias oficiais publicadas e aprovadas nesta seção. Quando a equipe do IERC-RN divulgar atividades, oficinas e comunicados, eles aparecerão aqui.</p>
      </div>}
  </section>;
}

export function CmsIercPressList({ items }: { items: CmsArticle[] }) {
  const mentions=sortNewsNewestFirst(
    items.filter(item => item.originType === "externa" &&
      item.scope === "local" && !!item.sourceName &&
      !!item.sourceUrl?.startsWith("https://")), item => item.date,
  );
  if(!mentions.length)return null;
  return <section className="editorial-section" aria-labelledby="ierc-press-heading">
    <p className="eyebrow">IERC-RN na imprensa</p>
    <h2 id="ierc-press-heading" className="interior-subtitle">Reportagens externas sobre o Instituto</h2>
    <p className="editorial-intro">Sínteses de notícias publicadas por outros veículos que mencionam explicitamente o IERC-RN. Os fatos e a autoria são atribuídos à fonte; estas notícias não representam comunicados institucionais.</p>
    <div className="editorial-panels editorial-panels-three">
      {mentions.map(item=><CmsNewsCard key={item.slug} item={item} external/>)}
    </div>
  </section>;
}

/** Only published, editorially approved stories with an attributable external source. */
export function CmsRadarList({ items }: { items: CmsArticle[] }) {
  const external = items.filter(item => item.originType === "externa" &&
    item.scope !== "local" &&
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
  const national=sortNewsNewestFirst(
    external.filter(item=>item.scope==="brasil"), item=>item.date);
  const international=sortNewsNewestFirst(
    external.filter(item=>item.scope!=="brasil"), item=>item.date);
  return <section className="editorial-section" aria-labelledby="radar-list-heading">
    <p className="eyebrow">Conteúdos verificados · Brasil e mundo</p>
    <h2 id="radar-list-heading" className="interior-subtitle">Sínteses de fontes externas</h2>
    <p className="editorial-intro">Cada síntese identifica a publicação de origem e oferece acesso ao texto original. Não representa uma ação, parceria ou comunicado do IERC-RN.</p>
    {[
      {id:"radar-brasil-heading",title:"Iniciativas e direitos no Brasil",items:national},
      {id:"radar-mundo-heading",title:"Experiências internacionais",items:international},
    ].filter(group=>group.items.length>0).map(group=>
      <section className="radar-group" aria-labelledby={group.id} key={group.id}>
        <h3 id={group.id}>{group.title}</h3>
        <div className="editorial-panels editorial-panels-three">
          {group.items.map(item=><CmsNewsCard key={item.slug} item={item} external grouped/>)}
        </div>
      </section>
    )}
  </section>;
}

/** CMS events are an agenda, not a historical sports clipping collection. */
function eventDateTimeLabel(value: string) {
  if (Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

function CmsEventCard({ item }: { item: CmsEvent }) {
  return <article className={`detail-card editorial-event editorial-event-card${item.image ? " editorial-event-card--with-image" : ""}`} key={item.slug}>
    {item.image && <figure className="editorial-event-media">
      <Image
        src={`/api/event-image/${encodeURIComponent(item.slug)}`}
        width={800} height={500} unoptimized loading="lazy"
        sizes="(max-width: 540px) 100vw, (max-width: 760px) 34vw, (max-width: 1200px) 18vw, 220px"
        alt={item.image.alt}
      />
      {item.image.credit && <figcaption>Imagem: {item.image.credit}</figcaption>}
    </figure>}
    <div className="editorial-event-content">
      <span className="editorial-event-date"><CalendarDays size={17} aria-hidden="true"/>
        <time dateTime={item.startsAt}>{eventDateTimeLabel(item.startsAt)}</time>
      </span>
      <h4>{item.title}</h4>
      <p>{item.summary}</p>
      {item.endsAt && <p>Encerramento: <time dateTime={item.endsAt}>{eventDateTimeLabel(item.endsAt)}</time></p>}
      {item.location && <p className="editorial-place">Local: {item.location}</p>}
      {item.registrationUrl && <a className="editorial-source" href={item.registrationUrl} target="_blank" rel="noopener noreferrer">
        Inscrição ou informações oficiais <ArrowUpRight size={16} aria-hidden="true"/>
        <span className="sr-only"> (abre em nova aba)</span>
      </a>}
    </div>
  </article>;
}

export function CmsEventsList({ items }: { items: CmsEvent[] }) {
  const { upcoming, ongoing, completed } = groupInstitutionalEvents(items);
  return <section className="editorial-section cms-events-list" aria-labelledby="cms-events-title">
    <p className="eyebrow">Agenda aprovada · IERC-RN</p>
    <h2 className="interior-subtitle" id="cms-events-title">Programação da instituição</h2>
    {ongoing.length > 0 && <section className="event-group" aria-labelledby="ongoing-events-title">
      <h3 id="ongoing-events-title">Em andamento</h3>
      <div className="editorial-panels">{ongoing.map(item => <CmsEventCard key={item.slug} item={item}/>)}</div>
    </section>}
    <section className="event-group" aria-labelledby="upcoming-events-title">
      <h3 id="upcoming-events-title">Próximos eventos</h3>
      {upcoming.length > 0
        ? <div className="editorial-panels">{upcoming.map(item => <CmsEventCard key={item.slug} item={item}/>)}</div>
        : <p className="editorial-intro">Ainda não há eventos futuros confirmados e aprovados na agenda do portal. Consulte os canais oficiais do Instituto antes de planejar uma visita.</p>}
    </section>
    {completed.length > 0 && <section className="event-group" aria-labelledby="completed-events-title">
      <h3 id="completed-events-title">Eventos realizados pelo Instituto</h3>
      <p className="editorial-intro">Registros institucionais aprovados, preservados como memória. Não representam inscrições abertas ou eventos futuros.</p>
      <div className="editorial-panels">{completed.map(item => <CmsEventCard key={item.slug} item={item}/>)}</div>
    </section>}
  </section>;
}

/** Links to canonical internal news records: no duplicated event articles. */
export function CmsInstitutionalEventNews({ items }: { items: CmsArticle[] }) {
  const news = institutionalEventNews(items);
  return <section className="editorial-section" aria-labelledby="institutional-event-news-title">
    <p className="eyebrow">Aconteceu no IERC-RN</p>
    <h2 className="interior-subtitle" id="institutional-event-news-title">Notícias de eventos e atividades internas</h2>
    <p className="editorial-intro">Oficinas, apresentações, visitas, comemorações e outras atividades realizadas pelo Instituto, com notícias institucionais aprovadas pela equipe.</p>
    {news.length > 0
      ? <div className="editorial-panels editorial-panels-three">
        {news.map(item => <article className="detail-card editorial-news" key={item.slug}>
          <span>{item.date && !Number.isNaN(Date.parse(item.date))
            ? <time dateTime={item.date}>{dateLabel(item.date)}</time>
            : "Notícia institucional"}</span>
          <h3>{item.title}</h3><p>{item.summary}</p>
          <Link className="editorial-source" href={"/noticias/" + item.slug}>
            Ler notícia institucional <ArrowUpRight size={16} aria-hidden="true"/>
          </Link>
        </article>)}
      </div>
      : <p className="editorial-intro">As notícias sobre eventos internos aparecerão aqui quando forem publicadas e aprovadas pela instituição.</p>}
    <Link className="inline-link" href="/noticias">Ver todas as notícias do IERC-RN <ArrowUpRight size={16} aria-hidden="true"/></Link>
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
