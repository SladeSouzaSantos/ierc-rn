# Radar da Inclusão — verificação com texto integral e evidências (DEV)

**Status em 10/11/2026:** implementação experimental na branch `dev`, testes com HTML sintético e proteção ativa. **Nenhuma fonte atual está autorizada para extração automática do artigo completo.** Nenhuma notícia foi criada, modificada ou publicada nesta implementação. A `main`, o PR #12 e o agendador não foram alterados.

## Motivo da mudança

A prévia anterior selecionou uma matéria inédita da Perkins sobre CVI, mas a segunda IA retornou `unverifiable_evidence_quotes`. Ambas as chamadas verificavam apenas título e resumo do RSS; a aprovação a partir do RSS não prova que o conteúdo da reportagem completa sustenta as afirmações. O novo leitor permite avaliar trechos textuais extraídos da **mesma página de origem**, somente se houver permissão de acesso automatizado documentada.

### Fontes e restrições reais

- **Perkins:** os [termos e condições](https://www.perkins.org/terms-conditions/) reservam a propriedade do conteúdo e **excluem coleta automatizada/data mining/robôs da licença de acesso**. O acesso automatizado à reportagem integral permanece bloqueado; o RSS autorizado como fonte do curador não autoriza, por si só, extração da página.
- **W3C/WAI:** a [política de reutilização do material](https://www.w3.org/WAI/about/using-wai-material/) exige atribuição, link e, para a maioria dos documentos, **proíbe modificações/adaptações** sem licença adicional aplicável. Não habilitamos a extração e geração derivada de qualquer página WAI genericamente.
- **RNIB, IBSA e WBU:** permanecem fora do conjunto de fontes aptas para geração/publicação automática, conforme política já homologada.
- **Licença e evidências de direito:** uma exceção futura requer **autorização escrita específica**, revisão editorial dos termos e referência documentada. Mudar uma variável de ambiente **não** concede autorização de uso.

No `curator/src/feeds.mjs`, nenhum item de `SOURCES` possui `fullTextAccess`; por isso, o `fetchArticleEvidence` falha **antes de qualquer chamada HTTP**, com `source_permission_pending`. Em futura autorização válida, o Editor poderá registrar e revisar no catálogo, via alteração de código auditável, uma entrada do formato:

```javascript
fullTextAccess: {
  status: 'approved',
  basis: 'written-permission',
  reference: 'https://.../referencia-da-autorizacao',
  verifiedDate: 'AAAA-MM-DD',
}
```

O exemplo **não deve ser copiado para Perkins/WAI sem autorização real** e não se destina a ser configurado por usuário final no arquivo `.env`.

## Arquitetura

1. `curator/src/duplicate-check.mjs`: consulta de notícias já processadas no Redis e Strapi Draft/Published antes de consumir IA (sem escrever no CMS).
2. `curator/src/article-evidence.mjs`: somente com permissão formal documentada, valida HTTPS, host **exato** aprovado, ausência de credenciais/portas alternativas, um redirecionamento no mesmo documento; força `Accept:text/html`, desabilita redirecionamento automático, aplica timeout, tamanho máximo de resposta (340 kB), ignora scripts, imagens, iframes, navegação e formulários. Para não presumir conteúdo completo, recusa páginas sem estrutura textual suficiente ou que excedam o limite (12.000 caracteres/45 blocos). Não faz download de mídia.
3. Os parágrafos e subtítulos extraídos são rotulados `E01, E02, ...`, mantidos apenas durante a execução e associados a SHA-256 do texto. **Não armazenar o texto integral de terceiro no banco, logs ou relatórios públicos.**
4. `curator/src/full-article-review.mjs`: primeira LLM redige uma síntese ORIGINAL usando apenas esses blocos; a segunda LLM revisa fatos, tradução e atribuição, exigindo **duas citações literais distintas, presentes em blocos diferentes**. A checagem é determinística sobre os blocos exatos enviados, sem confiar apenas na declaração da IA.
5. `curator/src/pipeline.mjs`: `review-full-preview` (script npm `review:full-preview`) exige seleção de inéditas e leitura de fonte autorizada antes de geração ou revisão. Na falta de permissão ou evidências, retorna `article_evidence_unavailable`, com código sanitizado (`source_permission_pending`, `article_text_incomplete`, etc.) e **não aciona a IA**. O modo RSS anterior `review:preview` permanece para prévias editoriais limitadas, sem poder autorizar publicação.
6. O modo `autoPublish` só pode ser habilitado no DEV com `CURATOR_FULL_ARTICLE_REVIEW_ENABLED=true` e a nova autorização explícita `CURATOR_AUTO_PUBLISH_ACK=FULL_ARTICLE_REVIEW_ACCEPTED`. O valor antigo `RSS_ONLY_REVIEW_ACCEPTED` é recusado. `curator/src/editorial.mjs` também recusa publicação sem `fullArticleEvidence`. `curator/src/cms-publish.mjs` rejeita auditorias RSS-only e exige `evidenceMode=full_article`, digest SHA-256 e duas citações antes de qualquer GET/PUT.
7. Quando futuramente autorizada, a nota de aprovação no Strapi indicará a IA, a base textual integral, seu SHA-256 e as duas evidências. O portal distingue revisão **humana** de **IA baseada em fonte integral** e mantém indicação da origem externa.

**Limitações remanescentes:** o artigo não lido por completo ou cuja estrutura de HTML não permita extração confiável é recusado. Um teste automatizado de citações literais em dois blocos é evidência rastreável, **não comprova que toda afirmação da síntese é verdadeira**. O segundo modelo pode ser o mesmo provedor gratuito do primeiro. Para publicação contínua sem humano, ainda são recomendáveis políticas de amostragem editorial, checagem adicional de licença, monitoramento e um ambiente de homologação isolado. Temas clínicos, médicos, jurídico-políticos e demais assuntos sensíveis devem ficar em revisão humana.

## Comandos de homologação seguros no Windows

```powershell
git switch dev
git pull --ff-only origin dev
npm run --prefix curator check
npm run --prefix curator test

docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator build worker

# Testa a nova rota de análise integral, sem criar ou publicar no Strapi.
# Com as permissões atuais, a fonte será RETIDA sem leitura integral nem IA.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator run --rm -T `
  -e CURATOR_GEMINI_API_KEY= `
  -e CURATOR_GROQ_API_KEY= `
  worker npm run review:full-preview
```

Saída esperada **nas fontes atuais**: `article_evidence_unavailable`, `evidenceReason=source_permission_pending`, `preview=true`, `aiGenerated=false`, podendo haver `skippedPreviouslyProcessed`. É um teste bem-sucedido do bloqueio de acesso, **não** uma aprovação editorial de fonte integral.

Os testes unitários utilizam **HTML fictício e uma autorização sintética somente no teste**, sem coletar páginas de Perkins/WAI ou criar registros no CMS. Eles verificam saída de texto, ausência de mídias/scripts, limites, redirects, trechos literais em blocos diferentes, bloqueio de fontes não autorizadas e bloqueio da publicação sem evidência.

**NÃO executar `npm run once` com `CURATOR_AUTO_PUBLISH_ENABLED=true` ou `npm run schedule` nesta etapa.** Somente após uma autorização documentada, homologação técnica e editorial independente e backup PostgreSQL restaurável poderemos discutir um teste supervisionado de publicação em instância DEV isolada.

Referências complementares: [Revisão IA e publicação DEV](REVISAO-IA-PUBLICACAO-DEV.md), [Curadoria Sprint 3.2](CURADORIA-SPRINT3-2.md), [issue #14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14).
