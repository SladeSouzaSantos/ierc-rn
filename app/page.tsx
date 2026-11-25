import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, AudioLines, BookOpenText, CalendarDays, CircleHelp,
  Compass, GraduationCap, HeartHandshake, Instagram, Laptop2, Music2,
  PersonStanding, ShoppingBag, Sparkles, Trophy, Users, Volleyball
} from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { EditorialMotif } from "@/components/editorial-motif";
import { GoalballScene } from "@/components/goalball-scene";
import { getDisplayActivities } from "@/lib/cms";

// Activities can be editorially updated after the portal image was built.
export const dynamic = "force-dynamic";

const icons = [Music2, Laptop2, Compass, BookOpenText, BookOpenText, PersonStanding, Sparkles, Volleyball];

export default async function Home() {
  const activities = await getDisplayActivities();
  return (
    <>
      <section className="hero premium-cover discovery-cover" aria-labelledby="hero-titulo">
        <div className="container hero-layout">
          <div className="cover-headline">
            <div className="hero-label"><span>Educação, reabilitação e inclusão</span><span className="hero-label-year">Natal · RN · Desde 1952</span></div>
            <h1 id="hero-titulo"><span className="cover-statement">O que transforma vidas é</span>{" "}<em>abrir possibilidades.</em></h1>
          </div>
          <div className="hero-copy">
            <p className="hero-lead">No IERC-RN, educação, autonomia, cultura e esporte caminham juntos. Conheça histórias, projetos e formas de fazer parte dessa jornada.</p>
            <div className="hero-actions">
              <Link href="/instituto" className="button button-yellow">Conheça o Instituto <ArrowUpRight size={19} aria-hidden="true" /></Link>
              <Link href="/apoie" className="text-action">Quero apoiar <ArrowRight size={19} aria-hidden="true" /></Link>
            </div>
            <p className="cover-caption"><span aria-hidden="true" className="cover-caption-mark">✳</span> Há mais de sete décadas criando caminhos para a autonomia.</p>
          </div>
          <HeroArt />
        </div>
      </section>

      <nav className="chapter-index" aria-label="Explore a página inicial">
        <div className="container chapter-index-inner">
          <span className="chapter-index-label">Explore o IERC</span>
          <a href="#atuacao"><span aria-hidden="true">01</span> Nossa essência <ArrowUpRight size={15} aria-hidden="true"/></a>
          <a href="#atividades"><span aria-hidden="true">02</span> Atuação <ArrowUpRight size={15} aria-hidden="true"/></a>
          <a href="#esporte"><span aria-hidden="true">03</span> Esporte <ArrowUpRight size={15} aria-hidden="true"/></a>
          <a href="#participar"><span aria-hidden="true">04</span> Participação <ArrowUpRight size={15} aria-hidden="true"/></a>
        </div>
      </nav>

      <section className="intro-section section-pad" id="atuacao">
        <div className="container">
          <div className="chapter-kicker" aria-hidden="true"><span>01 / Essência</span><span>Educação · Autonomia · Comunidade</span></div>
          <div className="section-heading two-col-heading">
            <div><p className="eyebrow">Nossa essência</p><h2>Mais do que aprender. <span>É poder escolher caminhos.</span></h2></div>
            <div className="heading-aside"><p>O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte atua na promoção de habilidades, convivência e participação de pessoas com deficiência visual.</p><Link className="inline-link" href="/instituto">Nossa história <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
          <div className="heritage-panel discovery-history">
            <div className="heritage-year"><span>Desde</span><strong>1952</strong><span>Rio Grande do Norte</span></div>
            <EditorialMotif variant="instituto" className="heritage-art" animate />
            <div className="heritage-note"><p>Uma história que atravessa gerações.</p><Link href="/instituto" className="inline-link">Percorra nossa história <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
          </div>
          <div className="principle-grid">
            <article className="principle-card"><span className="principle-number">01 /</span><GraduationCap aria-hidden="true" size={32}/><h3>Educação</h3><p>O conhecimento como ferramenta de autonomia e novas oportunidades.</p></article>
            <article className="principle-card"><span className="principle-number">02 /</span><Compass aria-hidden="true" size={32}/><h3>Autonomia</h3><p>Experiências de aprendizagem conectadas à vida cotidiana.</p></article>
            <article className="principle-card"><span className="principle-number">03 /</span><HeartHandshake aria-hidden="true" size={32}/><h3>Comunidade</h3><p>Encontros e iniciativas que aproximam pessoas e fortalecem vínculos.</p></article>
          </div>
        </div>
      </section>

      <section className="activities-section section-pad" id="atividades">
        <div className="container">
          <div className="chapter-kicker" aria-hidden="true"><span>02 / Atuação</span><span>Aprender de diferentes formas</span></div>
          <div className="section-heading row-heading"><div><p className="eyebrow">O que fazemos</p><h2>Oito atividades.<br/><span>Muitas descobertas.</span></h2></div><Link href="/atividades" className="inline-link">Todas as atividades <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          <div className="activity-grid discovery-catalogue">
            {activities.map((activity, index) => {
              const Icon = icons[index] ?? Sparkles;
              return <Link href={"/atividades#" + activity.id} className="activity-card" key={activity.id}>
                <div className="activity-top"><span className="activity-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="activity-icon"><Icon size={27} strokeWidth={1.65} aria-hidden="true" /></span></div>
                <div className="activity-copy"><p className="activity-type">{activity.category}</p><h3>{activity.title}</h3><p>{activity.description}</p></div>
                <span className="activity-direction" aria-hidden="true"><ArrowUpRight size={21}/></span>
              </Link>;
            })}
          </div>
        </div>
      </section>

      <section className="sport-section" id="esporte" aria-labelledby="goalball-title">
        <div className="container sport-layout discovery-sport">
          <div className="sport-copy">
            <div className="chapter-kicker chapter-kicker-light" aria-hidden="true"><span>03 / Esporte</span></div>
            <p className="eyebrow light">Esporte que faz história</p>
            <h2 id="goalball-title">O som da bola.<br/><em>A força de uma equipe.</em></h2>
            <p>O goalball faz parte da vida esportiva do IERC-RN. A instituição participa de competições, forma atletas e revela talentos que representam o Rio Grande do Norte e o Brasil.</p>
            <Link className="button button-yellow" href="/esportes">Conheça o goalball <ArrowUpRight size={18} aria-hidden="true"/></Link>
            <a className="sport-source" href="https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande" target="_blank" rel="noopener noreferrer">Fonte: CBDV, 2026 <span className="sr-only">(abre em nova aba)</span></a>
          </div>
          <GoalballScene />
        </div>
      </section>

      <section className="stories-section section-pad">
        <div className="container stories-layout">
          <div className="stories-symbol discovery-portrait" aria-hidden="true">
            <EditorialMotif variant="historias" className="stories-art" animate />
            <span className="symbol-footnote">Trajetórias · IERC-RN</span>
          </div>
          <div className="stories-copy"><p className="eyebrow">Trajetórias</p><h2>Cada conquista começa com a chance de <em>descobrir seu próprio caminho.</em></h2><p>Conheça trajetórias de atletas cuja passagem pelo IERC-RN está registrada em fontes públicas, da descoberta do esporte às conquistas nacionais e internacionais.</p><Link className="inline-link" href="/historias">Conheça as trajetórias <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
        </div>
      </section>

      <section className="community-section section-pad" id="participar">
        <div className="container">
          <div className="chapter-kicker" aria-hidden="true"><span>04 / Participação</span><span>Faça parte dessa história</span></div>
          <div className="community-heading"><p className="eyebrow">Juntos, ampliamos possibilidades</p><h2>Há muitas maneiras de <em>fazer parte.</em></h2></div>
        </div>
        <div className="container community-layout">
          <div className="bazar-card">
            <div className="bazar-icon" aria-hidden="true"><ShoppingBag size={35} strokeWidth={1.5}/></div>
            <p className="eyebrow">Toda terça-feira</p><h2>Um bazar.<br/>Muitas formas de <em>ajudar.</em></h2><p>O Bazar Solidário do IERC-RN arrecada recursos para a instituição. Você pode contribuir doando itens ou visitando o bazar para comprar.</p><Link className="button button-dark" href="/apoie">Conheça o bazar <ArrowUpRight size={18} aria-hidden="true" /></Link><span className="bazar-accent" aria-hidden="true" />
          </div>
          <div className="visit-card">
            <div className="visit-icon" aria-hidden="true"><Users size={35} strokeWidth={1.5}/></div>
            <p className="eyebrow">Portas abertas</p><h2>Venha conhecer <em>de perto.</em></h2><p>Escolas, universidades e grupos podem consultar orientações e solicitar uma visita pelo formulário oficial do Instituto.</p><Link className="inline-link" href="/visitas">Sobre as visitas <ArrowUpRight size={18} aria-hidden="true" /></Link><span className="visit-shape" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="updates-section section-pad">
        <div className="container">
          <div className="section-heading row-heading"><div><p className="eyebrow">Conectados com você</p><h2>O IERC em movimento.</h2></div><Link className="inline-link" href="/noticias">Área de notícias <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          <div className="updates-grid">
            <Link className="update-card" href="/noticias"><span className="update-glyph"><AudioLines size={36} aria-hidden="true"/></span><span className="update-category">Notícias</span><h3>Acompanhe as novidades do Instituto</h3><p>Um espaço dedicado às atividades, conquistas e iniciativas da comunidade.</p><ArrowUpRight className="update-arrow" size={21} aria-hidden="true"/></Link>
            <Link className="update-card" href="/eventos"><span className="update-glyph"><CalendarDays size={36} aria-hidden="true"/></span><span className="update-category">Agenda</span><h3>Encontros, apresentações e eventos</h3><p>A programação oficial poderá ser consultada aqui quando for disponibilizada.</p><ArrowUpRight className="update-arrow" size={21} aria-hidden="true"/></Link>
            <Link className="update-card" href="/galeria"><span className="update-glyph"><CircleHelp size={36} aria-hidden="true"/></span><span className="update-category">Galeria</span><h3>Registros de quem faz o IERC</h3><p>Fotos e vídeos com descrições acessíveis e uso autorizado.</p><ArrowUpRight className="update-arrow" size={21} aria-hidden="true"/></Link>
          </div>
          <Link className="radar-home-link" href="/radar-da-inclusao"><div><span className="eyebrow">Brasil e mundo</span><strong>Radar da Inclusão</strong><span>Conheça iniciativas, acessibilidade e experiências de outras organizações.</span></div><ArrowUpRight size={28} aria-hidden="true"/></Link>
        </div>
      </section>

      <section className="social-strip">
        <div className="container social-strip-inner"><div><Instagram size={28} aria-hidden="true" /><span><strong>Acompanhe o IERC no Instagram.</strong><small>Notícias, registros e a rotina da instituição.</small></span></div><a className="inline-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">Seguir @iercrn <ArrowUpRight size={18} aria-hidden="true"/><span className="sr-only">(abre em nova aba)</span></a></div>
      </section>
    </>
  );
}
