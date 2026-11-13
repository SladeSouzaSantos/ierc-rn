# Auditoria editorial privada de Draft terminal — DEV

## Finalidade

Esta ferramenta explica, de maneira **somente leitura**, por que uma notícia real
continuou em `Draft` após até duas correções automáticas. Ela **não** é um
publicador, não representa aprovação factual e não altera o limite de correções
ou o histórico do Redis.

O teste real do Enem em 13/11/2026 retornou:

- `editorial_progress_resumed phase=repair correctionsDone=1`;
- `editorial_repair_generated provider=gemini correction=2`;
- nova revisão com `full_article_review_held provider=openrouter`, uma
  afirmação apontada e uma objeção editorial;
- `editorial_repair_held reason=ai_review_hold correctionsDone=2` e
  `draft_review_pending`.

O estado criptografado torna-se `terminal`, não reiniciável por retries. O
worker não pode transformá-lo em aprovação nem pedir a outros modelos um
parecer mais favorável.

## Execução segura no MiniMac DEV

Após o CI no HEAD da branch `dev` terminar em sucesso:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/preflight-curator-autopublish-dev.sh
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator build worker
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/audit-pending.mjs nxh3gri9njyrag8uvbtgux4i
```

Este primeiro comando de auditoria exibe apenas os motivos editoriais
armazenados, hashes truncados, códigos de blocos e proximidade lexical.
**Não** envia chamadas à IA, nem cria, atualiza ou publica notícia no CMS;
não usa comandos Redis SET/DEL/INCR.

Para revisão privada do texto corrigido, executar com `--include-draft`.
Não compartilhar publicamente o relatório completo nem incluir tokens:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator run --rm --no-deps -T worker \
  node src/audit-pending.mjs nxh3gri9njyrag8uvbtgux4i --include-draft
```

## Como interpretar

- `savedPhase: "terminal"`, `correctionsDone: 2`: a linhagem editorial
  atingiu o máximo, não tem mais tentativa de correção automática.
- `modelFlaggedIssues`: críticas curtas emitidas pelos revisores e guardadas
  pelo histórico AES-256-GCM, não conclusões independentemente comprovadas.
- `sourcePhrasePresent`: afirma apenas presença literal da frase
  questionada em um bloco da matéria oficial.
- `closestBlockId` e `wordOverlap`: dicas **lexicais**, nunca evidência
  suficiente para desconsiderar negação, contexto, data ou autoria.
- `lastCorrectedDraft`: aparece somente quando explicitamente solicitado
  e contém a síntese produzida por IA, não o texto da reportagem.
- `conclusion: "requires_human_factual_review"`: uma pessoa precisa
  conferir cada alegação e a integridade do texto publicado.

A auditoria só lê um Draft existente, com fonte da allowlist e autorização
confirmadas, e só descriptografa o histórico se o Draft original e o digest
da reportagem integral atual ainda forem idênticos aos vínculos AEAD. Em
caso de conteúdo alterado ou evidência inválida, **falha fechada**.

## Caminho legítimo para a notícia sair do Draft

1. Comparar cada afirmação questionada e os cinco campos da última versão
   corrigida com a reportagem original completa da Agência Brasil.
2. Se a objeção for procedente, preparar uma versão editorial corrigida em
   fluxo **humano**, sem fingir uma aprovação automática ou sobrescrever o
   histórico terminal. Não manipular o Redis nem duplicar o mesmo link.
3. Se o editor institucional decidir publicar, usar o fluxo editorial humano
   do Strapi, atribuir a fonte e indicar claramente `approvalReference`/
   `approvalNote` de revisão **humana**; verificar `editorialStatus=aprovado`
   e o estado **Published** no CMS. Esse caminho **não** registra
   `draft_published` automático.
4. Caso a decisão seja seguir exclusivamente com publicação 100% automática,
   **essa notícia específica permanece Draft**: o HOLD terminal não pode ser
   reiniciado. Usar o pipeline normal e outra matéria licenciada e elegível
   para uma nova homologação, com a revisão integral independente.
5. Inspecionar a URL pública no Radar DEV, as citações/atribuição, ausência
   de duplicatas, estado CMS e o backup restaurável antes de liberar o PR
   `dev` → `main`. Não habilitar a MAIN em produção implicitamente.

Aprovação de CI ou execução da auditoria não equivale à publicação real.
