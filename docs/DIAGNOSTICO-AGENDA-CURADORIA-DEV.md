# Curadoria DEV — diagnóstico das janelas agendadas

**Situação de 13/11/2026:** o worker DEV registrou
`2026-11-13T15:19:49.386Z schedule_started`, que corresponde a
**12h19 em America/Fortaleza**. A consulta `logs --since=2h` subsequente
não encontrou eventos. Isso, sozinho, não comprova que a execução das
13h falhou.

## Como funciona

O worker executa uma verificação a cada 30 segundos. Somente nas
janelas **08:00–08:02**, **13:00–13:02** e **19:00–19:02**
(horário America/Fortaleza), tenta reservar um slot Redis com
`SET ierc:curator:job:YYYY-MM-DD:HH 1 EX 172800 NX`.
Uma reserva por horário, válida por 48 horas; não executar novamente
um slot ocupado, mesmo se a rodada anterior falhou ou o worker reiniciou.
Quando fora das janelas, não existe log de execução — é intencional.

A DEV agora registra:
- `schedule_started`: o processo persistente iniciou; não é uma rodada
- `schedule_slot_claimed`: o processo reservou uma janela
- `schedule_slot_skipped`, `reason:already_claimed`: a janela já tinha
  chave Redis; nenhuma segunda rodada foi disparada
- `run_completed`: rodada terminou e incluiu resumo das candidatas,
  **não** significa necessariamente notícia publicada
- `run_failed`: rodada lançou erro, sem segunda tentativa automática
- `schedule_error`: erro no tick ou no Redis; consulta operacional exigida

Os novos logs não alteram horários, TTL, deduplicação, cotas, conteúdo,
permissões de fontes ou o processamento editorial. Sem RSS relevante,
uma rodada pode terminar com zero notícias.

## Diagnóstico somente leitura no MiniMac DEV

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/check-curator-slots-dev.sh
```

O script apenas usa `docker inspect` sem environment, os comandos
Redis `EXISTS` e `TTL`, e até 80 linhas recentes dos logs do worker.
Não imprime os segredos dos arquivos `.env`, consulta CMS ou chama LLM.
Pode ser executado antes de reconstruir a imagem do worker.

Interpretação:
- `slot=13 | claimed=1`: alguém reservou o slot. Confirmar
  `run_completed` ou `run_failed` nos logs, possivelmente do
  contêiner anterior (os logs de um contêiner removido podem não estar
  disponíveis por `docker compose logs`).
- `slot=13 | claimed=0`, após 13h02: ninguém manteve a reserva no Redis,
  se o Redis não foi limpo/recriado. Verificar uptime do worker,
  reinícios, conexões e saúde do Redis.
- Uma reserva ativa **não prova** que uma notícia tenha sido publicada.
  Não apagar a chave para forçar nova execução; isso rompe a garantia
  de uma rodada por slot.

Depois que o CI aprovar a mudança, para ativar os novos eventos:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator up -d --build --no-deps --force-recreate worker
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator logs --since=8h --tail=100 worker
```

O rebuild é necessário: o worker contém uma imagem Node com código
incorporado à imagem no build, e `git pull` sozinho não a substitui.

**Não aplicar na MAIN** antes de homologar na DEV. As execuções reais
continuam sujeitas ao filtro de fontes licenciadas, verificação de
artigo integral, duas evidências de blocos distintos, aprovação
independente de IA e validação do rascunho no CMS. Se o slot das 13h
ficou ausente, a próxima janela é a das **19h** locais, sem execução
retroativa.
