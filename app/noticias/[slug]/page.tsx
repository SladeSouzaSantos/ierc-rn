import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getCmsNewsBySlug } from "@/lib/cms";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getCmsNewsBySlug(slug);
  return { title: item?.title ?? "Notícia não encontrada", description: item?.summary ?? undefined, robots: { index: false, follow: false } };
}

export default async function NewsDetail({ params }: Props) {
  const { slug } = await params;
  const entry = await getCmsNewsBySlug(slug);
  if (!entry) notFound();
  if(entry.slug!==slug)permanentRedirect("/noticias/"+entry.slug);
  return <article className="container interior-body cms-detail">
    <nav aria-label={entry.originType === "externa" && entry.scope !== "local" ?
      "Voltar ao Radar da Inclusão" : "Voltar à lista de notícias"}>
      <Link className="inline-link" href={entry.originType === "externa" && entry.scope !== "local" ?
        "/radar-da-inclusao" : "/noticias"}>
        <ArrowLeft size={18} aria-hidden="true"/> {entry.originType === "externa" && entry.scope !== "local" ?
          "Voltar ao Radar da Inclusão" : "Voltar às notícias"}
      </Link>
    </nav>
    <header className="detail-intro">
      <p className="eyebrow">{entry.originType === "externa" ? (entry.scope === "local" ?
        "IERC-RN na imprensa · Fonte externa" : "Radar da Inclusão · Fonte externa")
        : (entry.category || "Notícias do IERC-RN")}</p>
      {entry.originType === "externa" && <p>Resumo original em português baseado em fonte externa{entry.country ? " · " + entry.country : ""}. Não representa comunicado ou parceria do IERC-RN.</p>}
      {entry.originType === "externa" && entry.aiAssisted && <p className="radar-ai-note">
        {entry.autoReviewed
          ? ( entry.autoReviewBasis === "full_article"
          ? "Síntese gerada e revisada automaticamente por IA · fundamentada em texto integral autorizado"
          : "Síntese gerada e revisada automaticamente por IA · baseada em resumo RSS" )
          : "Síntese assistida por IA · revisão editorial humana"}
      </p>}
      <h1>{entry.title}</h1>
      <p>{entry.summary}</p>
      {entry.date && !Number.isNaN(Date.parse(entry.date)) && <time dateTime={entry.date}>
        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" }).format(new Date(entry.date))}
      </time>}
    </header>
    {entry.body && <div className="cms-article-body">{entry.body}</div>}
    {entry.originType === "externa" && entry.whyItMatters && <section className="cms-article-impact" aria-labelledby="cms-impact-title">
      <h2 id="cms-impact-title">Por que isso importa para a inclusão no Brasil?</h2>
      <p>{entry.whyItMatters}</p>
    </section>}
    {entry.sourceUrl && <p className="cms-source">
      <a className="editorial-source" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
        {entry.sourceName || "Fonte documental"} <ArrowUpRight size={16} aria-hidden="true"/>
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </p>}
  </article>;
}
