export const navigation = [
  { href: "/instituto", label: "O Instituto" },
  { href: "/atividades", label: "Atividades" },
  { href: "/esportes", label: "Esporte" },
  { href: "/historias", label: "Histórias" },
  { href: "/noticias", label: "Notícias" },
  { href: "/eventos", label: "Eventos" },
] as const;

export const activities = [
  { id: "musica", title: "Música", description: "Expressão artística, convivência e experiências musicais.", category: "Cultura" },
  { id: "informatica", title: "Informática", description: "Tecnologia e inclusão digital com foco na autonomia.", category: "Tecnologia" },
  { id: "mobilidade", title: "Orientação e mobilidade", description: "Desenvolvimento de habilidades para deslocamentos mais autônomos.", category: "Autonomia" },
  { id: "leitura", title: "Leitura cursiva", description: "Aprendizagem e desenvolvimento de habilidades de leitura.", category: "Educação" },
  { id: "braille", title: "Braille", description: "Leitura, escrita e acesso à informação pelo sistema Braille.", category: "Educação" },
  { id: "educacao-fisica", title: "Educação física", description: "Movimento, práticas corporais e participação.", category: "Esporte" },
  { id: "estimulacao", title: "Estimulação precoce", description: "Atividades de desenvolvimento e acompanhamento na infância.", category: "Desenvolvimento" },
  { id: "goalball", title: "Goalball", description: "Modalidade coletiva paralímpica, com equipes e competições.", category: "Esporte" },
] as const;

// Pautas sobre pessoas não verificadas permanecem apenas na curadoria documental.
