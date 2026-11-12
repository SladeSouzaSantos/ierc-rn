# EBC — diagnóstico de elegibilidade editorial e contrato de autopublicação (DEV)

## Objetivo

O bloqueio operacional observado em 11/11/2026 não é falta de agendamento:
o worker de IA do DEV executou a consulta às 08h e os quatro RSS EBC
habilitados para autopublicação retornaram 10 itens recentes cada,
todos rejeitados pelo filtro editorial de relevância. Resultado: `count:0`.
Não inventar notícia, reduzir relevância nem utilizar textos protegidos para
forçar uma primeira publicação.

Referências oficiais:
- Catálogo RSS: https://agenciabrasil.ebc.com.br/feed/
- Política de reprodução e materiais de parceiros: https://agenciabrasil.ebc.com.br/sobre
- Serviço público de distribuição: https://www.gov.br/pt-br/servicos/acessar-noticias-em-tempo-real-gratuitamente

A licença geral da EBC NÃO constitui aprovação individual. O fluxo publicado
exige link e origem oficial, autoria EBC, ausência de proibição/partner content,
texto integral verificável, síntese original em pt-BR, revisão independente,
auditoria no Strapi e proteção contra duplicatas.

## Incremento seguro no GitHub DEV

`curator/src/check-ebc-readiness.mjs` consulta SOMENTE os oito RSS oficiais
já incluídos no catálogo da aplicação: direitos humanos, educação, esportes,
internacional, justiça, política, saúde e geral. Restringe host, caminho,
section e protocolo HTTPS, usa parser/filtro atual e devolve apenas
título, data e link dos três primeiros candidatos por editoria.

- `requires_article_rights_check`: fonte não-preview da allowlist em DEV, mas
  **cada matéria ainda precisa passar pelo gate integral de licença/autor**.
- `discovery_only`: fonte adicional em avaliação, **não pode gerar rascunhos
  nem publicar**, mesmo que o RSS contenha itens com score alto.
- `ebc_source_unavailable`: erro sanitizado, sem dados de HTTP sensíveis.
- `potentialRightsChecks`: quantitativo de itens que podem avançar à
  checagem integral, **não** contagem de publicações autorizadas.

O diagnóstico não lê corpo de notícia, não instancia CMS, Redis, worker ou LLM,
não usa credenciais e não persiste nada. Não muda agendas, volumes, banco,
credenciais, fonte permitida, limiar de relevância ou conteúdo do Radar.

## Executar no MiniMac DEV após atualizar o repositório e o monitor

Dentro de `/opt/projects/ierc-rn-dev`, depois de `git pull --ff-only origin dev`:

```bash
# Verificar HEAD e testar sintaxe/curadoria sem modificar produção
git rev-parse --short HEAD
npm run --prefix curator check
npm run --prefix curator test

# O monitor existente já estará atualizado somente depois do rebuild/restart.
# Usar SEMPRE o mesmo projeto, nunca criar outro monitor:
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml up -d --build monitor

# Consulta EBC auxiliar, sem escrita, DENTRO do monitor que já existe:
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml exec -T monitor node src/check-ebc-readiness.mjs
```

O comando `exec` não cria outra stack/monitor, não depende de tokens de IA
e não inicia uma execução de autopublicação.

Para verificar os campos editoriais e a ordem do último relatório:

```bash
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml exec -T monitor \
  node -e 'const r=require("node:fs").readFileSync("/reports/latest.json","utf8");const x=JSON.parse(r);console.log(JSON.stringify({at:x.generatedAt,summary:x.summary,first:x.articles.slice(0,5).map(a=>({source:a.source,at:a.publishedAt,focus:a.editorialFocus})),ordered:x.articles.every((a,i,v)=>i===0||Date.parse(v[i-1].publishedAt)>=Date.parse(a.publishedAt))},null,2))'
```

**Cuidado:** a saída do `docker compose ... logs monitor` que contém
`mode:read-only, autoPublish:false` descreve APENAS o monitor. Para conferir
o worker permanente de IA sem pará-lo:

```bash
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator ps
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator logs --since=8h --tail=100 worker
```

Não imprimir `curator/.env`, tokens, prompts completos ou conteúdo integral.
Verificar `schedule_started`, `run_completed`, `draft_created`,
`auto_published`, `auto_review_held` e `article_evidence_unavailable`.

## Teste determinístico isolado (GitHub CI)

`curator/tests/auto-publication-contract.test.mjs` injeta HTTP, Redis,
Strapi e dois resultados sintéticos de IA, **sem rede real ou publicação**.
Testa:

1. RSS EBC elegível → artigo completo original autorizado → duas chamadas
   de IA → criação de Draft → GET exato → atualização `status=published`,
   com tokens de Draft/Publisher distintos e trilha de auditoria.
2. Conteúdo identificado como parceiro (ex.: Reuters) é recusado antes da
   primeira chamada de IA, do Redis de escrita e do CMS.
3. A decisão `hold` do revisor preserva o rascunho sem PUT de publicação.

`auto_published.review` registra corretamente `full_article`, não
`rss_only`. Esses testes comprovam o contrato de software, **não** que uma
notícia real já tenha sido publicada no DEV.

## Critério para ampliar EBC e concluir o primeiro gate real

Antes de migrar qualquer editoria `discovery_only` para a allowlist:
confirmar RSS real no MiniMac, URL canônica por item, autoria própria EBC,
restrições/avisos, validação de licença por artigo, cobertura visual específica,
consistência do parser e testes de publicação/retirada.

Não adicionar editorias à allowlist por simples proximidade de temática e
não despausar Comissão Europeia sem homologação de rede/direitos.

A primeira publicação automática real somente está homologada após:
`draft_published` em log do **worker de IA**, documento efetivamente
`published` no Strapi DEV, `editorialStatus=aprovado`, evidência e
atribuição válidas, aparição no Radar e inspeção editorial/retirada.

Status: implementação de diagnóstico e testes no código DEV; CI, deploy
da nova revisão e homologação operacional precisam de verificação separada.
PR #12 permanece Draft; `main` e PROD intocados.
