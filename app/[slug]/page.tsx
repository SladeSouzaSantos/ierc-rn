import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, HeartHandshake, Instagram, MapPin, ShoppingBag, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { activities } from "@/lib/site-data";
import { Timeline, SportRecords, ExternalClippings, PastEvents, SourceLink, VerifiedAddress } from "@/components/editorial-records";
import { AthleteStories } from "@/components/athlete-stories";

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

  return (
    <>
      <PageHero {...entry} />
      <div className="container interior-body">
        {slug === "instituto" && <>
          <div className="detail-intro"><p className="eyebrow">Fundado em 16 de julho de 1952</p><h2>Histórias compartilhadas. Possibilidades multiplicadas.</h2><p>O Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte é uma entidade sem fins lucrativos dedicada à educação, à habilitação e à reabilitação de pessoas com deficiência visual. Sua missão histórica destaca autonomia e participação social.</p><SourceLink source="history" label="Consultar histórico do Instituto"/></div>
          <div className="detail-grid">
            <article className="detail-card"><span>01 /</span><h3>Educação e aprendizagem</h3><p>O acesso à leitura, ao conhecimento e à aprendizagem integra a trajetória do IERC.</p></article>
            <article className="detail-card"><span>02 /</span><h3>Autonomia e mobilidade</h3><p>Práticas de orientação e reabilitação contribuem para a participação na vida cotidiana.</p></article>
            <article className="detail-card"><span>03 /</span><h3>Cultura e esporte</h3><p>Experiências musicais e culturais e a participação no goalball fazem parte da atuação divulgada pelo Instituto.</p></article>
          </div>
          <Timeline />
          <Note>Missão e finalidade citadas no acervo histórico do IERC, publicado em 2010. O texto institucional vigente, a equipe e os horários ainda aguardam revisão da instituição.</Note>
          <Callout title="Conheça nossas atividades" href="/atividades" label="Explorar atividades">Música, informática, Braille, orientação e mobilidade, estimulação precoce e outras iniciativas em curadoria.</Callout>
        </>}

        {slug === "atividades" && <>
          <div className="detail-intro"><p className="eyebrow">Oito frentes de atuação</p><h2>Aprendizado em diferentes formas.</h2><p>Cada atividade é uma oportunidade para desenvolver habilidades, ampliar repertórios e criar novas conexões. Informações sobre vagas e horários serão acrescentadas após confirmação institucional.</p></div>
          <div className="detail-grid detail-grid-activities">
            {activities.map((activity, index) => <article className="detail-card" id={activity.id} key={activity.id}><span>{String(index + 1).padStart(2, "0")} / {activity.category}</span><h3>{activity.title}</h3><p>{activity.description}</p></article>)}
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
          <SportRecords />
          <Note>Os nomes de atletas são transcritos de uma lista pública da CBDV de 2026, sem implicar vínculo atual. Fotografias e biografias individuais dependem de autorização.</Note>
          <Callout title="Histórias que atravessam gerações" href="/historias" label="Explorar histórias">Perfis de alunos e ex-alunos serão preparados mediante verificação de vínculo e consentimento.</Callout>
        </>}

        {slug === "historias" && <>
          <div className="detail-intro">
            <p className="eyebrow">Acervo biográfico · fontes públicas</p>
            <h2>Histórias reais de dedicação, esporte e autonomia.</h2>
            <p>O IERC-RN faz parte de diferentes trajetórias de atletas potiguares. Esta seleção reúne pessoas com passagem pela instituição explicitamente documentada em fontes públicas. Conquistas posteriores são atribuídas a cada atleta, sem afirmar que representavam o IERC quando conquistaram suas medalhas.</p>
          </div>
          <AthleteStories />
          <Note>A pesquisa biográfica continua em desenvolvimento. Histórias de outros atletas potiguares, incluindo Rosicleide Andrade, Romário Marques e Halyson Boto, seguem em análise porque o vínculo pessoal com o IERC ainda precisa ser documentado de forma inequívoca.</Note>
        </>}

        {slug === "noticias" && <>
          <div className="detail-intro"><p className="eyebrow">Acontece e aconteceu</p><h2>Fontes confiáveis para acompanhar o IERC.</h2><p>Reunimos referências verificáveis sobre a instituição e sua participação esportiva e comunitária. O conteúdo editorial próprio será incorporado quando houver equipe autorizada e CMS.</p></div>
          <ExternalClippings />
          <Note>Não foram criadas notícias fictícias. Para comunicados atuais, consulte o <a href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">Instagram informado do IERC<span className="sr-only"> (abre em nova aba)</span></a>.</Note>
        </>}

        {slug === "eventos" && <>
          <div className="detail-intro"><p className="eyebrow">Agenda e memória</p><h2>Eventos com informação verificável.</h2><p>Enquanto a instituição não envia sua programação futura, reunimos registros históricos de competições esportivas com participação do IERC-RN.</p></div>
          <PastEvents />
          <div className="detail-card solo-card"><CalendarDays size={40} aria-hidden="true" /><h3>Próximos eventos</h3><p>A agenda ainda aguarda confirmação institucional. Não há inscrições, ingressos ou datas futuras anunciadas por este portal.</p></div>
        </>}

        {slug === "galeria" && <><div className="detail-intro"><p className="eyebrow">Acervo em organização</p><h2>Memórias para ver, ouvir e compartilhar.</h2><p>As galerias poderão reunir atividades, apresentações, competições e momentos da comunidade. Fotografias terão descrições alternativas; vídeos terão legendas e recursos adicionais conforme o conteúdo.</p></div><div className="detail-card solo-card"><h3>Imagens oficiais em preparação</h3><p>Aguardamos seleção de materiais e autorizações. Não utilizamos fotografias de terceiros como se fossem registros do IERC.</p></div></>}

        {slug === "visitas" && <>
          <div className="detail-intro"><p className="eyebrow">Conheça de perto</p><h2>Uma visita pode aproximar pessoas e ideias.</h2><p>O Instituto está localizado no bairro do Alecrim, em Natal. Informações sobre excursões escolares e em grupo, acessibilidade e condições de visita ainda serão confirmadas pela equipe.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><Users size={32} aria-hidden="true" /><h3>Para grupos e instituições</h3><p>Perfil dos grupos, horários e orientações precisam ser confirmados com a instituição.</p></article>
            <article className="detail-card"><MapPin size={32} aria-hidden="true" /><h3>Endereço documentado</h3><VerifiedAddress /><SourceLink source="tre" label="Ver referência do endereço — TRE-RN" /></article>
            <article className="detail-card"><CalendarDays size={32} aria-hidden="true" /><h3>Agendamento oficial</h3><p>O link de agendamento já utilizado pela instituição não foi fornecido. A futura integração não criará uma agenda paralela.</p></article>
          </div>
          <Note>Não há reserva ativa por este portal. Antes de visitar, confirme com o IERC as orientações e a disponibilidade da equipe.</Note>
        </>}

        {slug === "apoie" && <><div className="detail-intro"><p className="eyebrow">Solidariedade que movimenta</p><h2>Pequenos gestos também abrem caminhos.</h2><p>Há diferentes formas de participar do cotidiano do IERC-RN. Uma delas é o Bazar Solidário, uma ação arrecadatória da instituição.</p></div><div className="bazar-detail"><div><ShoppingBag size={36} aria-hidden="true"/><p className="eyebrow">Toda terça-feira</p><h2>Bazar Solidário</h2><p>Você pode doar itens para o bazar ou visitar o espaço para comprar. A arrecadação contribui com as atividades do Instituto.</p></div><div className="bazar-detail-secondary"><h3>Antes de visitar</h3><p>Horário de funcionamento, itens aceitos, local de entrega e orientações ainda serão confirmados com a equipe.</p></div></div><div className="detail-grid"><article className="detail-card"><HeartHandshake size={32} aria-hidden="true"/><h3>Doe itens</h3><p>Ajude a manter o bazar por meio de doações, seguindo os critérios que serão divulgados.</p></article><article className="detail-card"><ShoppingBag size={32} aria-hidden="true"/><h3>Compre no bazar</h3><p>Visite o espaço às terças-feiras, depois de confirmar horário e endereço com o Instituto.</p></article></div><Note>Doações financeiras e pagamentos não estão disponíveis neste protótipo. A integração será realizada apenas após definição do recebedor e das regras institucionais.</Note></>}

        {slug === "contato" && <>
          <div className="detail-intro"><p className="eyebrow">Estamos no Alecrim, Natal</p><h2>Vamos manter essa conversa aberta.</h2><p>O endereço do Instituto consta no cadastro da CBDV e em publicação do TRE-RN. Os números de telefone, CEP, e-mail e horários disponíveis em diretórios externos ainda precisam de confirmação atual pela equipe.</p></div>
          <div className="detail-grid">
            <article className="detail-card"><MapPin size={32} aria-hidden="true" /><h3>Onde fica o Instituto</h3><VerifiedAddress /><SourceLink source="tre" label="Ver endereço citado pelo TRE-RN" /></article>
            <article className="detail-card"><Instagram size={32} aria-hidden="true" /><h3>Instagram informado</h3><p><a className="inline-link" href="https://www.instagram.com/iercrn/" target="_blank" rel="noopener noreferrer">@iercrn <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only">(abre em nova aba)</span></a></p></article>
            <article className="detail-card"><Users size={32} aria-hidden="true" /><h3>Atendimento</h3><p>Contatos telefônicos publicados em fontes externas divergem. Não apresentamos telefone ou e-mail sem validação institucional.</p></article>
          </div>
          <Note>Dados de atendimento não confirmados não são exibidos como canais oficiais.</Note>
        </>}


      </div>
    </>
  );
}
