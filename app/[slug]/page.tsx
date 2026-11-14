import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, Instagram, Mail, MapPin, MessageCircle, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getDisplayActivities, getCmsNews, getCmsEvents, getCmsAthletes, getCmsSportCompetitions, getCmsVisitBookingUrl } from "@/lib/cms";
import { CmsNewsList, CmsIercPressList, CmsEventsList, CmsInstitutionalEventNews, CmsAthletesList } from "@/components/cms-public";
import { SportRecords, ExternalClippings, PastEvents, VerifiedAddress } from "@/components/editorial-records";
import { AthleteStories } from "@/components/athlete-stories";
import { SupportPage } from "@/components/support-page";
import { InstitutionStory } from "@/components/institution-story";
import { LocationMap } from "@/components/location-map";
import { IERC_MAPS_LINK } from "@/lib/location";
import { IERC_OFFICIAL_EMAIL, IERC_OFFICIAL_EMAIL_LINK, IERC_OFFICIAL_WHATSAPP, IERC_OFFICIAL_WHATSAPP_LINK } from "@/lib/institutional-contact";
import { SportCompetitions } from "@/components/sport-competitions";
import { getCbdvGoalballCalendar } from "@/lib/cbdv-calendar";

// CMS-backed sections must use runtime credentials, not their empty build-time fallback.
export const dynamic = "force-dynamic";

const pages = {
  instituto: { eyebrow: "Nossa história", title: "O Instituto", description: "Uma história construída com educação, reabilitação, participação e compromisso com a autonomia." },
  atividades: { eyebrow: "Nossa atuação", title: "Atividades que ampliam caminhos", description: "Conheça as experiências de aprendizagem, cultura, movimento e autonomia oferecidas pelo Instituto." },
  esportes: { eyebrow: "Esporte", title: "Goalball e possibilidades em movimento", description: "A força do esporte coletivo, a participação em competições e o protagonismo dos atletas." },
  historias: { eyebrow: "Trajetórias", title: "Histórias que atravessam o esporte", description: "Atletas com passagens documentadas pelo IERC-RN e conquistas em diferentes modalidades paralímpicas." },
  noticias: { eyebrow: "Acontece no IERC", title: "Notícias", description: "Um espaço para acompanhar iniciativas, acontecimentos e novidades da instituição." },
  eventos: { eyebrow: "Agenda institucional", title: "Eventos", description: "Apresentações, competições, atividades abertas à comunidade e outras ações do Instituto." },
  galeria: { eyebrow: "Memórias e encontros", title: "Galeria", description: "Registros em fotografia e vídeo, acompanhados de descrições acessíveis." },
  visitas: { eyebrow: "Venha conhecer", title: "Visitas e excursões", description: "Escolas, universidades e outros grupos poderão conhecer de perto a atuação do IERC-RN." },
  apoie: { eyebrow: "Faça parte", title: "Apoie o IERC-RN", description: "Sua participação ajuda a fortalecer as iniciativas e atividades da instituição." },
  contato: { eyebrow: "Converse com a gente", title: "Contato", description: "Conheça os canais institucionais disponíveis e acompanhe os comunicados oficiais." },
} as const;

type Slug = keyof typeof pages;
type RouteProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!(slug in pages)) return {};
  return { title: pages[slug as Slug].title };
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="editorial-note"><span className="note-dot" aria-hidden="true" />{children}</div>;
}

function Callout({ title, children, href, label }: { title: string; children: React.ReactNode; href?: string; label?: string }) {
  return <section className="detail-callout"><h2>{title}</h2><p>{children}</p>{href && <Link href={href} className="button button-yellow">{label ?? "Saiba mais"} <ArrowUpRight size={18} aria-hidden="true" /></Link>}</section>;
}

export default async function ContentPage({ params }: RouteProps) {
  const { slug } = await params;
  if (!(slug in pages)) notFound();
  const entry = pages[slug as Slug];
  const displayActivities = slug === "atividades" ? await getDisplayActivities() : [];
  const cmsNews = slug === "noticias" || slug === "eventos" ? await getCmsNews() : [];
  const cmsEvents = slug === "eventos" ? await getCmsEvents() : [];
  const cmsSportCompetitions = slug === "esportes" ? await getCmsSportCompetitions() : [];
  const cbdvCompetitions = slug === "esportes" ? await getCbdvGoalballCalendar() : [];
  const visitBookingUrl = slug === "visitas" ? await getCmsVisitBookingUrl() : "";
  const cmsAthletes = slug === "historias" ? await getCmsAthletes() : [];

  return (
    <>
      <PageHero {...entry} />
      <div className="container interior-body">
        {slug === "instituto" && <InstitutionStory />}

        {slug === "atividades" && <>
          <div className="detail-intro"><p className="eyebrow">Oito frentes de atuação</p><h2>Aprendizado em diferentes formas.</h2><p>Cada atividade é uma oportunidade para desenvolver habilidades, ampliar repertórios e criar novas conexões. Informações sobre vagas e horários serão acrescentadas após confirmação institucional.</p></div>
          <div className="detail-grid detail-grid-activities">
            {displayActivities.map((activity, index) => <article className="detail-card" id={activity.id} key={activity.id}><span>{String(index + 1).padStart(2, "0")} / {activity.category}</span><h3>{activity.title}</h3><p>{activity.description}</p></article>)}
          </div>
          <Callout title="Quer saber como participar?" href="/contato" label="Canais de contato">As orientações para atendimento e inscrição estão sendo organizadas com a instituição.</Callout>
        </>}

        {slug === "esportes" && <>
          <div className="detail-intro"><p className="eyebrow">Em destaque: goalball</p><h2>Uma modalidade de equipe, escuta e estratégia.</h2><p>O goalball é um esporte paralímpico para pessoas com deficiência visual. Os jogadores procuram marcar gols lançando uma bola com guizos, enquanto a defesa se orienta pelo som.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><Trophy size={32} aria-hidden="true" /><h3>Série A feminina de 2026</h3><p>A CBDV relacionou a equipe feminina do IERC-RN entre as participantes do campeonato nacional de 2026.</p></article>
            <article className="detail-card"><Users size={32} aria-hidden="true" /><h3>Regional Nordeste</h3><p>A instituição foi relacionada nas categorias masculina e feminina da edição de abril de 2026.</p></article>
            <article className="detail-card"><CalendarDays size={32} aria-hidden="true" /><h3>Próximos jogos</h3><p>Escalações atuais, resultados detalhados e agenda futura dependem de confirmação com a coordenação esportiva.</p></article>
          </div>
          <SportCompetitions cbdv={cbdvCompetitions} competitions={cmsSportCompetitions} />
          <SportRecords />
          <Note>Os nomes de atletas são transcritos de uma lista pública da CBDV de 2026, sem implicar vínculo atual. Fotografias e biografias individuais dependem de autorização.</Note>
          <Callout title="Histórias que atravessam gerações" href="/historias" label="Explorar histórias">Conheça nove trajetórias com vínculos documentados ao IERC-RN, fontes de carreira e fotografias de referência em homologação.</Callout>
        </>}

        {slug === "historias" && <>
          <div className="detail-intro">
            <p className="eyebrow">Acervo biográfico · fontes públicas</p>
            <h2>Histórias reais de dedicação, esporte e autonomia.</h2>
            <p>O IERC-RN faz parte de diferentes trajetórias de atletas potiguares. Esta seleção reúne pessoas com passagem pela instituição explicitamente documentada em fontes públicas. Conquistas posteriores são atribuídas a cada atleta, sem afirmar que representavam o IERC quando conquistaram suas medalhas.</p>
          </div>
          <AthleteStories />
          <CmsAthletesList items={cmsAthletes} />
          <Note>A pesquisa biográfica continua em desenvolvimento. Histórias de outros atletas potiguares, incluindo Rosicleide Andrade, Romário Marques e Halyson Boto, seguem em análise porque o vínculo pessoal com o IERC ainda precisa ser documentado de forma inequívoca.</Note>
        </>}

        {slug === "noticias" && <>
          <div className="detail-intro"><p className="eyebrow">Acontece e aconteceu</p><h2>Acompanhe as notícias do IERC-RN.</h2><p>Este espaço prioriza os comunicados e acontecimentos divulgados pela equipe do Instituto. Reportagens de terceiros sobre o IERC-RN aparecem identificadas separadamente; notícias sobre outras organizações ficam no Radar da Inclusão.</p></div>
          <CmsNewsList items={cmsNews} />
          <CmsIercPressList items={cmsNews} />
          <ExternalClippings />
          <section className="radar-teaser" aria-labelledby="radar-teaser-title">
            <div>
              <p className="eyebrow">Conteúdo externo · Brasil e mundo</p>
              <h2 id="radar-teaser-title">Conheça o Radar da Inclusão</h2>
              <p>Um espaço para acompanhar experiências de esporte adaptado, educação, tecnologia assistiva e acessibilidade em outras instituições. Sínteses com fontes identificadas, publicadas somente após aprovação editorial.</p>
            </div>
            <Link className="button button-yellow" href="/radar-da-inclusao">
              Explorar o Radar <ArrowUpRight size={18} aria-hidden="true"/>
            </Link>
          </section>
          <Note>Não foram criadas notícias fictícias. Os registros acima referem-se a fontes verificáveis. Para comunicados atuais do Instituto, consulte o <a href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">Instagram informado do IERC<span className="sr-only"> (abre em nova aba)</span></a>.</Note>
        </>}

        {slug === "eventos" && <>
          <div className="detail-intro"><p className="eyebrow">Agenda, notícias e memória</p><h2>O que acontece no IERC-RN.</h2><p>Acompanhe eventos futuros confirmados, atividades internas já realizadas e o acervo histórico esportivo. Somente informações institucionais aprovadas entram na agenda e na cobertura de eventos.</p></div>
          <CmsEventsList items={cmsEvents} />
          <CmsInstitutionalEventNews items={cmsNews} />
          <PastEvents />
        </>}

        {slug === "galeria" && <><div className="detail-intro"><p className="eyebrow">Acervo em organização</p><h2>Memórias para ver, ouvir e compartilhar.</h2><p>As galerias poderão reunir atividades, apresentações, competições e momentos da comunidade. Fotografias terão descrições alternativas; vídeos terão legendas e recursos adicionais conforme o conteúdo.</p></div><div className="detail-card solo-card"><h3>Imagens oficiais em preparação</h3><p>Aguardamos seleção de materiais e autorizações. Não utilizamos fotografias de terceiros como se fossem registros do IERC.</p></div></>}

        {slug === "visitas" && <>
          <div className="detail-intro"><p className="eyebrow">Conheça de perto</p><h2>Uma visita pode aproximar pessoas e ideias.</h2><p>O IERC-RN recebe solicitações de visitas de escolas, universidades e outros grupos por meio de seu formulário oficial. O Instituto está localizado no Alecrim, em Natal. A data e o horário solicitados dependem de confirmação da equipe.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><Users size={32} aria-hidden="true" /><h3>Para grupos e instituições</h3><p>Informe a instituição visitante, a quantidade e a faixa etária dos participantes, a turma e o objetivo da visita.</p></article>
            <article className="detail-card"><MapPin size={32} aria-hidden="true" /><h3>Onde estamos</h3><VerifiedAddress /><p><a className="inline-link" href={IERC_MAPS_LINK} target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={17} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a></p></article>
            <article className="detail-card"><CalendarDays size={32} aria-hidden="true" /><h3>Agendamento oficial</h3><p>Indique a data, o horário e a duração desejados, além dos contatos do responsável pelo grupo. A solicitação será avaliada pela equipe do IERC-RN.</p></article>
          </div>
          <section className="detail-callout" aria-labelledby="visitas-agendamento-title">
            <h2 id="visitas-agendamento-title">Solicite uma visita ao IERC-RN</h2>
            <p>Preencha o formulário de agendamento disponibilizado pelo Instituto. O pedido não garante a reserva: aguarde a confirmação da equipe antes de organizar o deslocamento.</p>
            <a href={visitBookingUrl} className="button button-yellow" target="_blank" rel="noopener noreferrer">
              Solicitar agendamento de visita <ArrowUpRight size={18} aria-hidden="true"/>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
            <p className="visit-form-disclosure">Você será direcionado ao Google Forms, serviço externo que recebe as informações preenchidas. Informe apenas os dados solicitados e necessários ao agendamento.</p>
          </section>
          <LocationMap />
          <Note>O agendamento é realizado pelo formulário oficial, não por este portal. Antes de visitar, confirme com a equipe do IERC-RN a disponibilidade, as condições de acessibilidade e as orientações para o grupo.</Note>
        </>}

        {slug === "apoie" && <SupportPage />}

        {slug === "contato" && <>
          <div className="detail-intro"><p className="eyebrow">Estamos no Alecrim, Natal</p><h2>Vamos manter essa conversa aberta.</h2><p>Visite-nos na Rua Fonseca e Silva, 1113, no Alecrim, em Natal/RN. Consulte o mapa abaixo para planejar o trajeto ou entre em contato pelo WhatsApp e e-mail oficiais. Para assuntos de atendimento, confirme o horário com a equipe.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><MapPin size={32} aria-hidden="true" /><h3>Onde fica o Instituto</h3><VerifiedAddress /><p><a className="inline-link" href={IERC_MAPS_LINK} target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={17} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a></p></article>
            <article className="detail-card"><Instagram size={32} aria-hidden="true" /><h3>Instagram informado</h3><p><a className="inline-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">@iercrn <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only">(abre em nova aba)</span></a></p></article>
            <article className="detail-card"><MessageCircle size={32} aria-hidden="true" /><h3>WhatsApp oficial</h3><p>{IERC_OFFICIAL_WHATSAPP}</p><p><a className="inline-link" href={IERC_OFFICIAL_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">Conversar com o IERC-RN <ArrowUpRight size={17} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a></p></article>
          </div>
          <section className="detail-card contact-email" aria-labelledby="contact-email-title">
            <Mail size={32} aria-hidden="true"/>
            <div>
              <h3 id="contact-email-title">E-mail institucional</h3>
              <p><a className="inline-link" href={IERC_OFFICIAL_EMAIL_LINK}>{IERC_OFFICIAL_EMAIL}</a></p>
              <p>Para informações sobre atividades, visitas, doações e parcerias, utilize os canais oficiais acima.</p>
            </div>
          </section>
          <LocationMap />
          <Note>WhatsApp e e-mail foram confirmados pela instituição. Horários de atendimento geral e outros telefones ainda dependem de confirmação.</Note>
        </>}


      </div>
    </>
  );
}
