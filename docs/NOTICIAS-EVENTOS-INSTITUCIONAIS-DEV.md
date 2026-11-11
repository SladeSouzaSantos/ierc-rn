# IERC-RN · Agenda e cobertura institucional (DEV)

## Decisão editorial

O IERC-RN terá quatro conteúdos distintos, embora relacionados:

1. **Notícias institucionais**: ações, visitas, oficinas, comemorações e conquistas
   realmente realizadas ou comunicadas pela própria equipe; rota `/noticias`.
2. **Agenda de eventos**: atividades futuras com data, local e orientações confirmadas;
   rota `/eventos`, com grupos "Em andamento", "Próximos eventos" e
   "Eventos realizados pelo Instituto".
3. **Arquivo esportivo**: documentação de competições passadas citadas nas fontes
   esportivas oficiais; permanece na área "Competições de 2026" sem ser
   confundido com a agenda futura do Instituto.
4. **Radar da Inclusão**: notícias **externas** com autoria identificada e
   revisão própria, nunca apresentadas como ações realizadas pelo IERC-RN.

## Implementação inicial sem migrar Strapi

O Strapi já dispõe de `news-article` e `event` com Draft & Publish e
`editorialStatus`. A página só recebe documentos simultaneamente
**publicados** e **editorialmente aprovados**, via `getCmsNews()` e
`getCmsEvents()`.

Para publicar uma **notícia de evento interno** no Strapi DEV:

- Criar notícia na coleção `news-article`, informando título, resumo, corpo,
  data do acontecimento e slug próprio.
- Definir `originType=institucional` e `category=Eventos e atividades`.
  A categoria singular `Evento institucional` também é aceita; o editor
  não precisa preencher uma coleção duplicada de notícias.
- Após revisão da instituição, definir `editorialStatus=aprovado` e
  publicar. O conteúdo aparecerá na rota `/noticias/[slug]`, será
  listado em `/noticias` e ganhará link na seção
  "Notícias de eventos e atividades internas" de `/eventos`.
- Se a matéria vier da imprensa, manter `originType=externa` e atribuição
  real da fonte. Mesmo que a categoria coincida, não será apresentada como
  notícia emitida pelo Instituto.
- A IA do Radar não tem permissão para converter notícias externas em
  comunicados institucionais, nem para publicar eventos internos.

Para publicar um **evento** na coleção `event`:

- Criar título, descrição/resumo, slug e `startsAt` confirmados, além
  de `endsAt`, local e link de inscrição **somente quando confirmados**.
- Marcar `editorialStatus=aprovado` e publicar após revisão.
- A agenda classifica pelas datas reais: futuro -> Próximos eventos;
  início passado e término ainda futuro -> Em andamento; evento
  encerrado -> Eventos realizados. Se não há término, o evento deixa de
  ser futuro após o início; por isso, cadastrar `endsAt` sempre que
  possível para mostrar corretamente a atividade em andamento.
- Os eventos próximos são ordenados por início crescente; os realizados,
  por início decrescente.
- O histórico esportivo de fontes CBDV permanece em seção separada, sem
  criar eventos futuros ou inscrições fictícias.

## Regras de qualidade e segurança

- Fotografias exigem consentimento, direitos de imagem, crédito, alternativa
  textual e revisão de exposição de crianças e beneficiários. Não publicar
  retratos sem autorização.
- Conteúdos institucionais dependem de aprovação humana; a primeira versão
  não gera fatos ou notícias do IERC-RN automaticamente.
- Não inserir datas, URLs de inscrição, endereços de evento ou informações
  financeiras ainda não fornecidas pela instituição.
- O fallback sem CMS mantém os registros históricos reais e mostra estado
  vazio honesto para a agenda e notícias internas.
- Nenhuma alteração de schema, banco, tokens, Docker, Redis ou worker do
  Radar é necessária nesta etapa.
- O desenvolvimento fica na `dev`; `main` e PR #12 Draft preservados.

## Próximas entregas após a homologação da interface

1. Receber da instituição calendário e notícias reais, com responsáveis
   editoriais e fotos licenciadas, e publicar um evento e uma notícia de teste
   **reais** no Strapi DEV.
2. Validar a exibição no desktop, celular, 200%/400% de zoom e leitores de
   tela; checar que o conteúdo ainda em Draft nunca aparece.
3. Avaliar URLs próprias `/eventos/[slug]` e vínculo explícito entre notícia,
   evento e galeria apenas quando houver conteúdo suficiente para justificar
   campos adicionais no CMS.
4. Depois, dar andamento à seção `/apoie` sem aceitar doações por pagamento
   até confirmar titularidade, gateway, segurança e prestação de contas.

## Prioridade editorial da página Notícias — 11/11/2026

A seção **"Notícias da equipe do IERC-RN"** é renderizada **sempre e antes dos
registros de imprensa externa**, mesmo quando ainda não existem publicações
institucionais aprovadas. Nesse estado, é apresentado um cartão informativo
"Publicações institucionais em preparação", sem simular notícia, evento,
foto ou data. O título introdutório da página passa a enfatizar a comunicação
do IERC, e não as fontes externas.

Quando um artigo `news-article` de origem institucional for efetivamente
publicado no Strapi e tiver `editorialStatus=aprovado`, os cartões de notícia
substituem automaticamente a mensagem vazia. O componente **não** altera o
filtro no servidor: só recebe notícias publicadas e aprovadas da
`getCmsNews()`. A cobertura externa sobre o Instituto, seus seis registros
históricos e o Radar continuam separados e inalterados.

Regressão: `tests/cms-integration.spec.ts` verifica a seção oficial,
mensagem vazia, ordem no DOM, ausência de notícia institucional fictícia,
seis registros externos e link para o Radar com o CMS desligado.

Status de implantação: código em `dev`; exige reconstruir apenas
`compose.portal.dev.yml` depois da aprovação do CI. Não há alteração no
schema do Strapi, curador IA, Compose do worker, Redis ou produção.
