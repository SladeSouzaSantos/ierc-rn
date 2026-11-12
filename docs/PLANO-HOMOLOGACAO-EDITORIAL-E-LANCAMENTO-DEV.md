# IERC-RN — Plano de homologação editorial e preparação do lançamento

**Criado em 12/11/2026.** Uso operacional no ambiente `dev`.
Este documento organiza os gates **pendentes**; não equivale a autorização
para liberar produção, abrir domínio ou executar merge.

## Status verificado

- `dev` no GitHub: `1736a18d7d8428436ffde8c93b740e94cc8649d0`.
  Workflows de push e PR concluídos com `success` para este commit.
- `main` preservada: `ffc9cf033746614c3bd85b88dd9c0d4a9ee2e3e4`.
  PR #12 ainda Draft; **sem merge**.
- CMS Strapi DEV com oito coleções e PostgreSQL (49→50 tabelas) homologado
  tecnicamente em 12/11. Coleção Competições esportivas e API privada com
  HTTP 200 autenticado; API anônima HTTP 401.
- Captura do operador mostrou competição **fictícia** publicada em
  `/esportes`. Sua retirada da publicação ainda deve ser confirmada.
- O monitor somente leitura e o worker de IA são contêineres independentes;
  código possui modo opt-in de publicação automática no DEV. **Ainda falta
  prova ponta a ponta de publicação automática real**, distinta da
  matéria da Perkins publicada manualmente.

## Etapa 1 — Gestão editorial na prática (sem novas migrações)

Responsáveis: um **Autor**, um **Editor**, e um responsável institucional
por confirmar fatos. O Editor não deve compartilhar conta/senha; a equipe
não precisa de Docker, SQL nem tokens de API.

1. Revisar e, se ainda existir, **despublicar o teste fictício**
   `teste-torneio-goalball-2026`. Confirmar ausência em `/esportes`
   após cache (o portal usa revalidação de 60 segundos).
2. Em Strapi DEV, cadastrar uma **notícia institucional real**:
   `originType=institucional`, título/slug/resumo, fonte interna
   documentada, `editorialStatus=em_preparacao` e `Draft`.
   Verificar invisibilidade em `/noticias`; aprovar e publicar
   apenas após a coordenação confirmar os fatos. Confirmar card e
   página individual em `/noticias/[slug]`.
3. Em **Eventos**, repetir Draft→aprovação→Publish com um evento
   real, data/local corretos, inscrição somente por URL oficial
   validada. Conferir `/eventos` em categorias futuro/andamento/passado.
4. Em **Competições esportivas**, testar com competição real, modalidade
   e organizador; `participationStatus=nao_confirmada` por padrão.
   Apenas selecionar `confirmada` com `approvalReference` real
   e aprovação expressa. Conferir `/esportes` e ausência de
   duplicidade com evento CBDV de mesmo título/data.
5. Testar edição de título/resumo/data em registro aprovado e publicado,
   confirmar resultado visual e URL/slug corretos; depois **Unpublish**
   e conferir desaparecimento. **Delete** somente se houver registro
   de autorização/necessidade, porque é destrutivo.
6. Perfis: verificar que Autor consegue criar/editar **Draft** mas não
   publicar, e que somente Editor autorizado publica/despublica.
   Restringir a coleção, mídias e configurações conforme função.
7. Confirmar no Strapi → Settings → API Tokens que o token do portal
   é do tipo **Read-only** ou **Custom somente find** para coleções
   necessárias. Nenhum create/update/delete nem acesso público irrestrito.
   Os tokens do curador são separados e de escopo mínimo.
8. Dar o Manual Strapi de preenchimento PDF à equipe e fazer um treino
   assistido com teclados/leitores de tela. Conferir formulário e
   mensagens de erro sem depender de visão.

**Critério de aceite:** 3 conteúdos reais com prova de origem/aprovação
e ciclo Draft→Publicado→Editado→Despublicado evidenciado; autor sem
privilégio de publicação; sem registros fictícios visíveis.

## Etapa 2 — Operação de notícias automáticas (sem desligar a rotina)

- Não confundir o monitor read-only (relatório de feeds) com o worker
  que pode escrever/publicar no Strapi. **Não desligar** a automação
  DEV já autorizada durante testes de CMS/editorial.
- Confirmar um caso real do worker: `draft_created`, revisão de
  evidência de artigo completo autorizado, `draft_published` e
  conteúdo visível no Radar. `count:0` não comprova publicação.
- Validar títulos/datas/fontes, direitos, idioma, sem alegações de
  vínculo com o IERC-RN; verificar `approvalReference`, rastreio e
  qualidade com revisão humana amostral.
- Testar **Unpublish** de uma matéria automática incorreta e
  confirmar desaparecimento após cache. Investigar o risco de
  republicação apenas se houver evidência; não alterar flags
  de produção nem o código sem homologação.
- Conferir logs dos três horários (08h, 13h, 19h America/Fortaleza),
  falhas/quarentena de fontes, limite de chamadas gratuitas e
  ausência de vazamento de tokens ou conteúdo sensível.

**Critério de aceite:** pelo menos uma execução real rastreável e
aprovada, com teste de retirada do ar, sem ampliar fontes cuja licença
ainda não foi validada. Issues #14, #13, #17 e #18.

## Etapa 3 — Segurança, domínio e recuperação

Domínios escolhidos para planejamento: `dev.iercrn.org.br`,
`iercrn.org.br`, `strapi-dv.iercrn.org.br` e
`strapi.iercrn.org.br`. **Escolha de domínio não prova DNS/HTTPS ativos**.

- Antes de expor qualquer Strapi, configurar HTTPS e autenticação
  adicional no hostname inteiro (ex.: Cloudflare Access), incluindo
  `/admin`, `/api` e uploads conforme política. Não permitir que
  a regra de acesso seja contornada por uma rota alternativa.
- Criar credenciais individuais para funcionários e habilitar MFA no
  provedor de acesso, quando disponível. Princípio do menor privilégio.
- Manter Postgres/Redis sem portas públicas; CMS/portal ligados à rede
  privada adequada; confirmar headers, rate limiting e erros sem dados.
- Provar **backup fora do host, cifrado**, abrangendo dump, uploads e
  segredos, e restauração em sandbox. Não enviar os backups ao chat.
- Preparar ambientes, tokens, imagens, volumes e recuperação
  **independentes** para PROD. Não reutilizar `.env` DEV.
- Verificar status DNS/TLS/Access no ambiente real; não presumir
  pronto apenas por o painel abrir em `localhost`.

**Critério de aceite:** hostname privado protegido, backup/restore
registrados, permissões adequadas; issue #16.

## Etapa 4 — Conteúdo e acessibilidade

- Validação oficial de história, missão, equipe, horários, contatos,
  Bazar Solidário, visitas e imagens; sem publicar dados não confirmados.
- Conferir direitos de imagens, consentimento dos retratados e descrição
  `imageAlt` contextual. Evitar nomes/dados pessoais sem autorização.
- Testes humanos com teclado, NVDA/VoiceOver/TalkBack, links focáveis,
  zoom 200% e 400%, modo alto contraste e movimento reduzido.
- Testar mobile e desktop de `/noticias`, `/eventos`,
  `/esportes`, `/radar-da-inclusao` e formulário Strapi.
- Verificar rotas realmente integradas ao CMS: Notícias, Eventos,
  Competições esportivas, Atividades e Trajetórias de atletas.
  A existência das coleções Galerias, Registros de mídia ou
  Configurações institucionais **não significa que todas as partes
  da página já são dinâmicas**; conferir integração antes de prometer
  publicação automática desses conteúdos.

**Critério de aceite:** checklist assinado pelo IERC e testes manuais
com tecnologias assistivas; issues #6, #7, #1.

## Etapa 5 — Release controlada

- Somente após gates: auditar alterações do PR #12, validar CI do SHA
  exato, obter aprovação institucional, realizar backup/release tag
  e plano de rollback documentado.
- Fazer merge de `dev` para `main` **apenas mediante autorização**;
  não forçar divergências nem usar o DEV como banco de produção.
- Implantar PROD com Compose, rede, DB, uploads e segredos segregados,
  verificar saúde, DNS/TLS, listas e permissões, e usar uma janela de
  monitoração pós-lançamento.
- Não ativar a publicação automática de IA no PROD antes de autorização
  explícita e homologação própria.

**Critério de aceite:** site público com assinatura editorial do IERC,
sem notícias fictícias, serviços saudáveis e rollback comprovado.

## Matriz para registrar homologação

| Gate | Estado em 12/11/2026 | Evidência que falta |
| --- | --- | --- |
| Nova coleção de esportes no Strapi DEV | Aprovado | Nenhuma da migração |
| Leitura privada de esportes via portal | Aprovado | Escopo mínimo dos tokens |
| Renderização de competição manual | Captura recebida | Conteúdo real/sem teste |
| Workflow editorial Author→Editor | Parcial | Draft, edição e Unpublish completos |
| Notícias automáticas DEV | Ativo, teste E2E pendente | `draft_published` de notícia real |
| Painel no domínio oficial com HTTPS/Access | Não comprovado | DNS/TLS/Access |
| Auditoria de direitos e acessibilidade | Pendente | Revisão institucional e testes humanos |
| Aprovação PR #12 / release PROD | Bloqueado | Gates + autorização |

Links: [issue #19](https://github.com/SladeSouzaSantos/ierc-rn/issues/19),
[CMS #8](https://github.com/SladeSouzaSantos/ierc-rn/issues/8),
[deploy #16](https://github.com/SladeSouzaSantos/ierc-rn/issues/16),
[IA #14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14).
