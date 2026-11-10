# Revisão automatizada e publicação controlada — Radar da Inclusão (DEV)

> **Atualização de segurança — 10/11/2026:** a arquitetura de publicação automática baseada exclusivamente em RSS descrita historicamente abaixo **não é mais permitida para publicar**. A versão atual exige permissão escrita por fonte e evidências do texto integral. Consulte obrigatoriamente [FONTE-INTEGRAL-REVIEW-DEV.md](FONTE-INTEGRAL-REVIEW-DEV.md). O comando antigo com `RSS_ONLY_REVIEW_ACCEPTED` é rejeitado pelo código. **Nenhuma fonte atual possui autorização de extração integral no catálogo; não habilitar agendamento ou publicação.**


**Estado da implementação:** disponível na branch `dev` como funcionalidade **opt-in**, desativada por padrão. `main` e o PR #12 Draft não foram alterados. A IA é usada na geração **e numa segunda etapa de revisão**. Nenhuma configuração de publicação foi aplicada automaticamente ao CMS local.

## 1. Fluxo e limitações de evidência

1. O coletor seleciona somente fontes RSS aprovadas pelas políticas (inicialmente Perkins e W3C/WAI). RNIB, IBSA e WBU permanecem excluídas da escrita por questões de licenciamento/evidência.
2. A primeira chamada à LLM gratuita produz uma síntese original em pt-BR, guardada **sempre primeiro como Draft** no Strapi DEV, com `em_revisao` e `aiAssisted=true`.
3. Uma **segunda chamada à LLM** com prompt independente da geração examina o título, resumo, corpo e contextualização do rascunho **contra o título e o resumo RSS**. O revisor responde `approve` ou `hold`, além de apresentar trechos literais da fonte e possíveis alegações não verificadas.
4. Uma checagem programática (que não confia na afirmação da IA) exige **resumo RSS com pelo menos 160 caracteres**, dois trechos literais distintos e verificáveis, zero problemas/alegações não sustentadas, fonte HTTPS, fingerprint válido, ausência de indícios de informações clínicas/políticas de alto risco e ausência de afirmações de que o artigo completo não possui detalhes. Em qualquer inconformidade: mantém o Draft.
5. O cliente **publicador separado**, com token diferente do token de criação de rascunhos, faz `GET /api/news-articles/{documentId}?status=draft` e verifica se o documento recém-criado continua **não publicado**, `em_revisao`, origem externa, assistido por IA e com título, resumo, corpo, slug, fonte e hash exatamente correspondentes. Se houver mudança, aborta.
6. Só após todos os gates, envia `PUT /api/news-articles/{documentId}?status=published` com `editorialStatus=aprovado`, `approvalReference=ai-rss-v1-...`, e `approvalNote` indicando revisão automática, provedor revisor e **dois trechos literais verificáveis do RSS** (trilha de auditoria, não prova de leitura integral da matéria). Exige uma resposta confirmando `publishedAt`.
7. O portal mostra o conteúdo apenas se `status=published` **e** `editorialStatus=aprovado`. A etiqueta distingue **revisão automática por IA com base em resumo RSS** de **revisão humana**. Sem imagens externas não autorizadas.

**Limitação fundamental:** as duas avaliações utilizam o conteúdo do **RSS**, não a reportagem integral. Uma segunda chamada de IA não é uma auditoria factual independente nem comprova que a fonte completa sustenta todas as afirmações. Quando somente um provedor gratuito está configurado, as duas chamadas podem usar o **mesmo modelo**, ainda que com instruções diferentes. As checagens são conservadoras e podem reter muitas notícias. Para ter garantia editorial mais forte antes de publicar em produção, será necessária leitura integral verificável da reportagem, conferência das citações e amostragens humanas. A automação não é adequada para conteúdo de saúde, jurídico, alertas ou declarações institucionais.

## 2. Slugs legíveis

O curador agora usa `slugFor(source, draft.title)`, removendo acentos e caracteres especiais do título em português e limitando seu tamanho, seguido de **10 caracteres do fingerprint** para reduzir colisões.

Exemplo: `esportes-acessiveis-ampliam-aprendizado-e-pertencimento-4e44e09a02` em vez de `radar-4e44e09a02c386028c`.

**Isso vale apenas para novos rascunhos.** A notícia da Perkins já publicada mantém o slug atual: ela não foi modificada automaticamente para evitar quebrar links. Se um Editor atualizar manualmente o slug no Strapi e republicar o conteúdo, a rota `/noticias/[slug]` da `dev` reconhecerá links antigos `radar-<18 caracteres hexadecimais>` por meio do início do `dedupeKey` e retornará redirecionamento permanente (308) para a nova URL, **somente se existir exatamente um documento publicado e aprovado correspondente**. A alteração não foi efetuada no CMS local e requer verificação manual antes de deploy.

## 3. Tokens Custom do Strapi DEV (separados)

- `CURATOR_STRAPI_DRAFT_TOKEN`: permissões **find + create**, News-article somente. Sem update, delete, publish ou Full Access.
- `CURATOR_STRAPI_PUBLISH_TOKEN`: **findOne + update**, News-article somente. Sem create, delete, Full Access ou outras coleções. No Strapi 5, o método REST PUT com `status=published` **pode publicar**. Trata-se de uma credencial sensível: prazo curto, sem logs, nunca usar no Next.js nem em PROD.
- `CMS_READ_TOKEN` do Next.js: somente leitura, independente dos outros dois.

Os segredos ficam exclusivamente em `curator/.env` e `.env.local` (respectivamente), nunca são enviados ao GitHub ou copiados ao chat. **Não reutilize** uma mesma credencial para criação e publicação: o código recusa tokens idênticos.

## 4. Configuração e ativação

Os valores abaixo precisam ser definidos **manualmente e somente no ambiente DEV**. O código é distribuído com `CURATOR_AUTO_PUBLISH_ENABLED=false`, `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false`.

```dotenv
CURATOR_INSTANCE_KIND=dev
CURATOR_FULL_ARTICLE_REVIEW_ENABLED=false
CURATOR_AUTO_PUBLISH_ENABLED=false
CURATOR_AUTO_PUBLISH_ACK=
CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES=
CURATOR_STRAPI_PUBLISH_TOKEN=
```

O opt-in requer todos os controles: ativação de geração/escrita, token de publicação separado, reconhecimento explícito da limitação RSS e allowlist de fontes. A lista pode conter somente `perkins` e/ou `w3c-wai`. Uma execução de publicação automática processa **no máximo uma notícia**. Não há permissão para PROD.

### Gate A — testar **sem escrever** no CMS

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator check
npm run --prefix curator test
npm run typecheck
npm run build

docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run review:preview
```

`review:preview` faz a geração e a segunda avaliação com as mesmas cotas Redis e provedores gratuitos. **Não escreve no Strapi**. Pode retornar `review_approved_preview` ou `review_pending_preview`, com `reviewReason`, além de `llm_unavailable` ou `insufficient_evidence`. Isso não significa que qualquer notícia tenha sido publicada. Se o modelo esgotar a cota, não repetir chamadas em sequência.

### Gate B — publicação real, BLOQUEADO até autorização de texto integral em DEV

Gerar um backup PostgreSQL **pós-migração** e validar a restauração num banco isolado. Criar um **novo token temporário Custom**, concedendo apenas `findOne` e `update` em News-article, e armazenar em `CURATOR_STRAPI_PUBLISH_TOKEN` no arquivo `curator/.env`.

Para uma única execução supervisionada com variáveis temporárias, mantendo `curator/.env` desativado:

```powershell
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_ENABLED=true `
  -e CURATOR_WRITE_DRAFTS=true `
  -e CURATOR_AUTO_PUBLISH_ENABLED=true `
  -e CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED `
  -e CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true `
  -e CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES=perkins `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run once
```

**Não execute o comando do Gate B nas fontes atuais.** O código barra publicação sem autorização de fonte integral, mesmo com token de update. Em uma futura fonte especificamente autorizada, o comando poderá publicar uma notícia real se todos os gates passarem. Ele não serve como teste de leitura. Recomenda-se executá-lo primeiro em uma instância Strapi DEV isolada de homologação com conteúdo de teste e verificar explicitamente a postagem.

Resultados esperados:
- `draft_published`: draft salvo e publicado automaticamente (apenas após todas as verificações).
- `draft_created_review_pending`: draft salvo, revisão não aprovada ou inconclusiva, **não publicado**.
- `draft_created_publish_failed`: draft salvo, erro ou resposta não confirmada pelo publicador. Pode ser necessário inspecionar o CMS antes de nova tentativa.
- `draft_created`: modo normal com revisão automática desativada, ou fonte fora da allowlist (Draft apenas).

Para ativar **agendamento** depois de aprovar o Gate B, seria necessário manter esses valores em `curator/.env` e executar `worker npm run schedule` de forma persistente. **Isso ainda não foi realizado e não deve ser tratado como homologado.** O plano de três verificações diárias continua proposta de operação; nenhum job automático foi ligado neste deploy.

## 5. Critérios de conclusão e retorno seguro

Verificar a postagem publicada em `/radar-da-inclusao`, o link de origem, o indicador `revisada automaticamente por IA`, `publishedAt`, `editorialStatus`, `approvalReference`, título, campos originais, ausência de imagens não autorizadas e ausência de atribuição ao IERC-RN. Testar no celular e com leitores de tela.

Na ocorrência de texto incorreto, **desativar imediatamente `CURATOR_AUTO_PUBLISH_ENABLED` e parar o worker de schedule**, depois despublicar/corrigir a matéria por Editor humano. Preservar evidências de publicação, logs de resultados sanitizados e registros originais. Revogar o token Custom temporário ao fim dos testes.

Referências: [Strapi 5 REST status](https://docs.strapi.io/cms/api/rest/status), [REST API](https://docs.strapi.io/cms/api/rest), [Sprint 3.2](CURADORIA-SPRINT3-2.md), [Radar da Inclusão](RADAR-DA-INCLUSAO.md).


## 6. Prévia da próxima notícia inédita sem escrita no Strapi

**Aprimoramento implantado somente na `dev`:** `review:preview` não escolhe mais automaticamente a notícia antiga da Perkins quando ela já estiver marcada como processada.

A sequência de seleção acontece **antes de qualquer chamada à IA**:

1. Coletar, validar data e ordenar candidatas RSS elegíveis conforme `rankArticles`. Não utiliza as fontes `previewOnly` (RNIB/IBSA/WBU);
2. Consultar somente o comando Redis `EXISTS ierc:curator:seen:<dedupeKey>`. Se houver marca de processamento, ignorar a candidata sem chamar a IA;
3. Para candidatas não marcadas no Redis, consultar o Strapi com **GET autenticado** em `/api/news-articles?status=draft&filters[dedupeKey][$eq]=...&pagination[pageSize]=1`. Se encontrar, ignorar;
4. Se não encontrar um Draft, repetir o mesmo **GET** com `status=published`. Se encontrar uma notícia publicada, ignorar; caso contrário, ela é considerada inédita;
5. Gerar síntese e revisão IA somente para a **primeira candidata inédita** (padrão `CURATOR_AI_PREVIEW_LIMIT=1`). Se todas estiverem processadas, não chama a IA e retorna `count=0`.

A saída da prévia contém `skippedPreviouslyProcessed: {"redis":N,"cms":N}` e loga somente o motivo de exclusão (`redis` ou `cms`) e a fonte, não o token, URL completa, título ou corpo. O `count` reflete **somente as candidatas efetivamente avaliadas pela IA**, nunca as ignoradas.

**Falha fechada:** erro de Redis ou Strapi 400/401/403/5xx, resposta inválida ou token ausente **interrompe a prévia**, em vez de confundir erro com notícia inédita. Não contornar credenciais ou permissões.

**Credenciais:** `CURATOR_STRAPI_READ_TOKEN` é opcional, preferencialmente um token Custom apenas `find` em Notícias. Se não for informado, usa exclusivamente para **GET** o `CURATOR_STRAPI_DRAFT_TOKEN`, que o operador já configurou para `find/create`. O objeto de consulta da prévia não oferece métodos `create`, `update` ou `publish`; seu código nunca executa HTTP POST/PUT. O modo `generate:preview` permanece como antes, sem consulta CMS.

**Ressalva Redis:** a deduplicação da prévia só faz `EXISTS`, sem gravar marca de notícia processada. Entretanto as chamadas à IA, quando ocorrem, **continuam registrando contadores de cota no Redis**, indispensáveis para o orçamento de provedores gratuitos. Portanto `review:preview` não significa zero escritas no Redis; significa **zero escritas editoriais no CMS ou em chaves de deduplicação**.

Teste no Windows após atualização e rebuild do worker:

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator check
npm run --prefix curator test
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run review:preview
```

Não necessita de token de publicação (`CURATOR_STRAPI_PUBLISH_TOKEN`), nenhuma habilitação `CURATOR_ENABLED=true`, nem mudança do arquivo `curator/.env` além de eventualmente fornecer o token opcional de leitura. `main`, publicação automática e agendamento permanecem sem alterações. A existência de uma aprovação de prévia **não autoriza publicação** da nova matéria sem homologação separada.


### Modo novo: verificação de reportagem integral (ainda não autorizado nas fontes atuais)

Execute `npm run --prefix curator review:full-preview` ou `worker npm run review:full-preview` no ambiente Docker DEV para verificar os bloqueios sem gravar notícias. Sem licença documentada, o modo retorna `article_evidence_unavailable` com `evidenceReason=source_permission_pending`, **sem chamadas à IA ou ao site**. O uso de `review:preview` permanece limitado ao RSS e nunca pode autorizar publicação automática. O status e a trilha de verificação integral estão documentados em [FONTE-INTEGRAL-REVIEW-DEV.md](FONTE-INTEGRAL-REVIEW-DEV.md).
