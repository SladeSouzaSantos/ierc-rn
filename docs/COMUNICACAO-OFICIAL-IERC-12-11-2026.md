# IERC-RN — Informações institucionais confirmadas e pauta da Festa Natalina

**Atualização:** 12/11/2026. Fonte: respostas da representante da instituição transmitidas pelo operador, convite oficial em PDF e mensagem de áudio. Ambiente de destino inicial: **DEV**. Conteúdo institucional sujeito à aprovação final da **presidência** antes de ser publicado pelo Strapi.

## Bazar Solidário — horários e operação

- Bazar aberto a qualquer pessoa: **terça-feira, 8h às 11h**, dentro do IERC-RN, Rua Fonseca e Silva, 1113, Alecrim, Natal/RN.
- Compra presencial: pagamento em **Pix ou dinheiro**. O Pix presencial para compras não equivale à chave de doações.
- Doações físicas aceitas: **roupas, sapatos e bolsas em bom estado**.
- Entrega presencial dos itens: **segunda a quinta-feira, 8h às 11h**, na sede. **Não há coleta domiciliar**.
- Entrega conduzida pela equipe da instituição. A informação de nomes informais de funcionárias **não será divulgada publicamente**, sem autorização explícita.
- O IERC aceita **parcerias, ajuda em serviços e materiais**, e voluntariado a combinar.
- Doações financeiras: o operador informou em 12/11/2026 a chave **Pix por CNPJ 08.049.504/0001-08** como chave do IERC-RN. O site a exibe em `/apoie` para **transferências manuais feitas pelo doador no aplicativo bancário**, orientando verificar o destinatário antes de concluir. A informação foi fornecida institucionalmente; **não houve consulta bancária independente para comprovar titularidade**. Não gerar QR Code, checkout, valor obrigatório ou recorrência automática.

## Contatos confirmados para divulgação

- E-mail: **ierc_institutodecegos@yahoo.com.br**
- WhatsApp institucional: **(84) 98726-4807** (`https://wa.me/5584987264807`)
- Endereço: **Rua Fonseca e Silva, 1113 — Alecrim, Natal/RN**
- Horários **gerais** de atendimento do Instituto **não foram confirmados**. Os horários do bazar/recebimento não devem ser apresentados como expediente geral.
- O formulário de visitas já confirmado permanece em
  `https://forms.gle/NY35YEEkbL6HM2YF9`.

A aplicação mantém e-mail e WhatsApp em `lib/institutional-contact.ts`, exibidos na
página `/contato` e no rodapé. A chave Pix por CNPJ também fica
centralizada nesse arquivo e aparece apenas na página `/apoie`.
Não há contas bancárias, tokens financeiros ou segredos de pagamento no frontend.

O Strapi possui os campos `phone` e `email` em **Configurações institucionais**.
A equipe poderá preencher e aprovar esses campos para registro editorial.
**O frontend atual usa os contatos públicos verificados em código**; editar
um campo do Strapi não atualiza automaticamente esses textos até uma integração
específica com esse Single Type.

## Governança de notícias, imagens e publicação

- **Diretoria:** encaminha pautas, notícias e fotos para a comunicação.
- **Presidência:** responsável pela aprovação final de notícias, eventos,
  alterações institucionais e publicações; pode usar o painel do Strapi.
- Criar **contas individuais** com menor privilégio possível. Não compartilhar
  a conta Super Admin com todos; configurar e testar permissões de edição,
  aprovação, publicação e retirada do ar.
- A instituição informou que possui **autorizações de uso de imagem**.
  Antes de anexar cada arquivo, verificar **abrangência da autorização**,
  finalidade da divulgação, autoria/crédito e referência documental.
  Para fotos de crianças, verificar autorização adequada do responsável.
  Não interpretar “sim” como autorização irrestrita de qualquer fotografia
  ou de desenhos de terceiros.

## Evento confirmado: Festa Natalina 2026

Convite visual oficial e áudio confirmam:

- **Evento:** Festa Natalina 2026 do IERC-RN, festa de encerramento mencionada pela instituição.
- **Data:** terça-feira, **15 de dezembro de 2026**.
- **Início:** **8h da manhã** (America/Fortaleza; ISO `2026-12-15T08:00:00-03:00`).
- **Encerramento:** **não informado**. Deixar `endsAt` vazio.
- **Local:** sede do IERC-RN, Rua Fonseca e Silva, 1113, Alecrim, Natal/RN.
- **Convite:** “Sua presença é muito especial para nós!”.
- **Inscrições:** link **não informado**. Deixar `registrationUrl` vazio;
  o convite não comprova reserva, pagamento ou inscrição.
- **Artes:** convite natalino ilustrado com duas crianças usando óculos
  escuros e segurando presentes, bolas e laços, árvore de Natal, ornamentos
  e a marca IERC/RN.

### Preenchimento no Strapi → Eventos (proposta para revisão da presidência)

| Campo | Valor ou ação |
| --- | --- |
| `title` | **Festa Natalina 2026 do IERC-RN** |
| `slug` | `festa-natalina-ierc-rn-2026` |
| `summary` | **O IERC-RN convida a comunidade para sua Festa Natalina 2026, no dia 15 de dezembro, terça-feira, a partir das 8h, na sede do Instituto, na Rua Fonseca e Silva, 1113, Alecrim, Natal/RN. Sua presença é muito especial para nós!** |
| `startsAt` | **15/12/2026, 08:00**, no horário local do RN |
| `endsAt` | **vazio**; término não informado |
| `location` | **IERC-RN — Rua Fonseca e Silva, 1113, Alecrim, Natal/RN** |
| `registrationUrl` | **vazio**; não foi fornecido formulário de inscrição |
| `sourceName` | **IERC-RN — convite oficial da Festa Natalina 2026** |
| `sourceUrl` | **vazio**; documento interno, sem URL pública confirmada |
| `image` | Enviar a imagem otimizada do convite **se a presidência confirmar os direitos de publicação da arte** |
| `imageAlt` | **Convite ilustrado da Festa Natalina 2026 do IERC-RN, com duas crianças usando óculos escuros e presentes de Natal. Informa a data de 15 de dezembro, início às 8h, no endereço do Instituto.** |
| `imageCredit` | **IERC-RN — convite institucional**, sujeito à confirmação de autoria da arte |
| `imageRightsStatus` | **pendente** até confirmar licença/cessão; então, se comprovado, **autorizado** |
| `imageRightsProof` | Referência à confirmação documental da instituição; não inventar |
| `editorialStatus` | **em_preparacao** inicialmente; presidência define **aprovado** após conferir |
| `approvalReference` | Identificador ou data de aprovação real da presidência, preenchido somente após aprovação |
| `approvalNote` | **Dados verificados no convite oficial e no áudio recebidos em 12/11/2026. Término e inscrições não informados.** |

**Fluxo de publicação:** salvar como **Draft**, solicitar avaliação da
presidência, preencher autorização, alterar `editorialStatus=aprovado`
e só então clicar **Publish**. Verificar em `/eventos` após a revalidação.
Não anunciar a existência de um evento publicado sem evidência de registro
no Strapi. Se a presidência autorizar, usar a mesma pauta em uma
**Notícia institucional** distinta, sem duplicar a agenda.

### Atenção sobre a imagem

O Strapi já aceita `image` em Eventos. A partir da atualização do
portal DEV com a implementação de mídia, os cartões de `/eventos`
**exibem a imagem no topo somente quando** o evento está publicado,
`editorialStatus=aprovado`, `imageRightsStatus=autorizado`, o campo
`imageAlt` está preenchido e o arquivo é uma imagem segura do próprio
CMS. Também pode ser exibido o crédito `imageCredit`.

A imagem é servida por rota interna do **portal**, sem revelar o token nem
o hostname privado do Strapi; os cartões sem foto mantêm apenas texto.
O enquadramento usa `object-fit:contain` para preservar o convite inteiro,
sem recortar datas e letras da arte. A equipe deve manter as informações
essenciais (data, hora, endereço) também em texto. O campo
`imageRightsProof` deve apontar para a autorização documental real da
arte; não marcar `autorizado` sem comprovação.

Se a imagem não aparecer, verificar os campos acima e o arquivo no Strapi,
além de confirmar que o **portal DEV foi reconstruído**. O upload
anterior permanece no CMS; não é necessário criar outra coleção, mudar
o banco ou reconstruir Strapi.

## Revisão do assistente de notícias automáticas

Na tentativa de 11/11 às 19h BRT, os três provedores foram consultados:
`groq → invalid_output/incomplete_draft`,
`gemini → invalid_output/incomplete_draft`,
`openrouter → timeout (15.020 ms)`. A execução de 12/11 às 8h não
encontrou candidatas elegíveis nos RSS (4 fontes, 10 itens cada).
O worker estava ativo e `autoPublish=true`. Não houve evidência
`auto_published`.

O problema é de **completude das sínteses e tempo de resposta**, não
de ausência de configuração. O prompt foi especificado com mínimos
explícitos, sem reduzir o validador de completude, nem desativar
fonte/filtros ou publicar sem revisão independente. O próximo passo é
monitorar a execução seguinte. Se persistir `timeout` no OpenRouter,
avaliar ajuste moderado de `CURATOR_ATTEMPT_TIMEOUT_MS` no
**DEV**, com aprovação e custo/quota do serviço revisados, sem imprimir
`.env` ou tokens.
