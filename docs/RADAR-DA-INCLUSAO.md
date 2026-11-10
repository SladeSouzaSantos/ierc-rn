# Radar da Inclusão — apresentação e governança editorial

## Objetivo

O Radar da Inclusão é uma área separada do portal IERC-RN destinada a **sínteses originais, em português, de publicações externas** sobre deficiência visual, educação inclusiva, tecnologia assistiva, acessibilidade e esporte adaptado. Não representa notícias, eventos, projetos, parcerias nem resultados do Instituto.

**Status (DEV, 10/11/2026):** a primeira geração real de IA criou **um** registro como `Draft` na coleção `News-article`; as capturas confirmaram `editorialStatus=em_revisao`, `aiAssisted=true`, `imageRightsStatus=pendente`, fonte, URL original e chave de deduplicação. A página pública exibida não mostrou o rascunho. Ele segue **não publicado** e depende de edição/revisão humana.

## Rotas e fonte dos dados

- `/noticias`: comunicados institucionais do CMS (origem diferente de `externa`) e recortes externos **sobre o IERC-RN**, cujo vínculo com o Instituto é explicitado e documentado; apresenta chamada para o Radar.
- `/radar-da-inclusao`: exclusivamente `news-article` com `originType=externa`, **publicado**, `editorialStatus=aprovado`, `sourceName` e `sourceUrl` HTTPS. Não mescla a fonte externa à identidade institucional.
- `/noticias/[slug]`: detalhe que só é retornado quando o mesmo contrato de publicação e aprovação é cumprido. Se a origem for externa, identifica-a como Radar, mostra a origem e, se `aiAssisted=true`, informa o uso assistido de IA; o link de retorno vai para `/radar-da-inclusao`.
- `lib/cms.ts`: `find()` consulta o Strapi **somente no servidor** com `status=published` e `filters[editorialStatus][$eq]=aprovado`, e revalida o status após receber os dados. Sem credenciais ou com falha, retorna lista vazia, não mostra drafts e não expõe `CMS_READ_TOKEN`.
- `components/cms-public.tsx`: cartões do Radar incluem título, resumo, categoria, data quando disponível, **fonte externa identificada**, link para síntese e para publicação original; `aiAssisted` é explicitado. Quando não há material aprovado, exibe estado editorial vazio, sem notícias fictícias.

O token `CMS_READ_TOKEN` é dedicado à leitura Next.js e fica em `.env.local`; o token `CURATOR_STRAPI_DRAFT_TOKEN` fica em `curator/.env` exclusivamente para a homologação de rascunhos. **Nunca colocar os valores no repositório ou em variáveis `NEXT_PUBLIC_`.**

## Processo de publicação

1. Coleta de fontes verificadas, respeitando as políticas e restrições de cada fonte.
2. Síntese editorial da IA gratuita, baseada **somente no título e resumo RSS**, sem alegações sobre trechos não lidos da matéria original; se não houver evidências suficientes, `skip:true`.
3. Persistência no Strapi **como Draft** (`status=draft`, `editorialStatus=em_revisao`), com `sourceName`, `sourceUrl`, `originalTitle`, `originalPublishedAt`, `dedupeKey`, `aiAssisted` e direitos de imagem pendentes.
4. Revisão humana da reportagem **integral** e conferência de fatos, atribuição, ortografia, tradução, título, data e originalidade. Não tratar ausência de informação no RSS como ausência de evidência no artigo original.
5. A publicação precisa de ação editorial manual: corrigir o texto, definir `editorialStatus=aprovado` e clicar em **Publish** no Strapi. Ambos são necessários para exibição. Não alterar a permissão de publicação do token da curadoria.
6. Depois de publicado, validar a presença na página do Radar, a fonte externa, a não atribuição de resultados ao IERC-RN, o comportamento no leitor de tela, teclado e celular, e a ausência de regressão nas notícias institucionais.

**Nenhuma publicação ou agendamento automático foi ativado.** O worker conserva `CURATOR_ENABLED=false` e `CURATOR_WRITE_DRAFTS=false` nos arquivos locais e não há autorização para PROD.

## Categorias de síntese

A saída `category` da LLM é normalizada em `curator/src/editorial.mjs` **antes** do pré-visualizador ou persistência: `Esporte adaptado`, `Educação inclusiva`, `Tecnologia assistiva`, `Direitos e acessibilidade`, `Cultura e participação` e `Inclusão e acessibilidade` (categoria genérica). Sinônimos como `esporte`, `esportes adaptados` e `esporte e lazer` convergem para `Esporte adaptado`. Essa regra **não modifica rascunhos existentes** e não altera o schema do Strapi.

## Homologação DEV

```powershell
git switch dev
git pull --ff-only origin dev
npm install
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run --prefix curator test
```

Visitar `http://localhost:3000/noticias` e `http://localhost:3000/radar-da-inclusao`. Com CMS desligado ou sem notícias externas aprovadas, a página Radar deve mostrar **Conteúdos em revisão editorial** sem cards fictícios. Rascunhos em `em_revisao` e `publishedAt=null` nunca podem aparecer na interface, nem em detalhe público `/noticias/[slug]`. Os testes Playwright/axe fazem verificações automatizadas e **não substituem** navegação manual com NVDA/VoiceOver/TalkBack.

Antes de encerrar a Sprint 3.2, revisar o primeiro rascunho da Perkins, validar links, política de uso e fontes e criar backup pós-migração do PostgreSQL (preservando `cms-backups/ierc-before-curator.dump`). Considerar revogar o token Custom temporário após concluir a homologação.

Referência de implementação: [Sprint 3.2 — Curadoria](CURADORIA-SPRINT3-2.md), issue [#13](https://github.com/SladeSouzaSantos/ierc-rn/issues/13). `main` e o Draft PR #12 permanecem inalterados.
