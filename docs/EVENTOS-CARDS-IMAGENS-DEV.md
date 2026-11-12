# IERC-RN — Cartões de Eventos: imagens autorizadas e espaçamento (DEV)

Atualizado em 12/11/2026. Implementação preparada na branch `dev`,
sem alterações no Strapi 5, no PostgreSQL ou em `main`.

## Mudança visual

A seção **Programação da instituição** em `/eventos` separa melhor os
grupos **Em andamento**, **Próximos eventos** e **Eventos realizados pelo
Instituto**. O espaço antes dos grupos e entre eles é responsivo. Cartões
com imagem autorizada usam duas colunas: **convite à esquerda e detalhes
à direita** em telas maiores que 540 px. Abaixo disso, o convite fica
acima dos detalhes para manter o texto legível e evitar rolagem horizontal.

As artes de convite podem ter texto importante. Por isso, a área de imagem
usa `object-fit: contain`, **sem recortar o convite**. Dados essenciais
(título, data, local) permanecem em texto HTML adjacente à imagem e
disponíveis a leitores de tela. Se o evento não tem imagem válida, o
cartão exibe apenas texto, sem imagem quebrada ou espaço reservado.

## Preenchimento no Strapi

Acesse **Content Manager → Eventos → editar o registro publicado**.

1. No campo `image`, anexar a imagem do convite ou da atividade.
2. Em `imageAlt`, descrever de maneira breve a imagem e o que ela
   comunica. Não depender apenas da imagem para divulgar datas e local.
3. Em `imageRightsStatus`, selecionar **`autorizado` somente após
   confirmação da autorização/cessão para exibição pública**.
4. Em `imageRightsProof`, registrar a referência da autorização.
   Não inventar comprovação, nem publicar fotos de pessoas sem verificar
   o consentimento adequado (especial atenção a crianças).
5. Em `imageCredit`, registrar autoria/crédito quando conhecido.
6. Manter `editorialStatus=aprovado` e clicar em **Publish** após
   aprovação da presidência. Se o registro já está publicado, salvar
   e publicar as alterações conforme o fluxo da versão do Strapi.
7. Conferir `/eventos` após revalidação do CMS (cerca de 60 s);
   inspecionar a imagem em desktop e celular.

Para a **Festa Natalina 2026**, o arquivo WebP foi disponibilizado
separadamente ao operador para upload. Ele **não foi automaticamente
inserido no Strapi**. Para os registros fictícios de homologação,
despublicar/apagar após conferência — **não mantê-los em produção**.

## Segurança e integração

- `getCmsEvents()` consulta `/api/events` incluindo
  `populate=image`, mantendo **`status=published` e
  `editorialStatus=aprovado`**. Se o token de leitura não permitir
  popular mídia, a função tenta recuperar os eventos somente com texto
  para não apagar a agenda.
- `lib/event-media.ts` ignora imagem de status `pendente` ou
  `restrito` e requer `imageAlt` e arquivo de imagem do diretório
  `/uploads` do Strapi. Bloqueia SVG, PDF, URLs externas, parâmetros
  de URL e diretórios ascendentes.
- O HTML mostra um caminho do próprio portal:
  `/api/event-image/[slug]`. Essa rota consulta novamente o evento
  publicado/aprovado, só serve um upload autorizado do CMS configurado,
  valida MIME/tamanho (máximo 8 MiB) e envia `no-store`/
  `nosniff`. **Nunca envia ao navegador o token privado ou o
  hostname interno `cms:1337`.** O proxy não aceita URL livre.
- Se a autorização for revogada e o registro deixar de ser elegível,
  novas requisições ao proxy são negadas. Há cache de leitura do CMS
  por até 60 s, portanto a retirada pode não ser instantânea.

## Gates DEV

- [ ] CI Push e PR verdes no HEAD da implementação.
- [ ] Aplicar somente `portal` DEV no MiniMac.
- [ ] Confirmar imagem autorizada da Festa Natalina no cartão.
- [ ] Confirmar ausência de imagem quando `imageRightsStatus`
      está `pendente` e quando `image` não foi anexada.
- [ ] Confirmar que a imagem aparece à esquerda e o conteúdo à
      direita em desktop/tablet, sem recortar o convite.
- [ ] Confirmar empilhamento abaixo de 541 px e cartões sem imagem
      ocupando toda a largura, sem espaço em branco.
- [ ] Confirmar cartões antigos com texto, Datas/Local/Alt e
      acessibilidade de teclado, leitor de tela e reflow 320–1440 px.
- [x] Adicionar cobertura Playwright para layout lateral em desktop,
      cartão sem imagem e reflow a 375 px (execução depende do CI).
- [ ] Confirmar ausência do evento fictício de teste na agenda pública.
- [ ] Preservar Strapi, banco, Redis, worker da curadoria e `main`.

Comandos operacionais após CI verde:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
git rev-parse --short HEAD
docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml up -d --build --no-deps portal
docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml ps
```
