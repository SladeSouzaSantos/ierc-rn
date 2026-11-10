import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { CmsRadarList } from "@/components/cms-public";
import { getCmsRadarNews } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Radar da Inclusão",
  description: "Sínteses informativas sobre acessibilidade, deficiência visual e esporte adaptado, com fontes identificadas e aprovação editorial.",
};

export default async function RadarDaInclusaoPage() {
  const articles = await getCmsRadarNews();
  return <>
    <PageHero
      eyebrow="Acessibilidade · conhecimento · participação"
      title="Radar da Inclusão"
      description="Notícias e experiências de outras organizações, apresentadas em português com identificação da fonte original."
    />
    <div className="container interior-body">
      <div className="detail-intro radar-intro">
        <p className="eyebrow">Uma janela para outras iniciativas</p>
        <h2>Informação confiável, com contexto e autoria.</h2>
        <p>O Radar reúne sínteses originais de publicações externas sobre deficiência visual, acessibilidade, educação inclusiva e esporte adaptado. O conteúdo é publicado somente depois de revisão humana e aprovação editorial.</p>
        <p>As experiências aqui apresentadas pertencem às organizações citadas. Não representam atividades realizadas pelo IERC-RN, parcerias ou comunicados institucionais.</p>
      </div>
      <CmsRadarList items={articles}/>
      <aside className="radar-about" aria-labelledby="radar-about-title">
        <h2 id="radar-about-title">Como selecionamos e publicamos</h2>
        <p>Consultamos fontes identificadas, preparamos sínteses originais e submetemos cada texto à conferência editorial. O uso de IA pode auxiliar a redação inicial, mas não substitui a verificação da publicação original ou a aprovação humana.</p>
        <p>Imagens de terceiros não são reutilizadas sem autorização. Cada síntese aprovada oferece um link para a publicação original.</p>
        <Link href="/noticias" className="inline-link">Ver notícias institucionais e registros sobre o IERC-RN <ArrowUpRight size={18} aria-hidden="true"/></Link>
      </aside>
    </div>
  </>;
}
