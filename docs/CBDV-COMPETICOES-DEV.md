# IERC-RN — Competições esportivas, CBDV e Strapi DEV

Atualização: 11/11/2026. Desenvolvimento somente na branch `dev`.
**Código preparado não significa coleção já instalada no Strapi do MiniMac.**

## Decisão arquitetural

Existem três conjuntos editoriais independentes:

- **Eventos:** oficinas, apresentações e atividades institucionais,
  mantidos em `api::event.event`, sem campos específicos de esportes.
- **Competições esportivas:** nova coleção `api::sport-competition.sport-competition`,
  rótulo **Competições esportivas**, para competições externas, próprias,
  calendário organizado por ano e modalidade, com campos editoriais específicos.
- **Trajetórias de atletas:** registros documentados e biográficos; não
  constituem lista atual de membros de uma equipe.

A listagem histórica de participantes citados pela CBDV na Série A de 2026
é preservada como fonte histórica e não é convertida em elenco atual.

## Coleta automática CBDV (independente do Strapi)

O portal consulta somente a tabela oficial de **TORNEIOS** na
https://www.cbdv.org.br/calendario e extrai competições de Goalball
com título, data, local e fonte. Tem janela de 90 dias anteriores a
550 dias futuros, máximo de 20 registros, validação das datas e
revalidação do cache Next.js a cada 6 horas **quando houver um acesso**
à página. Isso não é cron nem publica dados no CMS.

No calendário CBDV, os cartões não afirmam nem negam participação do
IERC-RN. A explicação geral ressalta que o calendário, isoladamente,
não comprova quais equipes participaram.

## Nova coleção Strapi

A coleção é criada por `cms/schemas.mjs`, via o gerador já existente
`cms/scripts/generate.mjs`. O prefixo REST é
`/api/sport-competitions`. Campos:

| Campo | Uso |
| --- | --- |
| `title` (obrigatório) | Nome oficial da competição |
| `slug` (obrigatório) | Identificador único para o CMS |
| `summary` (obrigatório) | Descrição pública aprovada |
| `sportModality` (obrigatório) | Goalball ou outra modalidade |
| `startsAt` (obrigatório) | Data/hora inicial, com fuso explícito |
| `endsAt` | Data/hora final |
| `location` | Local confirmado |
| `organizer` | Entidade organizadora |
| `calendarLabel` | Referência do calendário, ex.: `2027 / Goalball` |
| `participationStatus` | `nao_confirmada` (padrão) ou `confirmada` |
| `sourceName`, `sourceUrl` | Referência externa verificável, se houver |
| `approvalReference`, `approvalNote` | Registro interno da aprovação |
| `editorialStatus` | `em_preparacao`, `em_revisao`, `aprovado` |
| `image`, `imageAlt`, `imageCredit`, `imageRightsStatus`, `imageRightsProof` | Mídia opcional, sob validação de direitos |

`Draft & Publish` permanece ativo; a API de leitura do portal recebe
somente registros **publicados e com `editorialStatus=aprovado`**.
O token do portal deve ser **somente leitura** e ter exclusivamente as
permissões de `find` necessárias para essa coleção. Sem token/permissão,
a área manual mostra um estado vazio, nunca um rascunho.

`participationStatus=confirmada` somente será exibido como confirmado
se existir `approvalReference` não vazia. O editor deve registrar
a referência institucional legítima, não inventar comprovação.
Um registro editorial manual com mesmo título/data do calendário CBDV
é priorizado na visualização para evitar duas cópias.

## Como cadastrar após o CMS DEV atualizado

1. Entrar no Strapi ADMIN DEV (via encaminhamento já configurado).
2. Content Manager → **Competições esportivas** → Create new entry.
3. Preencher título, slug, resumo, modalidade, início, término,
   local, organização e, se aplicável, agrupamento `calendarLabel`.
4. Usar `nao_confirmada` como participação inicial. Para
   `confirmada`, registrar referência de aprovação no campo
   `approvalReference` e validá-la com a coordenação.
5. Informar `sourceName`/`sourceUrl` quando houver fonte externa.
   Sem fonte externa, documentar a confirmação institucional em
   `approvalNote` sem expor dados pessoais desnecessários.
6. Salvar primeiro como rascunho. Após revisão, marcar
   `editorialStatus=aprovado` e publicar.
7. Conferir o registro em `/esportes`, na seção
   **Competições informadas pelo IERC-RN**.
   Não será exibido automaticamente em `/eventos`, porque o
   cadastro esportivo foi separado da agenda institucional.

Para cadastrar um *calendário* de várias competições, criar uma
entrada por competição e usar o mesmo `calendarLabel`/ano.
Importação em lote ainda não foi implementada.

## Migração DEV: ainda NÃO executada

A captura fornecida pelo operador mostra que o Strapi em execução
ainda tem a coleção antiga **Eventos**, sem campos esportivos.
Portanto, a nova coleção **não aparecerá no painel antes de implantar
a versão atualizada do CMS DEV**.

A migração adiciona uma coleção/tabela, não somente campos opcionais.
O script read-only de schemas atual
`cms/scripts/check-deployed-schema.mjs` classifica como
`source_content_type_not_deployed` uma coleção nova.
**Esse alerta exige revisão manual e não significa que se deva
forçar uma atualização ou ignorá-lo.** O comparador não analisa
o catálogo de tabelas SQL nem aprova migrações.

Sequência segura antes de reconstruir o CMS:

1. Identificar a instância DEV e verificar que o `main`/PROD não será tocado.
2. Realizar e verificar backup do PostgreSQL **e** das mídias do Strapi,
   com `scripts/backup-cms-dev.sh` e o procedimento de restauração.
3. Capturar schemas atuais do contêiner com `docker cp` para uma
   pasta temporária segura; executar `node cms/scripts/check-deployed-schema.mjs
   --schema-root <pasta>/api` e revisar todos os `hazards`.
4. Confirmar que o modelo **Eventos** implantado coincide com o modelo
   preservado na fonte e que a única coleção nova esperada é
   `sport-competition`. Qualquer outra diferença exige correção antes
   de avançar.
5. Verificar permissões, tabelas e migração com cópia isolada/sandbox
   da base DEV e estratégia de rollback. Não confiar exclusivamente
   na comparação JSON.
6. Apenas após homologação, atualizar o CMS DEV existente sem apagar
   volumes; gerar schemas, testar health, registros e editor.
7. Conceder ao token restrito do portal a permissão de leitura necessária
   para `sport-competitions`, **sem create/update/delete**.
8. Confirmar cadastro de rascunho invisível, aprovação/publicação visível,
   e impossibilidade de ler rascunhos via endpoint público do portal.

**Nunca executar `docker compose down -v`.** Não reconstruir ou
alterar Strapi PROD, PostgreSQL PROD, worker IA, Redis ou `main`.
PR #12 deve continuar Draft até a homologação da nova coleção.

## Evidência operacional do preflight no MiniMac — 12/11/2026

No commit `96c34fd`, o operador confirmou:

- `scripts/backup-cms-dev.sh`: dump + mídias + segredos em área privada,
  restauração testada com **49 tabelas públicas** no banco descartável;
  diretório `cms-backups/dev-20261112T010249Z`;
- `sha256sum`: `BACKUP_INTEGRITY_OK`;
- Comparador de schemas em `node:22-alpine` com Docker `--network none`:
  `manual_review_required`, exatamente **um** hazard:
  `source_content_type_not_deployed: sport-competition`, sem outras
  adições, mudanças ou remoções de modelos existentes, `PREFLIGHT_EXIT=3`;
- SQL `BEGIN READ ONLY`: **49 tabelas**, `ierc_sport_competitions=ABSENT`,
  `ierc_events` presente.

**Conclusão:** somente a nova coleção está ausente no schema declarativo e
no catálogo SQL; isso **não é aprovação para migrar diretamente no banco
DEV**, mas atende ao gate preliminar de integridade e compatibilidade dos
modelos. O preflight não simula os efeitos das migrações do Strapi no banco.

### Ensaio da migração em sandbox descartável

O script versionado `scripts/rehearse-cms-sports-dev.sh` faz uma
restauração de **cópia do backup verificado** e inicia um CMS candidato
**somente** contra esse clone:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/rehearse-cms-sports-dev.sh cms-backups/dev-20261112T010249Z
```

Proteções: exige branch `dev`, manifestos e checksums, CMS/DB originais
saudáveis, rede Docker **`--internal`** exclusiva e sem portas publicadas;
a imagem é construída a partir do código atualizado, `cms/.dockerignore`
exclui `.env`, e os segredos só são injetados no contêiner sandbox em
tempo de execução. Endereço/usuário/senha de banco são sobrepostos para
o Postgres descartável. Se o ensaio falhar, o script aborta e remove os
contêineres e a rede temporários, sem tocar no Strapi DEV real.

**Critérios de sucesso:** `SANDBOX_REHEARSAL=PASS`,
`SANDBOX_NEW_SPORT_COLLECTION=CREATED`,
`SANDBOX_EXISTING_TABLES=PRESERVED`,
`SANDBOX_EVENT_ROWS=PRESERVED`,
`LIVE_DEV_CONTAINERS=UNCHANGED`,
`SANDBOX_CLEANUP=COMPLETE`.
O ensaio não concede permissões no Strapi real nem publica eventos.

Mesmo um PASS ainda requer autorização operacional para reconstruir o
CMS DEV real, revisar as permissões estritas do token, confirmar o
formulário e cadastrar a primeira competição real. A coleta externa CBDV
é independente. Não criar servidores ou bancos de produção.

### Resultado do primeiro ensaio MiniMac — correção da comparação de tabelas

Na execução do operador em 11/11/2026 (BRT), commit `6e69399`:

- `BACKUP_INTEGRITY=OK` e `LIVE_CMS_AND_DB=HEALTHY`;
- `SANDBOX_TABLES_BEFORE=49`;
- imagem candidata Strapi foi construída (`CANDIDATE_IMAGE_BUILT=YES`);
- o script chegou à comparação final depois das checagens de saúde,
  criação da nova tabela, presença da tabela de eventos e contagem das
  linhas de eventos; esses passos não emitiram erro;
- `comm` acusou `file 1 is not in sorted order` e
  `file 2 is not in sorted order`;
- `SANDBOX_CLEANUP=COMPLETE` confirma a execução da rotina de limpeza
  dos recursos temporários.

**Não interpretar a saída como migração validada**, pois
`SANDBOX_REHEARSAL=PASS` não foi emitido. As mensagens de `comm`
decorrem da dependência do comparador anterior na ordenação/collation
das listas; não são evidência de perda de tabelas.

A verificação foi substituída por `cms_tables_preserved` em
`scripts/lib/cms-table-preservation.sh`: busca correspondência exata
de cada nome original na lista posterior, independentemente da ordem,
com rejeição de nomes malformados ou tabelas ausentes. O teste offline
`scripts/tests/test-cms-table-preservation.sh` cobre entradas
reordenadas, nomes semelhantes e tabelas faltantes e é executado no CI.

**Próximo gate:** repetir o ensaio com o HEAD corrigido e obter todas
as linhas `SANDBOX_...=PASS` e `LIVE_DEV_CONTAINERS=UNCHANGED`
antes de sequer planejar o deploy no Strapi DEV real. O backup original
continuará sendo usado e não deve ser compartilhado nem commitado.

## Gates de aceitação

- [ ] CI completo aprovado no HEAD da branch `dev`.
- [ ] Backup e preflight reais no MiniMac DEV sem diferenças inesperadas.
- [ ] Nova coleção aparece no Strapi DEV, Eventos antigos preservados.
- [ ] Token público restrito lê apenas competições aprovadas e publicadas.
- [ ] Um campeonato real cadastrado e conferido na página `/esportes`.
- [ ] Datas, deduplicação e calendário CBDV preservados.
- [ ] Revisão de acessibilidade manual e responsividade.
