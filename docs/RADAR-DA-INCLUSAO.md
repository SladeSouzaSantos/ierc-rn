# Radar da Inclusão — apresentação e governança editorial

## Objetivo

O Radar da Inclusão é uma área separada do portal IERC-RN destinada a **sínteses originais, em português, de publicações externas** sobre deficiência visual, educação inclusiva, tecnologia assistiva, acessibilidade e esporte adaptado. Não representa notícias, eventos, projetos, parcerias nem resultados do Instituto.

**Status (DEV, 10/11/2026):** a primeira notícia da Perkins foi gerada como Draft, revisada e **publicada manualmente pelo operador**. A branch `dev` adicionou três frentes distintas: reportagens diretamente sobre o IERC-RN, notícias nacionais de inclusão e iniciativas internacionais. Novos exemplos externos verificados são atribuídos à fonte e não simulam comunicados do Instituto. A publicação automática permanece desativada, pendente de homologação local dos feeds, análise de direitos por artigo, backup e token segregado.

## Rotas e fonte dos dados

- `/noticias`: notícias institucionais do CMS, uma seção separada **“IERC-RN na imprensa”** para reportagens externas com `scope=local` que mencionem explicitamente o Instituto, e seis referências históricas verificáveis de terceiros. Apresenta chamada para o Radar.
- `/radar-da-inclusao`: somente artigos externos com `scope=brasil` ou `scope=internacional`, **publicados e editorialmente aprovados**, com fonte identificada e `sourceUrl` HTTPS; grupos visuais “Iniciativas e direitos no Brasil” e “Experiências internacionais”. A origem de terceiros nunca é convertida em ação do IERC-RN.
- `/noticias/[slug]`: detalhe publicado/aprovado, identifica a origem e o processo de IA. Notícias `scope=local` voltam para `/noticias`; notícias nacionais e internacionais voltam ao Radar.
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


## Atualização de fontes e revisão integral — 10/11/2026

O catálogo dispõe agora de feeds da **Agência Brasil (EBC)** e da **Comissão Europeia**, com políticas públicas de reutilização registradas e uma etapa de autoria/condições por artigo antes de extrair textos. A geração de sínteses e revisão por IA fundamentadas na matéria integral só são elegíveis quando a política e o conteúdo da página forem confirmados; páginas de agências parceiras ou sem direitos ficam retidas. **Perkins/WAI continuam apenas como prévias/editorial sem autorização de publicação autônoma baseada em texto integral.** O indicador de IA distingue revisão humana de revisão automática com evidências.

O comando `review:full-preview` consulta Redis/CMS para descartar duplicatas, examina apenas fontes elegíveis e valida blocos textuais sem gravar notícias. A automação de publicação ainda requer homologação na instância DEV, acesso separado de escrita, backup restaurável e decisão editorial expressa. Consulte [FONTE-INTEGRAL-REVIEW-DEV.md](FONTE-INTEGRAL-REVIEW-DEV.md) e a [issue #14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14).


## Ordem cronológica dos cartões — 10/11/2026

Os seis registros da seção **Registros publicados sobre o IERC-RN** em `/noticias` são apresentados por `dateTime` no formato ISO, **mais recentes primeiro**: 05/11/2026, 18/08/2026, 18/07/2026, 15/04/2026, 27/03/2026, 16/09/2025. O comparador está em `lib/news-order.ts`; a lista original `clippings` não é alterada, e a ordenação é aplicada em `components/editorial-records.tsx`.

O mesmo comparador é utilizado nas listas CMS em `components/cms-public.tsx`, separadamente para notícias institucionais, **IERC-RN na imprensa**, **Radar Brasil** e **Radar internacional**. Notícias com `date` inválida ou ausente ficam ao final da respectiva lista. Notícias na mesma data preservam a ordem de origem. Isso não altera a data original ou o fluxo de aprovação no Strapi.

Proteções de regressão: `tests/sprint2-content.spec.ts` verifica as seis datas na ordem visual correta na rota `/noticias`; `tests/news-order.spec.ts` confere cronologia ISO, manutenção da lista original, datas faltantes e empates. Não é necessária migração do CMS nem alteração de conteúdos existentes.

**Homologação da coleta expandida no Windows:** o operador aprovou **135/135 testes** e confirmou `feed_checked` com dez itens em cada um dos novos RSS EBC Justiça, Política, Saúde e Geral, sem notícias pertinentes nesses lotes (`no_matching_topics`), além da suspensão EU registrada por `source_paused`. Esta é uma validação de conectividade e de filtro, não uma varredura do arquivo histórico de 120 dias. A publicação automática segue desativada.
