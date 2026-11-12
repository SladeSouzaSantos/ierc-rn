# IERC-RN — Diagnóstico da publicação automática de notícias no MiniMac DEV

Atualizado em 12/11/2026. **Somente diagnóstico e observabilidade:** não desligar
o agendador nem enfraquecer as validações de licença, autoria e relevância.

## O que os logs do operador comprovam

Contêiner `ierc-rn-curator-dev-worker-1` iniciado em
`2026-11-11T19:23:40Z`, reinicializações `0`, estado `running`.
Configurações lidas do próprio contêiner (sem exibir tokens):
`CURATOR_ENABLED=true`, `CURATOR_WRITE_DRAFTS=true`,
`CURATOR_AUTO_PUBLISH_ENABLED=true`,
`CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true`,
`CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED=true`.

- `schedule_started` às **16:23:41 BRT** em 11/11, janela configurada
  **08h, 13h, 19h** (America/Fortaleza).
- `run_completed` em **11/11 às 19:01:43 BRT**, `count=1`, e
  `llm_unavailable` com categoria
  `all_free_providers_unavailable`. **Não houve evidência de publicação.**
- `run_completed` em **12/11 às 08:01:04 BRT**, `count=0`,
  `preview=false`. Sem candidata processada.
- Quatro RSS Agência Brasil: `validLastYear=10`,
  `withinWindow=10`, `candidates=0` por fonte nas
  execuções observadas; `noCandidatesReason=no_matching_topics`.
- Comissão Europeia permaneceu pausada por timeout; as demais fontes
  excluídas por política de uso não devem ser habilitadas sem autorização.
- Os logs exibidos **não incluem** as linhas `llm_attempt`. Portanto,
  ainda não se sabe se os provedores gratuitos falharam por cotas,
  autenticação, timeout, formato ou indisponibilidade. Não diagnosticar
  isso como erro de chave sem evidência.

O `count` anterior representava resultados/candidatos processados,
**não número de notícias publicadas**. A partir do novo worker DEV,
`run_completed` informa também `published`, `draftsCreated` e
`statusCounts` (sem títulos/URLs/tokens) para observação.

## Comandos de consulta somente leitura

```bash
cd /opt/projects/ierc-rn-dev
docker ps --filter name=ierc-rn-curator-dev-worker-1 --format 'table {{.Names}}\t{{.Status}}'

# Resultado da execução e publicação confirmada:
docker logs --since 48h ierc-rn-curator-dev-worker-1 2>&1 |
  grep -E '"event":"(schedule_started|run_completed|run_failed|auto_published|auto_publish_failed|auto_review_held|llm_unavailable)"'

# Categorias de falha de modelos, sem imprimir credenciais:
docker logs --since 48h ierc-rn-curator-dev-worker-1 2>&1 |
  grep -E '"event":"(llm_attempt|llm_unavailable|draft_created|article_evidence_unavailable)"'

# RSS e acervo:
docker logs --since 48h ierc-rn-curator-dev-worker-1 2>&1 |
  grep -E '"event":"(feed_checked|feed_unavailable|source_paused|source_skipped_by_policy|archive_[a-z_]+)"'
```

### Como interpretar `llm_attempt`

- `result=rate_limit` ou `quota`: limite/indisponibilidade da cota.
- `result=configuration`: verificar credenciais/modelos **sem imprimi-los**.
- `result=timeout` ou `network`: conectividade ou serviço externo.
- `result=unavailable`: provedor retornou erro de servidor.
- `result=invalid_output`: resposta fora do contrato editorial,
  incluindo JSON inválido/truncado; nunca publicar mesmo assim.
- `result=success`: aquele provedor produziu uma resposta válida.
- Se não houver `llm_attempt` no período, conferir logs de inicialização,
  política de cota Redis, resfriamento e a janela das execuções.

### Próximo gate

Confirmar categorias `llm_attempt` e revisar se há ajuste seguro de
modelo gratuito/timeout/cota a fazer. Não executar `node src/cli.mjs once`
só para diagnóstico: com `autoPublish=true`, pode criar/publicar
conteúdo real. Não alterar URLs de fontes ou permitir conteúdo sem licença.

**Importante:** a melhoria de log só aparece **após atualizar o contêiner
worker DEV**, sem alterar agendamento, fontes, Redis ou tokens. Até lá,
o marcador `auto_published` já é a evidência de publicação real.

Fonte dos dados: saídas Docker fornecidas pelo operador em 12/11/2026.
