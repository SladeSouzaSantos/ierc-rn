# Curadoria de fontes integrais — IERC-RN, Brasil e mundo (DEV)

**Status — 10/11/2026:** desenvolvido na branch `dev`, com fontes oficiais, classificação editorial, checagens de direitos por artigo e testes automatizados. **Ativação real do publicador e do agendador: não efetuada.** O código não modifica `main`, PROD, tokens locais ou rascunhos existentes.

## 1. Três frentes editoriais, sem confundir autoria

| Frente | Definição | Destino público |
|---|---|---|
| **IERC-RN na imprensa** | Matéria de terceiro que mencione explicitamente `IERC-RN`, `IERC/RN` ou o nome completo do Instituto; evidência deve estar na fonte | `/noticias`, seção independente das notícias institucionais |
| **Brasil e inclusão** | Esporte adaptado, goalball, Braille, tecnologia assistiva, acessibilidade, educação inclusiva e direitos de pessoas com deficiência | `/radar-da-inclusao` → Brasil |
| **Experiências internacionais** | Iniciativas e ações estrangeiras sobre a causa com contexto potencialmente útil para a comunidade brasileira | `/radar-da-inclusao` → mundo |

A classificação está em `curator/src/coverage-policy.mjs`; o ranqueamento em `curator/src/relevance.mjs`. O pipeline prioriza menções explícitas ao IERC-RN, depois notícias nacionais e experiências internacionais. **`originType=externa` é preservado em todos os casos de reprodução/síntese de terceiros.** Apenas a equipe institucional pode criar comunicados próprios. O campo Strapi `scope=local|brasil|internacional` evita migração adicional e diferencia os destinos sem nova coleção.

## 2. Fontes habilitadas e licença

**Agência Brasil (EBC)** — fontes RSS oficiais `/rss/direitos-humanos/feed.xml`, `/rss/educacao/feed.xml`, `/rss/esportes/feed.xml` e `/rss/internacional/feed.xml`. O portal oficial [informa os feeds](https://agenciabrasil.ebc.com.br/feed/); a [política de reprodução](https://agenciabrasil.ebc.com.br/sobre) autoriza a reprodução jornalística com atribuição, e a [Carta de Serviços](https://www.gov.br/pt-br/servicos/acessar-noticias-em-tempo-real-gratuitamente?id=5351&origem=servico) reconhece a captura automatizada por portais. Essa permissão **não cobre automaticamente conteúdo de Reuters, AFP ou outros parceiros**: o leitor exige autoria `Agência Brasil` ou repórter identificado como EBC, e rejeita páginas com aviso de reprodução proibida. Uso aqui: síntese original, não comercial, com crédito e URL da fonte; nenhuma imagem é copiada. A autoria é verificada em `.autor-noticia` e o texto em `.conteudo-noticia`.

**Comissão Europeia** — feed RSS oficial de notícias em destaque `https://commission.europa.eu/node/29665/rss_en`, obtido diretamente do link RSS da [página oficial em inglês](https://commission.europa.eu/news-and-media/highlighted-news_en). O [aviso jurídico oficial](https://commission.europa.eu/legal-notice_en) disponibiliza editorial próprio sob **Creative Commons Atribuição 4.0** na ausência de aviso individual contrário. O leitor exige URL de notícia do domínio oficial, identificação `Directorate-General for Communication` e corpo da própria Comissão. Materiais externos, fotografias, logotipos e conteúdos de terceiros não são automaticamente licenciados; não são copiados. Traduções e sínteses devem mencionar adaptação e manter link e crédito.

**Outras fontes:** Perkins e WAI continuam como fontes RSS para prévia/editorial, mas **não têm extração integral autorizada nesta implementação**. RNIB/IBSA/WBU continuam bloqueadas conforme políticas anteriores. O conteúdo do CPB, BNews RN e Tribuna do Norte pode ser referenciado e resumido com links após verificação, mas não é extraído em massa nem tratado como licenciado para publicação autônoma. Novas fontes devem receber avaliação de direitos, feeds, estrutura, relevância e testes antes de ativação.

**Verificação de 10/11/2026 no Docker Windows:** os quatro RSS EBC responderam e cada um forneceu 10 notícias recentes, mas **nenhuma estava dentro dos temas editoriais selecionados**. Isso é uma seleção vazia legítima, não falha do feed; a coleta não deve aceitar notícias genéricas apenas para preencher o Radar. O antigo endpoint EU (`/news/feed_en`) foi confirmado como inadequado após `redirect_blocked` e substituído pelo link RSS oficial (`/node/29665/rss_en`). O novo endpoint EU ainda exige smoke test no Docker Windows. Erro, bloqueio de acesso ou mudança de formato retorna `feed_unavailable` ou `article_evidence_unavailable`, sem contornar restrições.

## 3. Segurança e auditoria

- `curator/src/article-evidence.mjs`: URL HTTPS e host exatos, no máximo um redirect para o mesmo documento, timeout, até 340 kB HTML, 12 mil caracteres / 45 blocos. Remove scripts, formulários, mídia, menus e conteúdo não editorial. Seletores específicos da EBC e da Comissão Europeia; ausência de evidência, autoria ou licença válida implica retenção.
- `curator/src/full-article-review.mjs`: duas chamadas LLM (redação e revisão), com texto dividido em blocos numerados `E01`, `E02` etc. A segunda etapa exige duas citações literais distintas, presentes em blocos diferentes. Fatos não comprovados, afirmações médicas sensíveis e traduções equivocadas levam a `hold`.
- `curator/src/duplicate-check.mjs`: Redis `EXISTS` e Strapi `GET` de Draft/Published antes do gasto com IA. A prévia não faz escrita editorial.
- `curator/src/cms-publish.mjs`: exige documento originalmente Draft, mesma fonte, URL, título, resumo, corpo e dedupeKey, uma auditoria de revisão com SHA-256 do texto extraído, trechos de evidência, referência à licença específica e token Custom separado. Sem tudo isso, não envia `PUT ?status=published`.
- `curator/src/auto-config.mjs`: permite ativação exclusivamente em DEV mediante `CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true`, `FULL_ARTICLE_REVIEW_ACCEPTED`, allowlist de fontes licenciadas e lote de um item; tudo **desativado por padrão**.
- A reportagem integral e os elementos gráficos de terceiros não são gravados no Strapi. O portal distingue conteúdo externo, revisão humana e aprovação automática assistida por IA. Aprovações automáticas indicam a política da fonte, origem e adaptação no registro de auditoria.

Uma citação literal verificável **não garante**, por si só, que todas as afirmações feitas pela IA estejam corretas. A implementação inclui retenção conservadora e precisa de inspeção humana amostral antes de operar continuamente.

## 4. Homologação no Windows

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator check
npm run --prefix curator test
npm run typecheck

docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Verifica feeds e seleção: sem IA nem escrita
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker npm run preview

# Verifica leitura integral, seleção inédita e dupla IA: sem escrita editorial
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run review:full-preview
```

**Resultados possíveis:** `review_approved_preview`, `review_pending_preview`, `article_evidence_unavailable`, `feed_unavailable` ou `count:0`. Depois dessa atualização, `feed_checked` informa `filteredByTopic` e, quando não houver candidatos, `noCandidatesReason=no_matching_topics` (feed válido, sem notícias alinhadas) ou `no_recent_items` (nenhuma notícia válida na janela de tempo). Uma publicação da Agência Brasil assinada por agência parceira deve ser retida com `article_rights_unverified`. Matérias Perkins/WAI retornam `source_permission_pending`. A presença de uma matéria pública já processada deverá levar ao descarte da duplicata antes da IA.

**Não utilizar** `CURATOR_AUTO_PUBLISH_ENABLED=true` nem iniciar o `schedule` antes de: CI aprovado, smoke local dos feeds, conferência da extração de autoria e direitos de um artigo real, backup PostgreSQL restaurável, token de publicação separado e execução supervisionada em DEV isolado. Nenhum desses passos autoriza PROD ou merge na `main`.

Veja também [issue #14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14), [Curadoria 3.2](CURADORIA-SPRINT3-2.md) e [Política de publicação](REVISAO-IA-PUBLICACAO-DEV.md).


## 5. Diagnóstico do RSS europeu no Windows e Docker (10/11/2026)

O Windows do operador tentou acessar \`https://commission.europa.eu/node/29665/rss_en\` com \`curl.exe --max-time 20\`: \`curl: (28)\`, \`HTTP=000\`, \`0 bytes received\`, aproximadamente 20,0 s. Isso comprova apenas que **essa requisição no host Windows expirou**. O primeiro teste Docker não chegou a executar \`fetch\`: o PowerShell alterou as aspas de \`node -e\` ao repassar argumentos, provocando \`SyntaxError: Unexpected token ':'\`. Não registrar o Docker como indisponível sem um segundo teste válido.

Repetir com **here-string + stdin** do Node, sem dependência de escaping entre PowerShell/Docker:

\`\`\`powershell
$diagnostico = @'
const url = "https://commission.europa.eu/node/29665/rss_en";
fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) })
  .then(async response => {
    const text = await response.text();
    console.log(JSON.stringify({
      status: response.status,
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      characters: text.length
    }));
  })
  .catch(error => {
    console.log(JSON.stringify({
      error: error.name,
      cause: error.cause?.code ?? "unknown"
    }));
    process.exitCode = 1;
  });
'@

$diagnostico | docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T worker node -
\`\`\`

Interpretar: \`status:200\` e XML com corpo indica acesso; \`301/302/307/308\` exige avaliação de \`Location\` antes de qualquer alteração na política de redirects; \`TimeoutError\` significa expiração real do teste Docker; \`TypeError\` com \`cause\` exige distinguir DNS, IPv4/IPv6, TLS ou falha de rede. Se Windows **e** Docker expirarem, não concluir automaticamente que o feed está fora do ar para todos; manter como fonte degradada e permitir que as demais fontes continuem operando. Não ampliar timeout indiscriminadamente, não usar proxies não aprovados, não ativar publicação automática.

O arquivo \`next-env.d.ts\` pode ser atualizado automaticamente pelo Next.js durante o desenvolvimento; sua diferença de cabeçalho ou referência de rotas não se relaciona ao curador. Conferir \`git diff -- next-env.d.ts\` e decidir separadamente sobre essa mudança.
