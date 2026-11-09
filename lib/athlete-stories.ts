/**
 * Sprint 2 — perfis editoriais de atletas e trajetórias associados ao IERC-RN.
 * Fatos e relações têm fontes explícitas. Clube da fonte é histórico, não atual.
 * Fotos remotas são prévias de homologação; autorização de publicação ainda pendente.
 * Nunca declarar vínculo de ex-aluno sem documentação específica.
 */
export type AthleteProfile = {
  id: string;
  name: string;
  discipline: string;
  relation: string;
  summary: string;
  milestones: readonly string[];
  sources: readonly { label: string; url: string }[];
  photo?: {
    src: string;
    alt: string;
    credit: string;
    publisherUrl: string;
    permission: "pending";
  };
};

export const athleteProfiles: readonly AthleteProfile[] = [
  {
    id: "thalita-simplicio",
    name: "Thalita Vitória Simplício",
    discipline: "Atletismo paralímpico · T11",
    relation: "Vínculo histórico documentado com o Instituto",
    summary: "Natalense, Thalita praticou natação, karatê e goalball antes de se destacar no atletismo. O Comitê Paralímpico Brasileiro registra que ela e Clara Daniele se conheceram no Instituto de Educação e Reabilitação de Cegos de Natal. Aos 15 anos, Thalita iniciou sua carreira no atletismo em um projeto ligado ao CPB.",
    milestones: [
      "Conquistou prata nos 400 metros T11 nos Jogos Paralímpicos de Paris 2024.",
      "Foi campeã mundial dos 400 metros T11 em Nova Déli, em 2025.",
      "Sua história no IERC é documentada como passagem pelo Instituto; não há afirmação de vínculo esportivo atual.",
    ],
    sources: [
      { label: "Biografia e medalhas — Comitê Paralímpico Brasileiro", url: "https://cpb.org.br/atletas/thalita-vitoria-simplicio-da-silva/" },
      { label: "Vínculo com o IERC — perfil de Clara Daniele no CPB", url: "https://cpb.org.br/atletas/clara-daniele-da-silva/" },
    ],
    photo: {
      src: "https://www.gov.br/secom/pt-br/acompanhe-a-secom/noticias/2024/08/brasil-brilha-em-paris-no-3o-dia-de-disputas-e-vai-ao-podio-dez-vezes-tres-delas-no-lugar-mais-alto/thalita-simplicio.jpg/@@images/5f256ce8-17de-4b9d-9be5-a12072d0e112.jpeg",
      alt: "Thalita Simplício, de uniforme amarelo e azul do Brasil, corre ao lado de seu atleta-guia na pista dos Jogos Paralímpicos de Paris 2024.",
      credit: "Foto: Alexandre Schneider/CPB, publicada pela Secom/Gov.br; autorização de reprodução no portal ainda pendente.",
      publisherUrl: "https://www.gov.br/secom/pt-br/acompanhe-a-secom/noticias/2024/08/brasil-brilha-em-paris-no-3o-dia-de-disputas-e-vai-ao-podio-dez-vezes-tres-delas-no-lugar-mais-alto",
      permission: "pending",
    },
  },
  {
    id: "clara-daniele",
    name: "Clara Daniele Barros da Silva",
    discipline: "Atletismo paralímpico · T12",
    relation: "Conheceu Thalita Simplício no IERC",
    summary: "O perfil oficial de Clara no CPB registra que ela e Thalita Simplício se conheceram no IERC, onde praticavam karatê. Clara passou pelo goalball, praticado por sete anos em outra associação da cidade, e ingressou no atletismo em 2019.",
    milestones: [
      "Representou o Brasil nos Jogos Paralímpicos de Paris 2024.",
      "Conquistou ouro nos 200 metros T12 no Mundial de Atletismo Paralímpico de Nova Déli 2025.",
      "A passagem pelo IERC é documentada; o instituto não é apresentado como clube atual da atleta.",
    ],
    sources: [
      { label: "Biografia oficial — Comitê Paralímpico Brasileiro", url: "https://cpb.org.br/atletas/clara-daniele-da-silva/" },
      { label: "Ouro mundial de 2025 — ge/RN", url: "https://ge.globo.com/rn/noticia/2025/10/05/potiguar-clara-daniele-e-campea-mundial-apos-punicao-de-venezuelana.ghtml" },
    ],
    photo: {
      src: "https://s2-ge.glbimg.com/hLOAtcI8UgV58oZlSBJi4fNewQA%3D/0x0%3A3200x2134/984x0/smart/filters%3Astrip_icc%28%29/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2025/f/e/yNz89FSzaROAjVN39QJg/cm-2210.jpg",
      alt: "Clara Daniele Barros da Silva corre sobre a pista azul acompanhada por seu atleta-guia durante o Mundial de Atletismo Paralímpico de 2025.",
      credit: "Fotografia publicada pelo ge/RN; direitos de reprodução ainda não liberados.",
      publisherUrl: "https://ge.globo.com/rn/noticia/2025/10/05/potiguar-clara-daniele-e-campea-mundial-apos-punicao-de-venezuelana.ghtml",
      permission: "pending",
    },
  },
  {
    id: "sharlley-anthony",
    name: "Sharlley Anthony do Nascimento Silva",
    discipline: "Goalball · ala/pivô",
    relation: "Conheceu o goalball no IERC em 2018",
    summary: "Segundo o CPB, Sharlley conheceu o goalball em 2018 no Instituto de Educação e Reabilitação de Cegos do RN. A modalidade tornou-se parte central de sua trajetória esportiva, que o levou às convocações da seleção brasileira.",
    milestones: [
      "Foi convocado para período de treinamentos da seleção brasileira em março de 2026.",
      "Em junho de 2026, integrou a seleção masculina que conquistou bronze no Mundial de Goalball na China, segundo o SESI-SP.",
      "A ligação documentada com o IERC refere-se ao início da trajetória no esporte, não ao clube representado em 2026.",
    ],
    sources: [
      { label: "Início no IERC — Comitê Paralímpico Brasileiro", url: "https://cpb.org.br/noticias/jovens-do-goalball-buscam-primeira-chance-em-mundial-da-modalidade/" },
      { label: "Bronze mundial de 2026 — SESI-SP", url: "https://mogidascruzes.sesisp.org.br/noticia/atletas-do-sesi-sp-conquistam-medalha-de-bronze-com-a-selecao-brasileira-no-mundial-de-goalball" },
    ],
    photo: {
      src: "https://cronos-media.sesisenaisp.org.br/api/media/1-0/files?img=img_10_260618_9ab09107-d38a-4e6c-8d4f-ef3643a825b0_o.jpeg&tipo=p",
      alt: "Os atletas de goalball Parazinho e Sharlley Anthony posam lado a lado com medalhas, troféu e mascotes após o Mundial de 2026.",
      credit: "Foto de divulgação publicada pelo SESI-SP; uso no portal sujeito à autorização.",
      publisherUrl: "https://mogidascruzes.sesisp.org.br/noticia/atletas-do-sesi-sp-conquistam-medalha-de-bronze-com-a-selecao-brasileira-no-mundial-de-goalball",
      permission: "pending",
    },
  },
  {
    id: "geovana-moura",
    name: "Geovana Clara Costa de Moura",
    discipline: "Goalball · ala",
    relation: "Relacionada ao IERC em convocação de 2016",
    summary: "Geovana iniciou no goalball em 2013 e recebeu sua primeira convocação para a seleção adulta em 2016. Uma publicação do CPB daquele ano a identifica como atleta do IERC-RN. Posteriormente, representou outras associações e participou dos Jogos Paralímpicos de Paris 2024.",
    milestones: [
      "Foi listada como atleta do IERC-RN em convocação divulgada pelo CPB em 2016.",
      "Conquistou bronze no Mundial de Goalball de Jovens de 2017, segundo o CPB.",
      "Passou a integrar o SESI-SP em 2025; portanto, não é apresentada como atleta atual do IERC.",
    ],
    sources: [
      { label: "Convocação de 2016 — CPB (IERC-RN)", url: "https://cpb.org.br/noticias/cbdv-divulga-convocacao-da-selecao-brasileira-feminina-de-goalball-para-a-i-fase-de-treinamento-do-ano/" },
      { label: "Perfil paralímpico — ge/RN", url: "https://ge.globo.com/rn/paralimpiadas/noticia/2024/08/16/veja-perfil-dos-potiguares-que-estarao-nos-jogos-paralimpicos-de-paris-2024.ghtml" },
      { label: "Contratação divulgada em 2025 — SESI-SP", url: "https://mogidascruzes.sesisp.org.br/noticia/conheca-as-novas-contratacoes-das-equipes-feminina-e-masculina-do-sesi-sp-e-o-impacto-do-programa-paralimpico" },
    ],
    photo: {
      src: "https://cronos-media.sesisenaisp.org.br/api/media/1-0/files?img=img_64_250317_4a559c65-bf72-4190-ab16-26f963a31c73_o.jpg&tipo=p",
      alt: "Geovana Moura, de uniforme vermelho e preto do SESI-SP, posa sentada na quadra com uma bola azul de goalball à sua frente.",
      credit: "Foto publicada pelo SESI-SP em 2025; reprodução pendente de autorização.",
      publisherUrl: "https://mogidascruzes.sesisp.org.br/noticia/conheca-as-novas-contratacoes-das-equipes-feminina-e-masculina-do-sesi-sp-e-o-impacto-do-programa-paralimpico",
      permission: "pending",
    },
  },
  {
    id: "maria-clara-nascimento",
    name: "Maria Clara Nascimento",
    discipline: "Goalball · IERC-RN",
    relation: "Atleta entrevistada no IERC em julho de 2026",
    summary: "Em reportagem publicada em julho de 2026, Maria Clara contou como o goalball no IERC ajudou a aprimorar sua atenção aos sons e suas experiências de deslocamento independente. Sua trajetória também inclui graduação em Física concluída e estudos de Letras iniciados em 2024, conforme a entrevista.",
    milestones: [
      "A reportagem de julho de 2026 situa sua prática de goalball no IERC-RN.",
      "O esporte e a formação universitária aparecem na matéria como dimensões de sua trajetória de autonomia.",
      "Uma foto individual identificada e autorização de uso ainda precisam ser obtidas.",
    ],
    sources: [
      { label: "Entrevista com Maria Clara — Tribuna do Norte, julho de 2026", url: "https://tribunadonorte.com.br/rio-grande-do-norte/cegos-transformam-desafios-e-conquistam-mais-autonomia/" },
    ],
  },
  {
    id: "amanda-emilly-santana",
    name: "Amanda Emilly Fernandes de Santana",
    discipline: "Goalball · seleção feminina",
    relation: "Atleta do IERC-RN em convocações de 2017 e 2018",
    summary: "Amanda Emilly representava o IERC-RN nas convocações de goalball divulgadas pelo Comitê Paralímpico Brasileiro em 2017 e 2018. A TV Brasil relata que ela integrou a Seleção Brasileira a partir de 2017, conquistou o título dos Jogos Parapan-Americanos de Jovens naquele ano e, posteriormente, se transferiu de Natal para defender o Santos.",
    milestones: [
      "Em 2017, foi convocada à Seleção Brasileira de jovens representando o IERC-RN, segundo o CPB.",
      "Foi campeã dos Jogos Parapan-Americanos de Jovens de São Paulo em 2017, de acordo com a TV Brasil.",
      "Em 2018, ainda apareceu vinculada ao IERC-RN em uma convocação; em reportagem de 2023, já defendia o Santos-SP.",
    ],
    sources: [
      { label: "Convocação de 2017 — CPB (IERC-RN)", url: "https://cpb.org.br/noticias/tecnicos-convocam-atletas-para-o-mundial-de-jovens-de-goalball/" },
      { label: "Convocação de 2018 — CPB (IERC-RN)", url: "https://cpb.org.br/noticias/selecoes-brasileiras-conhecem-grupos-do-mundial-de-goalball-da-suecia/" },
      { label: "Trajetória e Parapan de Jovens — TV Brasil, 2023", url: "https://tvbrasil.ebc.com.br/stadium/2023/04/amanda-emilly-e-uma-das-novatas-na-selecao-de-goalball?page=7" },
    ],
  },
  {
    id: "israele-leticia",
    name: "Israele Letícia Pereira Gomes",
    discipline: "Goalball · ala",
    relation: "Atleta do IERC-RN em convocação da CBDV de 2019",
    summary: "Em novembro de 2019, a Confederação Brasileira de Desportos de Deficientes Visuais relacionou Israele como ala da Seleção Brasileira feminina, identificando o IERC-RN como sua equipe. Sua trajetória continuou em outras associações: em 2024, a CBDV registrou a AMC-MT, e em convocação de 2025 o CPB apresentou o Instituto Athlon-SP.",
    milestones: [
      "Foi convocada para a fase de treinamentos da Seleção Brasileira de dezembro de 2019, representando o IERC-RN.",
      "Na preparação de 2024, a CBDV a identificou como atleta da AMC-MT.",
      "Em convocação divulgada em 2025, o CPB registrou sua representação pelo Instituto Athlon-SP; não se afirma vínculo atual com o IERC.",
    ],
    sources: [
      { label: "Convocação de 2019 — CBDV (IERC-RN)", url: "https://www.cbdv.org.br/imprensa/noticias/convocadas-as-selecoes-da-cbdv-para-ultima-fase-de-treinamentos" },
      { label: "Convocação de 2024 — CBDV (AMC-MT)", url: "https://www.cbdv.org.br/imprensa/noticias/com-objetivos-diferentes-selecoes-de-goalball-do-brasil-voltam-aos-trabalhos" },
      { label: "Convocação de 2025 — CPB (Instituto Athlon)", url: "https://cpb.org.br/noticias/confira-a-primeira-convocacao-do-ano-das-selecoes-de-futebol-de-cegos-e-goalball/" },
    ],
  },
  {
    id: "luciana-ferreira",
    name: "Luciana Ferreira da Silva",
    discipline: "Goalball · pivô em 2019",
    relation: "Atleta do IERC-RN em registros de 2019, 2022 e 2026",
    summary: "Luciana aparece como pivô vinculada ao IERC-RN em uma convocação para a Seleção Brasileira de goalball em novembro de 2019. A CBDV também a identifica nas equipes femininas do Instituto no Regional Nordeste de 2022 e novamente em abril de 2026. São registros de temporadas específicas, sem presumir vínculo ininterrupto.",
    milestones: [
      "Foi convocada como pivô da Seleção Brasileira para treinamentos em dezembro de 2019, segundo a CBDV.",
      "Integrou a equipe feminina do IERC-RN listada para o Regional Nordeste de Goalball de 2022.",
      "Voltou a figurar na relação feminina do IERC-RN no Regional Nordeste de abril de 2026.",
    ],
    sources: [
      { label: "Seleção de 2019 — CBDV (IERC-RN)", url: "https://www.cbdv.org.br/imprensa/noticias/convocadas-as-selecoes-da-cbdv-para-ultima-fase-de-treinamentos" },
      { label: "Regional Nordeste de 2022 — CBDV", url: "https://www.cbdv.org.br/imprensa/noticias/apace-e-adevirn-colocam-titulos-a-prova-no-regional-de-goalball" },
      { label: "Regional Nordeste de 2026 — CBDV", url: "https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande" },
    ],
  },
  {
    id: "lucas-araken",
    name: "Lucas Araken Silva de Araújo",
    discipline: "Goalball · seleção de base",
    relation: "Conheceu o goalball no IERC aos 11 anos; atleta do IERC em 2019",
    summary: "Em entrevista publicada pelo CPB em março de 2023, Lucas Araken relatou que conheceu o goalball aos 11 anos no Instituto de Cegos do Rio Grande do Norte. O Comitê também o relacionou como atleta do IERC-RN entre os convocados ao Mundial de Jovens de 2019, na Austrália. Em 2023, já treinava em Brasília e aparecia vinculado ao Capital/Cetefe-DF.",
    milestones: [
      "Começou no goalball aos 11 anos no IERC-RN, segundo perfil publicado pelo CPB em 2023.",
      "Foi convocado ao Mundial de Jovens de Goalball de 2019 representando o IERC-RN.",
      "Em 2023, participou de treinamentos da Seleção Brasileira de base como atleta do Capital/Cetefe-DF.",
    ],
    sources: [
      { label: "Primeiro contato com goalball no IERC — CPB, 2023", url: "https://cpb.org.br/noticias/sete-alunos-dos-centros-de-referencia-do-cpb-integram-selecoes-de-base-do-goalball/" },
      { label: "Mundial de Jovens de 2019 — CPB (IERC-RN)", url: "https://cpb.org.br/noticias/lista-de-convocados-para-mundial-de-jovens-de-goalball-da-ibsa-e-divulgada/" },
    ],
  },
] as const;
