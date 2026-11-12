/** Registros verificados da Sprint 2. Nunca confundir documentação histórica com dados atuais. */
export const sources = {
  history: { label: "Histórico e apresentação — IERC, 2010", publisher: "IERC-RN", url: "https://iercrn.blogspot.com/2010/11/o-instituto-de-educacao-e-reabilitacao.html" },
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
  { year: "1952", date: "1952-07-16", title: "Fundação do Instituto", text: "O histórico do próprio IERC registra a fundação em 16 de julho de 1952, por Ricardo César Paes Barreto. A data também consta no cadastro da CBDV.", source: "history" },
  { year: "2025", date: "2025-09-16", title: "Participação cidadã", text: "O TRE-RN anunciou parceria para uma ação de atendimento eleitoral acessível na sede do Instituto, prevista para setembro de 2025. Trata-se do anúncio oficial, não de um balanço de execução.", source: "tre" },
  { year: "2026", date: "2026-04-15", title: "Goalball no Regional Nordeste", text: "A CBDV relacionou equipes masculina e feminina do IERC-RN na competição regional de 2026, em Campina Grande.", source: "regional" },
  { year: "2026", date: "2026-08-18", title: "Equipe feminina na Série A", text: "A CBDV listou o IERC-RN entre as equipes da chave feminina do Campeonato Brasileiro de Goalball de 2026.", source: "serieA" },
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
