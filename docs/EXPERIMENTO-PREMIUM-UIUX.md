# Laboratório de direção visual — editorial tátil

Base auditada antes de qualquer alteração de código: `984e1df6c6fd33cb64a8e6d12a85884dde2c05b8` (DEV e MAIN). Este experimento não é aprovação institucional nem release. Nenhum CMS, dado, integração financeira, licença, token, infraestrutura ou política de publicação deve mudar.

## Inventário e diagnóstico pré-implementação

Análise estática dos templates e componentes do repositório, não inspeção visual independente em navegador de todas as rotas com conteúdo real do CMS. A homepage também foi avaliada a partir das capturas previamente fornecidas pelo operador.

| Rota | Composição existente / diagnóstico | Direção experimental |
| --- | --- | --- |
| / | Hero ilustrado; essência, oito atividades, goalball, histórias, bazar/visitas, notícias e rodapé; muitas superfícies de mesmo peso | Hierarquia editorial, ritmo de capítulos, cartões de atividades assimétricos, textura tátil, duas cenas com movimento seletivo |
| /instituto | História longa, missão/finalidade, eixos, marcos e referências | Linha do tempo editorial, datas fortes, legibilidade e fontes preservadas |
| /atividades | Oito cartões com âncoras e contato | Grade numerada, hierarquia tipográfica e leitura rápida |
| /esportes | Goalball, competições manuais e calendário CBDV, registros históricos | Identidade esportiva no cabeçalho, calendário estável, sem motion em dados |
| /historias | Nove perfis, fotos externas condicionadas a direitos, fontes e perfis CMS | Ritmo de retratos/texto, crédito intacto, sem substituir ausência de fotos por retratos fictícios |
| /noticias | Comunicados, imprensa, registros históricos, CTA Radar | Hierarquia de publicação e fontes, sem animar textos/listas |
| /eventos | Agenda, registros e artes sem corte | Superfícies calmas, preservar object-fit contain e datas |
| /galeria | Estado de acervo em preparação | Estado vazio intencional; nenhuma mídia inventada |
| /visitas | Três orientações, Google Forms oficial e mapa sob consentimento | CTA claramente dominante, leitura/privacidade estáveis |
| /apoie | Bazar, Pix avulso e seletor de doações recorrentes, condicionado à autorização | Acabamento em controles e grupos, manter estados disabled e regras financeiras |
| /contato | Endereço, WhatsApp, e-mail e mapa sob consentimento | Informação direta, alvos claros, sem movimento funcional |
| /radar-da-inclusao | Notícias externas agrupadas, divulgação de IA/fontes, metodologia | Aparência editorial distinta de notícias institucionais, dados estáveis |
| /noticias/[slug] | Artigo dinâmico, atribuição, retorno contextual, fonte | Coluna de leitura, hierarquia e links com sublinhado |
| 404 | Mensagem e retorno ao início | Estado vazio coerente com o sistema visual |

Componentes comuns auditados: layout, header sticky e menu com foco/Escape, footer, PageHero, painel de acessibilidade (largeText, highContrast, reduceMotion, smoothScroll), HeroArt, GoalballScene, MotionEnhancements (GSAP/ScrollTrigger + Lenis opt-in), InstitutionStory, SupportPage, RecurringDonations, LocationMap, AthleteStories, SportCompetitions, CmsPublic, EditorialRecords. CSS tem camadas incrementais e overrides responsivos. Preservar testes existentes, markup semântico, ordem de leitura, links, foco, redução de movimento, alto contraste, zoom e o encaixe inferior do hero móvel.

## Referências consultadas

Repositório [emilkowalski/skills](https://github.com/emilkowalski/skills): [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md), [find-animation-opportunities](https://github.com/emilkowalski/skills/blob/main/skills/find-animation-opportunities/SKILL.md), [choreograph](https://github.com/emilkowalski/skills/blob/main/skills/choreograph/SKILL.md), [animation-performance](https://github.com/emilkowalski/skills/blob/main/skills/animation-performance/SKILL.md), [remove-animations](https://github.com/emilkowalski/skills/blob/main/skills/remove-animations/SKILL.md), [review standards](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md). Aplicar princípios, não instalar scripts nem copiar componentes externos.

| Antes | Depois | Motivo |
| --- | --- | --- |
| Hero flutua continuamente | Ilustração estável; uma entrada de decoração curta | Encanto inicial sem movimento contínuo nem perder encaixe |
| Botões levantam com sombra | Press scale .97 / 160ms; hover cor | Feedback rápido; sem deslocamento de layout |
| Links aumentam gap | Ícone move até 3px / 160ms sem alterar layout | Microinteração interrompível |
| Cards sobem 5px | Borda e cor 150ms, sem lift | Não distrair durante navegação |
| Quique do goalball com eco e pausa fora da tela | Preservar explicação visual existente | Motion com significado; sem áudio |
| Painéis, teclado, conteúdo editorial | Sem novas animações | Respeitar rapidez, foco e leitura |

Curvas de referência: ease-out cubic-bezier(0.23,1,0.32,1); ease-in-out cubic-bezier(0.77,0,0.175,1). UI 100–160ms; uma entrada decorativa de até 650ms, sem ocultar texto, preferir transform/opacity e CSS. Sem reveals em todas as seções, scroll hijacking, cursor customizado, loading artificial, parallax em conteúdo, animação de números fictícios ou transições de rota.

## Critérios de validação

- Experimento isolado, sem merge automático e sem deploy nos ambientes existentes.
- Manter suite original, acrescentar smoke de todas as rotas, reflow 320px, reduced motion (sistema e painel), contraste, foco e capturas desktop/mobile.
- Verificar pessoalmente aparência com CMS real, leitores de tela, zoom e pessoas usuárias antes de qualquer proposta de merge.
- Não declarar avaliação Awwwards, conformidade WCAG completa, performance medida ou homologação humana com base apenas em CSS e CI.

## Iteração 02 — transformação estrutural

A primeira iteração foi avaliada pelo operador como visualmente discreta, apesar da importação CSS confirmada no navegador e da CI aprovada. Esta segunda iteração substitui padrões repetitivos, em vez de acrescentar somente uma camada cosmética.

- Capa editorial: título em dois planos, imagem institucional existente, luz cromática e relevo abstrato.
- Índice de capítulos navegável por âncoras, manifesto histórico de 1952, catálogo numerado de atividades (preserva links e ordem DOM), painel de trajetórias com arte vetorial original e acesso direto ao Radar.
- Cinco famílias de grafismos abstratos — patrimônio, órbita, grade, sinal e conexão — nos cabeçalhos internos. Não representam Braille nem fotografias do instituto.
- Uma entrada decorativa por elemento em viewport, com IntersectionObserver, CSS transform/opacity (1,05 s), sem esconder texto ou conteúdo com JS desligado, sem repetir ao rolar. Preferências local/sistema cancelam o movimento; alto contraste suprime grafismos. Capa tem entrada finita de opacidade (900 ms); cena explicativa goalball preservada.
- Marcador verificável `data-ui-experiment="editorial-v2"` no HTML; sem alterações de infraestrutura, tokens, CMS, fontes de dados ou dependências.
- Validar desktop, mobile, largura 320 px, axe, preferências e revisão humana de aparência. Não há merge nem deploy.

## Iteração 03 — Discovery / caminhos que se abrem

O operador considerou V2 ainda distante da referência Awwwards. Referência específica: [Where Opportunity Takes Root](https://opportunity.waltonfamilyfoundation.org/) e [case Gladeye](https://www.gladeye.com/work/where-opportunity-takes-root): descoberta progressiva e narrativa em vez de grade de componentes. A leitura do site e dos dados de branding evidenciou título de escala monumental, serifas e composição editorial; a captura remota foi solicitada, mas não pôde ser inspecionada visualmente nesta sessão. Não foram copiados código, imagens, fontes proprietárias ou identidade da referência.

Referências adicionais consultadas: [Transitions.dev Skill](https://transitions.dev/skill.html) (curvas e feedback), [Taste Skill docs](https://www.tasteskill.dev/docs) (inventário, direção, composição e gate visual), [React Bits](https://reactbits.dev/) (componentes de animação como fonte), [reanimate](https://reanimate.niazmorshed.dev/) (registro/comparação de motion), [Emil Kowalski](https://github.com/emilkowalski/skills) (contenção e desempenho). Aplicação de princípios; não foi executada a CLI de instalação nem o loop de comparação quadro a quadro. Mantemos GSAP/ScrollTrigger já presentes no lockfile; nenhuma nova dependência paga.

Decisão de arte: capa clara em papel, título serifado monumental em largura total, texto/ações separados da cena azul com ilustração existente e caminhos vetoriais originais. A rolagem move somente duas camadas decorativas (sem pinning, sem scroll hijack, sem esconder texto). Com movimento reduzido ou alto contraste, GSAP reverte e fica estático. Mobile permanece estático e preserva a borda inferior. Capítulo histórico usa painel dourado/azul; catálogo de atividades passa a índice editorial em uma coluna; esporte e participação têm composições independentes. Páginas internas recebem capas claras com espécime gráfico por assunto. A tipografia de display usa Georgia do sistema, sem downloads/fontes externas. O acervo local tem apenas arte tátil/goalball e logo; não inventar fotos de estudantes. Fotografias reais com autorização são a maior lacuna de direção de arte.

Testes: contrato de capa atualiza a proporção deliberadamente alterada, mantém reflow/legibilidade/borda móvel; novo teste verifica mudança real de transform ao rolar e retorno ao estado estático. Capturas da suite Playwright não equivalem a revisão humana. V3 é um protótipo isolado, sem merge ou deploy.

## Iteração 04 — Além do olhar

Revisão do conceito após feedback do operador: reconstrução da homepage em vez de ajustar a V3. Cinco atos, capa fotográfica em três camadas, manifesto de autonomia, história, atividades com fotografia lateral, esporte com imagem documental e demonstração de goalball, participação e navegação editorial. Páginas internas mantidas na versão experimental anterior até aceite da homepage.

O operador autorizou fotos temporárias gratuitas. As cinco fontes e licenças foram verificadas nas respectivas páginas Wikimedia Commons, descritas em `data/beyond-photos.json` e creditadas no rodapé da homepage. Imagens de terceiros não representam o IERC-RN; a licença autoral não substitui uma eventual autorização de uso de imagem para campanhas institucionais. Substituir por acervo autorizado antes de merge.

**Preparação explícita:** `node scripts/fetch-beyond-photos.mjs` baixa apenas os cinco JPEGs definidos, em diretório local ignorado pelo Git, com timeout, limite de tamanho, origem HTTPS e validação JPEG. Não há hotlink nem download em runtime ou no CI. Se não existirem, a página mostra grafismos de fallback e um aviso. O script não foi executado nesta sessão porque o ambiente não conseguiu baixar os binários. Confirmar 5/5 no Windows antes da avaliação visual.

GSAP/ScrollTrigger existentes movimentam três camadas fotográficas em desktop, sem pin, sem bloquear rolagem, sem esconder conteúdo; media queries e preferências restauram o estado estático. Fotografias e conteúdo essenciais não dependem de animação. Mobile estático. Nenhuma nova dependência, mudança de CMS ou pagamento. Testes de layout antigo foram substituídos por verificações da nova composição e preservados os testes de goalball, conteúdo e axe. O CI sem fotos valida fallback; a avaliação com 5 fotos e screenshots reais é indispensável. O preview Vercel protegido impede inspeção visual remota; não houve validação humana nesta sessão. Não mesclar.
