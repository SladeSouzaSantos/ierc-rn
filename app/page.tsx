import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, AudioLines, BookOpenText, CalendarDays, CircleHelp,
  Compass, GraduationCap, HeartHandshake, Instagram, Laptop2, Music2,
  PersonStanding, ShoppingBag, Sparkles, Trophy, Users, Volleyball
} from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { GoalballScene } from "@/components/goalball-scene";
import { getDisplayActivities } from "@/lib/cms";

// Activities can be editorially updated after the portal image was built.
export const dynamic = "force-dynamic";

const icons = [Music2, Laptop2, Compass, BookOpenText, BookOpenText, PersonStanding, Sparkles, Volleyball];

export default async function Home() {
  const activities = await getDisplayActivities();
  return (
    <>
      <section className="hero" aria-labelledby="hero-titulo">
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="hero-label"><span className="label-dot" /> Educação, reabilitação e inclusão no RN <span className="hero-label-year">Desde 1952</span></div>
            <h1 id="hero-titulo">O que transforma vidas é <em>abrir possibilidades.</em></h1>
            <p className="hero-lead">No IERC-RN, educação, autonomia, cultura e esporte caminham juntos. Conheça histórias, projetos e formas de fazer parte dessa jornada.</p>
            <div className="hero-actions">
              <Link href="/instituto" className="button button-yellow">Conheça o Instituto <ArrowUpRight size={19} aria-hidden="true" /></Link>
              <Link href="/apoie" className="text-action">Quero apoiar <ArrowRight size={19} aria-hidden="true" /></Link>
            </div>
            <div className="hero-mini"><span className="hero-mini-mark" aria-hidden="true">✳</span><span>Há mais de sete décadas criando caminhos para a autonomia.</span></div>
          </div>
          <HeroArt />
        </div>
      </section>

      <section className="intro-section section-pad" id="atuacao">
        <div className="container">
          <div className="section-heading two-col-heading">
            <div><p className="eyebrow">Nossa essência</p><h2>Mais do que aprender. <span>É poder escolher caminhos.</span></h2></div>
            <div className="heading-aside"><p>O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte atua na promoção de habilidades, convivência e participação de pessoas com deficiência visual.</p><Link className="inline-link" href="/instituto">Nossa história <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
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
          <div className="section-heading row-heading"><div><p className="eyebrow">O que fazemos</p><h2>Oito atividades.<br/><span>Muitas descobertas.</span></h2></div><Link href="/atividades" className="inline-link">Todas as atividades <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          <div className="activity-grid">
            {activities.map((activity, index) => {
              const Icon = icons[index] ?? Sparkles;
              return <Link href={"/atividades#" + activity.id} className="activity-card" key={activity.id}>
                <div className="activity-top"><span className="activity-icon"><Icon size={27} strokeWidth={1.65} aria-hidden="true" /></span><ArrowUpRight size={20} aria-hidden="true" /></div>
                <p className="activity-type">{activity.category}</p><h3>{activity.title}</h3><p>{activity.description}</p>
              </Link>;
            })}
          </div>
        </div>
      </section>

      <section className="sport-section" aria-labelledby="goalball-title">
        <div className="container sport-layout">
          <div className="sport-copy">
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
          <div className="stories-symbol" aria-hidden="true"><span>“</span><span className="symbol-footnote">Histórias em construção</span></div>
          <div className="stories-copy"><p className="eyebrow">Trajetórias</p><h2>Cada conquista começa com a chance de <em>descobrir seu próprio caminho.</em></h2><p>Conheça trajetórias de atletas cuja passagem pelo IERC-RN está registrada em fontes públicas, da descoberta do esporte às conquistas nacionais e internacionais.</p><Link className="inline-link" href="/historias">Conheça as trajetórias <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
        </div>
      </section>

      <section className="community-section section-pad">
        <div className="container community-layout">
          <div className="bazar-card">
            <div className="bazar-icon" aria-hidden="true"><ShoppingBag size={35} strokeWidth={1.5}/></div>
            <p className="eyebrow">Toda terça-feira</p><h2>Um bazar.<br/>Muitas formas de <em>ajudar.</em></h2><p>O Bazar Solidário do IERC-RN arrecada recursos para a instituição. Você pode contribuir doando itens ou visitando o bazar para comprar.</p><Link className="button button-dark" href="/apoie">Conheça o bazar <ArrowUpRight size={18} aria-hidden="true" /></Link><span className="bazar-accent" aria-hidden="true" />
          </div>
          <div className="visit-card">
            <div className="visit-icon" aria-hidden="true"><Users size={35} strokeWidth={1.5}/></div>
            <p className="eyebrow">Portas abertas</p><h2>Venha conhecer <em>de perto.</em></h2><p>Escolas, universidades e grupos poderão consultar informações sobre excursões e visitas ao Instituto. O agendamento oficial será integrado em breve.</p><Link className="inline-link" href="/visitas">Sobre as visitas <ArrowUpRight size={18} aria-hidden="true" /></Link><span className="visit-shape" aria-hidden="true" />
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
        </div>
      </section>

      <section className="social-strip">
        <div className="container social-strip-inner"><div><Instagram size={28} aria-hidden="true" /><span><strong>Acompanhe o IERC no Instagram.</strong><small>Notícias, registros e a rotina da instituição.</small></span></div><a className="inline-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">Seguir @iercrn <ArrowUpRight size={18} aria-hidden="true"/><span className="sr-only">(abre em nova aba)</span></a></div>
      </section>
    </>
  );
}
