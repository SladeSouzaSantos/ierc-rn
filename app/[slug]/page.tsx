import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, HeartHandshake, Instagram, MapPin, ShoppingBag, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { activities, stories } from "@/lib/site-data";

const pages = {
  instituto: { eyebrow: "Nossa história", title: "O Instituto", description: "Uma história construída com educação, reabilitação, participação e compromisso com a autonomia." },
  atividades: { eyebrow: "Nossa atuação", title: "Atividades que ampliam caminhos", description: "Conheça as experiências de aprendizagem, cultura, movimento e autonomia oferecidas pelo Instituto." },
  esportes: { eyebrow: "Esporte", title: "Goalball e possibilidades em movimento", description: "A força do esporte coletivo, a participação em competições e o protagonismo dos atletas." },
  historias: { eyebrow: "Nossa comunidade", title: "Histórias que merecem ser contadas", description: "Trajetórias de pessoas que passaram pelo IERC e construíram seus próprios caminhos." },
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

  return (
    <>
      <PageHero {...entry} />
      <div className="container interior-body">
        {slug === "instituto" && <>
          <div className="detail-intro"><p className="eyebrow">Desde 1952</p><h2>Histórias compartilhadas. Possibilidades multiplicadas.</h2><p>O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte desenvolve ações de educação, reabilitação, cultura e esporte, contribuindo para a participação de pessoas com deficiência visual em Natal e região.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><span>01 /</span><h3>Educação e aprendizagem</h3><p>Atividades e experiências que favorecem o acesso ao conhecimento.</p></article>
            <article className="detail-card"><span>02 /</span><h3>Autonomia e mobilidade</h3><p>Práticas de orientação, recursos e vivências para o cotidiano.</p></article>
            <article className="detail-card"><span>03 /</span><h3>Cultura e esporte</h3><p>Música, educação física, goalball e oportunidades de participação.</p></article>
          </div>
          <Note>Textos institucionais, missão, equipe e linha do tempo detalhada serão validados com o IERC antes da publicação oficial.</Note>
          <Callout title="Conheça nossas atividades" href="/atividades" label="Explorar atividades">Música, informática, Braille, orientação e mobilidade, estimulação precoce e muito mais.</Callout>
        </>}

        {slug === "atividades" && <>
          <div className="detail-intro"><p className="eyebrow">Oito frentes de atuação</p><h2>Aprendizado em diferentes formas.</h2><p>Cada atividade é uma oportunidade para desenvolver habilidades, ampliar repertórios e criar novas conexões. Informações sobre vagas e horários serão acrescentadas após confirmação institucional.</p></div>
          <div className="detail-grid detail-grid-activities">
            {activities.map((activity, index) => <article className="detail-card" id={activity.id} key={activity.id}><span>{String(index + 1).padStart(2, "0")} / {activity.category}</span><h3>{activity.title}</h3><p>{activity.description}</p></article>)}
          </div>
          <Callout title="Quer saber como participar?" href="/contato" label="Canais de contato">As orientações para atendimento e inscrição estão sendo organizadas com a instituição.</Callout>
        </>}

        {slug === "esportes" && <>
          <div className="detail-intro"><p className="eyebrow">Em destaque: goalball</p><h2>Uma modalidade de equipe, escuta e estratégia.</h2><p>O goalball é uma modalidade paralímpica criada para pessoas com deficiência visual. O objetivo é marcar gols lançando uma bola com guizos, enquanto os jogadores adversários defendem a meta usando orientação sonora.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><Trophy size={32} aria-hidden="true" /><h3>Competição nacional</h3><p>A equipe feminina do IERC-RN integrou a Série A do Campeonato Brasileiro em 2026.</p></article>
            <article className="detail-card"><Users size={32} aria-hidden="true" /><h3>Equipes do Instituto</h3><p>O IERC-RN também esteve representado por equipes masculina e feminina no Regional Nordeste de 2026.</p></article>
            <article className="detail-card"><CalendarDays size={32} aria-hidden="true" /><h3>Agenda esportiva</h3><p>Resultados, jogos e escalações serão divulgados após confirmação com a coordenação esportiva.</p></article>
          </div>
          <Note>Referência documental: <a href="https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande" target="_blank" rel="noopener noreferrer">CBDV — Regional Nordeste de Goalball, abril de 2026 <span className="sr-only">(abre em nova aba)</span></a>.</Note>
          <Callout title="Histórias que atravessam gerações" href="/historias" label="Explorar histórias">Em breve, reuniremos trajetórias de alunos e ex-alunos que passaram pelo esporte e outras áreas.</Callout>
        </>}

        {slug === "historias" && <>
          <div className="detail-intro"><p className="eyebrow">Em curadoria</p><h2>Uma comunidade feita de muitas histórias.</h2><p>Estamos preparando depoimentos e perfis de ex-alunos, atletas e outras pessoas ligadas ao Instituto. Cada publicação dependerá de pesquisa, confirmação do vínculo e autorização de uso da imagem.</p></div>
          <h2 className="interior-subtitle">Pautas em preparação</h2>
          <div className="detail-grid">
            {stories.map((person) => <article key={person.name} className="detail-card story-preview"><span>Perfil em preparação</span><h3>{person.name}</h3><p>{person.area}</p></article>)}
          </div>
          <Note>Esta relação é uma pauta editorial inicial e não substitui biografias, depoimentos ou documentos confirmados pela instituição.</Note>
        </>}

        {slug === "noticias" && <><div className="detail-intro"><p className="eyebrow">Em breve</p><h2>Um espaço para acompanhar o dia a dia.</h2><p>Notícias poderão incluir atividades, projetos, resultados esportivos e comunicados. O conteúdo será publicado por uma equipe autorizada, com revisão editorial e campos de acessibilidade.</p></div><div className="detail-grid"><article className="detail-card"><h3>Institucional</h3><p>Comunicados e projetos.</p></article><article className="detail-card"><h3>Atividades</h3><p>Educação, cultura e desenvolvimento.</p></article><article className="detail-card"><h3>Esportes</h3><p>Competições e histórias do goalball.</p></article></div><Note>Não há notícias fictícias neste protótipo. Consulte o <a href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">Instagram oficial <span className="sr-only">(abre em nova aba)</span></a> enquanto preparamos o painel de publicações.</Note></>}

        {slug === "eventos" && <><div className="detail-intro"><p className="eyebrow">Agenda em preparação</p><h2>O próximo encontro começa aqui.</h2><p>Esta seção receberá o calendário oficial de eventos, incluindo atividades institucionais, apresentações, competições e visitas abertas. Não publicaremos datas sem confirmação.</p></div><div className="detail-card solo-card"><CalendarDays size={40} aria-hidden="true"/><h3>Programação oficial em breve</h3><p>Futuramente, cada evento terá data, horário, local, detalhes e orientações de acessibilidade.</p></div></>}

        {slug === "galeria" && <><div className="detail-intro"><p className="eyebrow">Acervo em organização</p><h2>Memórias para ver, ouvir e compartilhar.</h2><p>As galerias poderão reunir atividades, apresentações, competições e momentos da comunidade. Fotografias terão descrições alternativas; vídeos terão legendas e recursos adicionais conforme o conteúdo.</p></div><div className="detail-card solo-card"><h3>Imagens oficiais em preparação</h3><p>Aguardamos seleção de materiais e autorizações. Não utilizamos fotografias de terceiros como se fossem registros do IERC.</p></div></>}

        {slug === "visitas" && <><div className="detail-intro"><p className="eyebrow">Conheça de perto</p><h2>Uma visita pode aproximar pessoas e ideias.</h2><p>O IERC organiza visitas e excursões. Escolas, universidades, instituições e grupos poderão encontrar aqui orientações para conhecer as atividades e os espaços do Instituto.</p></div><div className="detail-grid"><article className="detail-card"><Users size={32} aria-hidden="true"/><h3>Para grupos e instituições</h3><p>Informações sobre o perfil dos grupos, visitas e possíveis orientações serão confirmadas com a equipe.</p></article><article className="detail-card"><CalendarDays size={32} aria-hidden="true"/><h3>Agendamento oficial</h3><p>O Instituto já dispõe de um link de agendamento. O acesso será disponibilizado aqui assim que for fornecido.</p></article></div><Note>Não há formulário de reserva ativo neste momento. Evitamos criar uma segunda agenda concorrente com o sistema da instituição.</Note></>}

        {slug === "apoie" && <><div className="detail-intro"><p className="eyebrow">Solidariedade que movimenta</p><h2>Pequenos gestos também abrem caminhos.</h2><p>Há diferentes formas de participar do cotidiano do IERC-RN. Uma delas é o Bazar Solidário, uma ação arrecadatória da instituição.</p></div><div className="bazar-detail"><div><ShoppingBag size={36} aria-hidden="true"/><p className="eyebrow">Toda terça-feira</p><h2>Bazar Solidário</h2><p>Você pode doar itens para o bazar ou visitar o espaço para comprar. A arrecadação contribui com as atividades do Instituto.</p></div><div className="bazar-detail-secondary"><h3>Antes de visitar</h3><p>Horário de funcionamento, itens aceitos, local de entrega e orientações ainda serão confirmados com a equipe.</p></div></div><div className="detail-grid"><article className="detail-card"><HeartHandshake size={32} aria-hidden="true"/><h3>Doe itens</h3><p>Ajude a manter o bazar por meio de doações, seguindo os critérios que serão divulgados.</p></article><article className="detail-card"><ShoppingBag size={32} aria-hidden="true"/><h3>Compre no bazar</h3><p>Visite o espaço às terças-feiras, depois de confirmar horário e endereço com o Instituto.</p></article></div><Note>Doações financeiras e pagamentos não estão disponíveis neste protótipo. A integração será realizada apenas após definição do recebedor e das regras institucionais.</Note></>}

        {slug === "contato" && <><div className="detail-intro"><p className="eyebrow">Estamos em Natal</p><h2>Vamos manter essa conversa aberta.</h2><p>Os canais oficiais de telefone, WhatsApp e e-mail serão inseridos quando forem confirmados pela equipe do IERC-RN. Por enquanto, acompanhe o perfil institucional no Instagram.</p></div><div className="detail-grid"><article className="detail-card"><Instagram size={32} aria-hidden="true"/><h3>Instagram oficial</h3><p><a className="inline-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">@iercrn <ArrowUpRight size={17} aria-hidden="true"/><span className="sr-only">(abre em nova aba)</span></a></p></article><article className="detail-card"><MapPin size={32} aria-hidden="true"/><h3>Rio Grande do Norte</h3><p>Natal / RN. Endereço completo e horário de atendimento em validação.</p></article></div></>}
      </div>
    </>
  );
}
