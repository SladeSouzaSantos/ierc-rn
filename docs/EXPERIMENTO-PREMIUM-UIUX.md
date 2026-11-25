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
