import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Instagram } from "lucide-react";
import { getDisplayActivities } from "@/lib/cms";
import { BeyondMotion } from "@/components/beyond-motion";
import { BeyondPhoto, PhotoCredits, availablePhotos } from "@/components/beyond-photo";
import { GoalballScene } from "@/components/goalball-scene";

export const dynamic = "force-dynamic";

export default async function Home() {
  const activities = await getDisplayActivities();
  const photos = availablePhotos();
  return (
    <div className="beyond-home" data-photo-count={photos.length}>
      <BeyondMotion />
      <section className="beyond-cover hero" aria-labelledby="hero-titulo">
        <div className="beyond-wrap">
          <div className="beyond-masthead"><span>Instituto de Educação e Reabilitação de Cegos</span><span>Natal, RN · Desde 1952</span></div>
          <h1 id="hero-titulo" className="beyond-title"><span>Além</span>{" "}<em>do olhar.</em></h1>
          <div className="beyond-collage" aria-label="Composição visual ilustrativa">
            <div className="collage-left" data-beyond-layer="left"><BeyondPhoto id="mobility" available={photos} /></div>
            <div className="collage-center" data-beyond-layer="center"><BeyondPhoto id="braille" available={photos} priority /></div>
            <div className="collage-right" data-beyond-layer="right"><BeyondPhoto id="music" available={photos} /></div>
            <span className="collage-orbit" aria-hidden="true"/>
            <span className="collage-stamp" aria-hidden="true">IERC<br/>RN</span>
          </div>
          <div className="beyond-cover-foot">
            <p className="beyond-thesis">O que transforma vidas é <em>abrir possibilidades.</em></p>
            <p>No IERC-RN, educação, autonomia, cultura e esporte caminham juntos.</p>
            <a href="#atuacao" className="beyond-scroll">Explore nossa história <ArrowDown aria-hidden="true" size={23}/></a>
          </div>
          <p className="beyond-photo-disclaimer">Fotografias ilustrativas externas, não registros do IERC-RN. <a href="#creditos-fotos">Créditos e licenças.</a>{photos.length < 5 && " Acervo experimental ainda incompleto."}</p>
        </div>
      </section>

      <nav className="beyond-index" aria-label="Explore a página inicial">
        <div className="beyond-wrap"><a href="#atuacao">01 — Essência</a><a href="#atividades">02 — Atuação</a><a href="#esporte">03 — Esporte</a><a href="#participar">04 — Participação</a></div>
      </nav>

      <section id="atuacao" className="beyond-act beyond-essence" aria-labelledby="essencia-titulo">
        <div className="beyond-wrap">
          <div className="act-label"><span>01 / Nossa essência</span><span>Educação · Autonomia · Comunidade</span></div>
          <div className="essence-opening">
            <div><h2 id="essencia-titulo">O mundo não se descobre <em>de uma só maneira.</em></h2><p className="beyond-prose">O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte atua na promoção de habilidades, convivência e participação de pessoas com deficiência visual.</p><Link className="beyond-link" href="/instituto">Conheça o Instituto <ArrowUpRight aria-hidden="true"/></Link></div>
            <figure className="essence-photo"><BeyondPhoto id="touch" available={photos}/><figcaption>Leitura pelo tato · imagem ilustrativa</figcaption></figure>
          </div>
          <div className="beyond-history"><div className="heritage-year"><span>Desde</span><strong>1952</strong></div><div><p>Uma história que atravessa gerações.</p><Link className="beyond-link" href="/instituto">Percorra nossa história <ArrowUpRight aria-hidden="true"/></Link></div></div>
          <div className="beyond-principles">
            <article><span>01</span><h3>Educação</h3><p>O conhecimento como ferramenta de autonomia e novas oportunidades.</p></article>
            <article><span>02</span><h3>Autonomia</h3><p>Experiências de aprendizagem conectadas à vida cotidiana.</p></article>
            <article><span>03</span><h3>Comunidade</h3><p>Encontros e iniciativas que aproximam pessoas e fortalecem vínculos.</p></article>
          </div>
        </div>
      </section>

      <section id="atividades" className="beyond-act beyond-activities" aria-labelledby="atividades-titulo">
        <div className="beyond-wrap">
          <div className="act-label"><span>02 / O que fazemos</span><span>Aprender de diferentes formas</span></div>
          <h2 id="atividades-titulo">Muitas formas de <em>descobrir.</em></h2>
          <div className="beyond-activity-layout">
            <figure className="activity-feature"><BeyondPhoto id="music" available={photos}/><figcaption>Música · fotografia ilustrativa</figcaption><div className="activity-feature-copy"><p>Aprender. Criar.<br/>Experimentar.</p><Link className="beyond-link" href="/atividades">Todas as atividades <ArrowUpRight aria-hidden="true"/></Link></div></figure>
            <div className="beyond-activity-list">
              {activities.map((activity,index)=><Link key={activity.id} href={"/atividades#"+activity.id} className="activity-card beyond-activity"><span className="activity-index" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><div><span className="beyond-category">{activity.category}</span><h3>{activity.title}</h3><p>{activity.description}</p></div><ArrowUpRight aria-hidden="true" size={21}/></Link>)}
            </div>
          </div>
        </div>
      </section>

      <section id="esporte" className="beyond-act beyond-sport sport-section" aria-labelledby="goalball-title">
        <div className="beyond-wrap">
          <div className="act-label"><span>03 / Esporte</span><span>O som, o espaço, a equipe</span></div>
          <div className="sport-copy"><h2 id="goalball-title">O som da bola.<br/><em>A força de uma equipe.</em></h2><p>O goalball faz parte da vida esportiva do IERC-RN. A instituição participa de competições, forma atletas e revela talentos que representam o Rio Grande do Norte e o Brasil.</p><Link className="beyond-link" href="/esportes">Conheça o goalball <ArrowUpRight aria-hidden="true"/></Link><a className="sport-source" href="https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande" target="_blank" rel="noopener noreferrer">Fonte: CBDV, 2026 <span className="sr-only">(abre em nova aba)</span></a></div>
          <figure className="beyond-sport-photo"><BeyondPhoto id="goalball" available={photos}/><figcaption>Goalball feminino · Jogos Paralímpicos Rio 2016 · fotografia ilustrativa</figcaption></figure>
          <div className="beyond-sport-detail"><GoalballScene/><div><p className="act-small">Trajetórias</p><h3>Cada conquista começa com a chance de descobrir seu próprio caminho.</h3><p>Conheça trajetórias de atletas cuja passagem pelo IERC-RN está registrada em fontes públicas.</p><Link className="beyond-link" href="/historias">Conheça as trajetórias <ArrowUpRight aria-hidden="true"/></Link></div></div>
        </div>
      </section>

      <section id="participar" className="beyond-act beyond-participate" aria-labelledby="participar-titulo">
        <div className="beyond-wrap">
          <div className="act-label"><span>04 / Participação</span><span>Juntos, ampliamos possibilidades</span></div>
          <h2 id="participar-titulo">O próximo capítulo <em>também é seu.</em></h2>
          <div className="participation-actions">
            <article><span>Toda terça-feira</span><h3>Um bazar.<br/>Muitas formas de ajudar.</h3><p>Contribua doando itens ou visitando o Bazar Solidário do IERC-RN.</p><Link className="beyond-link" href="/apoie">Conheça o bazar <ArrowUpRight aria-hidden="true"/></Link></article>
            <article><span>Portas abertas</span><h3>Venha conhecer<br/>de perto.</h3><p>Escolas, universidades e grupos podem solicitar uma visita pelo formulário oficial.</p><Link className="beyond-link" href="/visitas">Sobre as visitas <ArrowUpRight aria-hidden="true"/></Link></article>
          </div>
          <Link className="beyond-main-cta" href="/apoie">Apoie o IERC <ArrowUpRight aria-hidden="true"/></Link>
        </div>
      </section>

      <section className="beyond-act beyond-news" aria-labelledby="noticias-titulo">
        <div className="beyond-wrap">
          <div className="act-label"><span>05 / Conectados com você</span><span>Continue explorando</span></div>
          <h2 id="noticias-titulo">O IERC em <em>movimento.</em></h2>
          <div className="beyond-news-links">
            {[["Notícias","/noticias","Novidades do Instituto"],["Eventos","/eventos","Encontros e agenda"],["Galeria","/galeria","Registros autorizados"],["Radar da Inclusão","/radar-da-inclusao","Iniciativas de outras organizações"]].map(([title,href,desc])=><Link key={href} href={href}><div><h3>{title}</h3><p>{desc}</p></div><ArrowUpRight aria-hidden="true"/></Link>)}
          </div>
          <a className="beyond-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer"><Instagram aria-hidden="true"/> Seguir @iercrn <span className="sr-only">(abre em nova aba)</span></a>
          <PhotoCredits/>
        </div>
      </section>
    </div>
  );
}
