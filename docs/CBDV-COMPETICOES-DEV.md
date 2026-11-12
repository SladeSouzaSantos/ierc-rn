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

## Gates de aceitação

- [ ] CI completo aprovado no HEAD da branch `dev`.
- [ ] Backup e preflight reais no MiniMac DEV sem diferenças inesperadas.
- [ ] Nova coleção aparece no Strapi DEV, Eventos antigos preservados.
- [ ] Token público restrito lê apenas competições aprovadas e publicadas.
- [ ] Um campeonato real cadastrado e conferido na página `/esportes`.
- [ ] Datas, deduplicação e calendário CBDV preservados.
- [ ] Revisão de acessibilidade manual e responsividade.
