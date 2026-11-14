/** Registros verificados da Sprint 2. Nunca confundir documentação histórica com dados atuais. */
export const sources = {
  history: { label: "Histórico e apresentação — IERC, 2010", publisher: "IERC-RN", url: "https://iercrn.blogspot.com/2010/11/o-instituto-de-educacao-e-reabilitacao.html" },

  academiaHistory: { label: "Vieira e Carvalho Filho — inclusão e sociabilidade no IERC-RN (2024)", publisher: "UFERSA", url: "https://repositorio.ufersa.edu.br/bitstreams/b501758f-e9f5-42f1-aa60-32695df02585/download" },
  brailleNortheast: { label: "Duzentos anos do Sistema Braille — RN, p. 34", publisher: "UEPB, 2025", url: "https://eduepb.uepb.edu.br/download/duzentos-anos-do-sistema-braille-no-brasil-um-passeio-pela-regiao-nordeste/?masterkey=nfWAf0EuRYvJQQS8Q7i5lWXVp-lxXnFQINooHsses6WwiGpXxIrCEM4-7QFtppMkLwinQeVswbdEQoLNYn8N5LMY3bS3HOQ-008IYqGoxmE&wpdmdl=5327" },
  libraryResearch2008: { label: "Estudo acadêmico sobre estrutura e trabalho do Instituto", publisher: "Revista da Unicamp, 2008", url: "https://periodicos.sbu.unicamp.br/ojs/index.php/rdbci/article/download/2013/2134/2668" },
  press2018: { label: "Instituto dos Cegos: 66 anos na busca pela inserção social", publisher: "Tribuna do Norte, 2018", url: "https://tribunadonorte.com.br/natal/instituto-dos-cegos-66-anos-na-busca-pela-insercao-social/" },
  campaign2019: { label: "Laboratório de informática — missão divulgada na campanha de 2019", publisher: "Campanha Vakinha, 2019", url: "https://www.vakinha.com.br/vaquinha/laboratorio-de-informatica-do-ierc-rn" },
  paradesporto2026: { label: "Resultado final do chamamento público nº 01/2026, p. 12", publisher: "Diário Oficial de Natal, 04/11/2026", url: "https://www2.natal.rn.gov.br/_anexos/publicacao/dom/dom_20261104_245d5d92f97e72a9ae30add96c9f3d3f.pdf" },
  registry: { label: "Entidades cadastradas no RN", publisher: "CBDV", url: "https://www.cbdv.org.br/cbdv/entidades/entidades-cadastradas/rio-grande-do-norte" },
  regional: { label: "Regional Nordeste de Goalball, abril de 2026", publisher: "CBDV", url: "https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande" },
  serieA: { label: "Campeonato Brasileiro de Goalball — Série A 2026", publisher: "CBDV", url: "https://www.cbdv.org.br/serie-a-do-campeonato-brasileiro-de-goalball-2026-agita-sao-paulo-na-proxima-quinta-27" },
  tre: { label: "Todo Voto Importa — anúncio de 2025", publisher: "TRE-RN", url: "https://www.tre-rn.jus.br/comunicacao/noticias/2025/Setembro/tre-rn-realizara-acao-do-projeto-201ctodo-voto-importa201d-em-parceria-com-o-instituto-dos-cegos-do-rn" },
  bnewsParadesporto2026: { label: "Seleção de entidades para paradesporto — novembro de 2026", publisher: "BNews RN", url: "https://www.bnewsrn.com.br/noticias/esportes/prefeitura-de-natal-seleciona-duas-entidades-para-fortalecer-o-paradesporto.html" },
  cpbGoalball2026: { label: "Atleta potiguar e sua formação no IERC — março de 2026", publisher: "Comitê Paralímpico Brasileiro", url: "https://cpb.org.br/noticias/jovens-do-goalball-buscam-primeira-chance-em-mundial-da-modalidade/" },
  tribunaAutonomia2026: { label: "Autonomia e esporte no IERC — julho de 2026", publisher: "Tribuna do Norte", url: "https://tribunadonorte.com.br/rio-grande-do-norte/cegos-transformam-desafios-e-conquistam-mais-autonomia/" },
} as const;
export type SourceId = keyof typeof sources;
export const verifiedAddress = "Rua Fonseca e Silva, 1113 — Alecrim, Natal/RN";
export const timeline: { year: string; date: string; title: string; text: string; source: SourceId }[] = [
  {
    year: "1952", date: "1952-07-16", title: "Fundação em Natal",
    text: "Em 16 de julho, nasce a instituição que deu origem ao IERC-RN. O registro histórico do próprio Instituto atribui sua fundação ao médico Ricardo César Paes Barreto.",
    source: "history",
  },
  {
    year: "1970–79", date: "1970", title: "A educação ganha espaço",
    text: "Formação de profissionais especializados, inclusive em Recife, e colaboração pública impulsionam o ensino das pessoas cegas no Rio Grande do Norte. Trata-se de uma transformação gradual, sem data única de início.",
    source: "brailleNortheast",
  },
  {
    year: "1978", date: "1978", title: "Reconhecimento de utilidade pública municipal",
    text: "O estudo histórico de Vieira e Carvalho Filho registra o reconhecimento de utilidade pública municipal em 1978, a partir de documentos consultados no acervo do IERC-RN.",
    source: "academiaHistory",
  },
  {
    year: "1979", date: "1979", title: "Reconhecimento de utilidade pública estadual",
    text: "A mesma pesquisa identifica o reconhecimento de utilidade pública estadual em 1979, destacando a importância social reconhecida à instituição naquela época.",
    source: "academiaHistory",
  },
  {
    year: "1980–89", date: "1980", title: "Reorganização e foco na reabilitação",
    text: "Relato histórico sobre o Braille no RN descreve a transição da antiga instituição assistencial para o IERC, com maior atenção à escolarização, à reabilitação e às oportunidades de vida independente.",
    source: "brailleNortheast",
  },
  {
    year: "1982", date: "1982", title: "Uma nova sede no Alecrim",
    text: "Pesquisa da UFERSA registra a transferência para a área do atual prédio em 1982 e a construção de sua primeira etapa. A data provém de depoimento histórico e deve ser validada no arquivo institucional.",
    source: "academiaHistory",
  },
  {
    year: "2002", date: "2002", title: "Novos horizontes de formação",
    text: "Um registro sobre a história do Braille no estado destaca o ingresso de pessoas cegas do RN no ensino superior a partir de 2002. Esse marco é do contexto educacional potiguar, não uma contagem de egressos do IERC.",
    source: "brailleNortheast",
  },
  {
    year: "2003", date: "2003-03-26", title: "Registro de estatuto institucional",
    text: "Segundo a pesquisa da UFERSA, o estatuto registrado em 26 de março de 2003 previa educação, formação, habilitação, reabilitação, integração social e qualificação profissional. Sua vigência atual precisa ser confirmada com a diretoria.",
    source: "academiaHistory",
  },
  {
    year: "2008", date: "2008", title: "O trabalho do IERC na pesquisa acadêmica",
    text: "Artigo da Revista Digital de Biblioteconomia e Ciência da Informação documenta a finalidade, a estrutura e as atividades do Instituto à época, ampliando o registro público de sua atuação.",
    source: "libraryResearch2008",
  },
  {
    year: "2018", date: "2018-07-26", title: "66 anos de educação e inclusão",
    text: "Reportagem da Tribuna do Norte revisita a trajetória do IERC em seu aniversário de 66 anos e apresenta o trabalho com crianças, jovens, adultos, pessoas idosas e suas famílias.",
    source: "press2018",
  },
  {
    year: "2019", date: "2019-09-17", title: "Mobilização por informática acessível",
    text: "Campanha pública organizada em apoio ao laboratório de informática registra a busca de recursos para fortalecer oportunidades de aprendizagem digital. A campanha não comprova, por si, aquisição ou entrega dos equipamentos.",
    source: "campaign2019",
  },
  {
    year: "2024", date: "2024", title: "Memórias e práticas documentadas em pesquisa",
    text: "Visitas, documentos, fotografias e entrevistas reunidos por Arthur Cassio de Oliveira Vieira e Evanilson Gurgel de Carvalho Filho documentam práticas de Braille, estimulação precoce e convivência no IERC, como retrato do período pesquisado.",
    source: "academiaHistory",
  },
  {
    year: "2025", date: "2025-09-16", title: "Cidadania e acesso ao voto",
    text: "O TRE-RN anuncia ação de atendimento eleitoral acessível em parceria com o Instituto, prevista para setembro de 2025. A publicação é um anúncio, não um balanço de execução.",
    source: "tre",
  },
  {
    year: "2026", date: "2026-04-15", title: "Goalball regional",
    text: "A CBDV relaciona representantes masculinos e femininos do IERC-RN no Regional Nordeste de Goalball de 2026, disputado em Campina Grande (PB).",
    source: "regional",
  },
  {
    year: "2026", date: "2026-08-18", title: "Presença feminina na Série A",
    text: "A CBDV relaciona a equipe feminina do IERC-RN à Série A do Campeonato Brasileiro de Goalball de 2026. Os elencos citados correspondem à temporada documentada.",
    source: "serieA",
  },
  {
    year: "2026", date: "2026-11-04", title: "Seleção municipal no paradesporto",
    text: "O Diário Oficial de Natal homologa o resultado que seleciona o IERC-RN na categoria C do Chamamento Público nº 01/2026. A seleção não comprova celebração de parceria ou repasse de recursos.",
    source: "paradesporto2026",
  },
];
export const clippings: { date: string; dateTime: string; title: string; summary: string; category: string; source: SourceId }[] = [
  { date: "5 nov. 2026", dateTime: "2026-11-05", category: "Paradesporto · notícia externa", title: "IERC-RN é citado em seleção de entidades para incentivo ao paradesporto de Natal", summary: "Reportagem do BNews RN informa que o IERC/RN foi selecionado na categoria C do Chamamento Público nº 01/2026. A notícia não equivale a comprovação de repasse de recursos ou de execução do projeto.", source: "bnewsParadesporto2026" },
  { date: "18 jul. 2026", dateTime: "2026-07-18", category: "Autonomia · reportagem externa", title: "Tribuna do Norte destaca autonomia e inclusão no IERC-RN", summary: "Reportagem apresenta experiências de pessoas com deficiência visual, destacando práticas de goalball, aprendizagem e participação vinculadas ao Instituto.", source: "tribunaAutonomia2026" },
  { date: "27 mar. 2026", dateTime: "2026-03-27", category: "Goalball · reportagem externa", title: "CPB relata trajetória de atleta potiguar que conheceu o goalball no IERC-RN", summary: "O Comitê Paralímpico Brasileiro registra que Sharlley Anthony iniciou sua trajetória na modalidade ao conhecer o goalball no Instituto, em Natal.", source: "cpbGoalball2026" },
  { date: "18 ago. 2026", dateTime: "2026-08-18", category: "Esporte", title: "CBDV divulga participantes da Série A", summary: "A publicação do campeonato nacional inclui o IERC-RN entre as equipes femininas participantes da edição de 2026.", source: "serieA" },
  { date: "15 abr. 2026", dateTime: "2026-04-15", category: "Esporte", title: "IERC-RN no Regional Nordeste de Goalball", summary: "Na divulgação do torneio, a CBDV relacionou representantes femininos e masculinos do Instituto.", source: "regional" },
  { date: "16 set. 2025", dateTime: "2025-09-16", category: "Cidadania", title: "TRE-RN anuncia parceria para ação eleitoral", summary: "O tribunal divulgou a previsão de atendimentos acessíveis na sede do IERC-RN em setembro de 2025.", source: "tre" },
];
export const pastEvents: { date: string; dateTime: string; title: string; location: string; summary: string; source: SourceId }[] = [
  { date: "26 abr. a 2 maio 2026", dateTime: "2026-04-26", title: "Regional Nordeste de Goalball", location: "Campina Grande, Paraíba", summary: "A CBDV incluiu as equipes masculina e feminina do IERC na lista de participantes de 2026.", source: "regional" },
  { date: "27 ago. a 2 set. 2026", dateTime: "2026-08-27", title: "Campeonato Brasileiro de Goalball — Série A", location: "São Paulo, SP", summary: "A equipe feminina do Instituto esteve entre as participantes relacionadas pela CBDV para a temporada de 2026.", source: "serieA" },
];
export const serieAFeminina2026 = {
  coach: "Ana Cláudia Alves de Souza Santos",
  athletes: ["Luciana Ferreira da Silva", "Nagila Hellen Pereira da Silva", "Maria Clara Diniz do Nascimento", "Luana Madalena Leocadio Fraga", "Raquel Oliveira Lima", "Natieli Carolina Ferreira"],
} as const;
