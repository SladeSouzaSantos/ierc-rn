# Curadoria automática — gates factuais e prevenção de extrapolações

## Escopo e motivação (14/11/2026)

Este documento descreve a proteção **geral** da produção de notícias no
Radar da Inclusão após a auditoria da notícia do Enem 2026. Na execução
anterior, o revisor contestou uma associação entre auxílio para leitura e
deficiência visual não explicitada na fonte. Uma reescrita acrescentou
nome de ministro e outras informações laterais; esse comportamento foi
bloqueado pela limitação de novas entidades na correção (PR #44).

Este incremento atua **antes da primeira revisão independente**, nos
rascunhos **novos**, para evitar desperdiçar chamadas de IA com afirmações
que não têm âncora literal na fonte. Não tenta reabrir o Enem e não
considera a publicação manual do operador uma aprovação automática.

## Fluxo de publicação

1. **Descoberta e direitos:** somente fonte autorizada pela política
   local, texto original integral acessível, autoria/licença verificada
   e deduplicação com Strapi + Redis. A descoberta de uma notícia não
   autoriza publicação.
2. **Redação:** o modelo recebe blocos numerados da reportagem.
   `VERIFIED_WRITER_SYSTEM` pede síntese curta e original, não atribui
   a notícia ao IERC e não obriga relacionar uma notícia geral à
   deficiência visual.
3. **Validação determinística da redação:** o
   `validatePublicationReadyDraft` mantém os limites de texto;
   `validateSourceAnchoredDraft` barra:
   - **Números** não presentes nos blocos ou no título da fonte;
   - **Nomes próprios compostos** não presentes na fonte ou no nome
     da organização editorial;
   - Relações textuais **específicas com cegueira, baixa visão ou
     deficiência visual** quando a reportagem não menciona essa
     audiência. Não se deve atribuir uma destinação exclusiva ao auxílio
     para leitura sem evidência.
4. **Fallback controlado:** um resultado com afirmações não ancoradas
   é tratado como saída editorial inválida (`invalid_output`,
   `unverified_source_claim`). Somente os demais provedores gratuitos
   elegíveis pelo limite/cooldown normal podem ser consultados. Sem
   candidato aceitável, não se grava nem publica uma matéria.
5. **Revisão factual independente:** exige todas as afirmações
   comprovadas, veredito `approve`, ausência de questões/alegações
   pendentes e duas citações literais provenientes de blocos distintos.
   Uma resposta `approve` sozinha nunca autoriza publicação.
6. **Correção quando houver `hold`:** a IA recebe as objeções e dicas
   lexicais de blocos *não conclusivas*. A versão corrigida precisa
   respeitar o escopo do rascunho anterior (sem novos nomes/números),
   e **também** passar pela validação de âncoras na fonte. O texto
   corrigido retorna à revisão independente. Limite de **duas**
   correções por linhagem. Um `hold` terminal não é repetido para
   procurar um modelo mais permissivo.
7. **Publicação:** segue as permissões do Strapi e a checagem exata do
   Draft. Apenas documento aprovado e confirmado pelo CMS fica
   visível no Radar (filtros `published` e
   `editorialStatus=aprovado`).

## Limites e proteção de dados

O filtro de nomes/números é **heurístico e conservador**: uma ocorrência
textual é condição necessária, não prova suficiente. Pode rejeitar
traduções legítimas de entidades/números ou não detectar interpretações
semânticas erradas. A decisão editorial continua com o revisor e as
verificações de citação, licença, origem e publicação atômica.

Logs operacionais indicam somente `field`, `constraint` e motivos
fixos, sem publicar prompt, conteúdo privado, trecho de fonte, token
ou resposta da IA. Dados protegidos da auditoria Enem permanecem
criptografados e exclusivos da PROD.

A configuração de cotas **não** é alterada no servidor por este PR.
O operador relatou 60 chamadas globais e 20 por Groq/Gemini/OpenRouter,
com controle via Redis e limites próprios dos provedores, os quais
continuam valendo.

## Testes e operações

Execute em uma cópia segura do código:

```bash
npm run --prefix curator check
npm run --prefix curator test
```

O CI valida também Strapi, Nginx, portal e acessibilidade automatizada.
Os testes novos cobrem aprovação com evidência, nomes e estatísticas
inventados, relação falsa com deficiência visual, `approve` conflitante,
correção que remove o excesso e **nenhuma gravação CMS** de rascunho
editorialmente inválido. Todos usam conteúdos fictícios em teste e não
fazem chamadas reais aos modelos ou ao CMS PROD.

A fusão de `dev` em `main` **não realiza deploy** no MiniMac. Após
o CI MAIN verde, atualizar o checkout PROD, reconstruir a imagem do
worker, executar `scripts/preflight-curator-autopublish-prod.sh` e
recriar apenas o worker. Não alterar redis, históricos, tokens ou o
Strapi. Validar `schedule_started` e verificar o resultado da
**próxima janela real** do agendador (08h, 13h, 19h
`America/Fortaleza`); o sucesso de testes offline não comprova que
uma matéria real foi autopublicada.

## Critérios de aceitação ainda abertos

- Homologar uma notícia **nova e elegível** de fonte licenciada em
  `draft_published` no MiniMac PROD, observando `approvalReference`,
  as citações na auditoria e visibilidade na rota pública.
- Monitorar `invalid_output`/quotas/fallback e obter amostra factual
  de notícias geradas para mensurar retenções e falsos positivos.
- Realizar testes manuais de acessibilidade e aprovação institucional
  de conteúdo e de imagem. Não misturar com os testes automáticos.
- Ampliar descoberta de fontes apenas após verificação de direitos
  (issues #17 e #18), sem flexibilizar a allowlist de publicação.

Ver também: [Curadoria PROD](CURADORIA-AUTOMATICA-PROD-MINIMAC.md),
[Revisão da fonte integral](FONTE-INTEGRAL-REVIEW-DEV.md),
[Issue #13](https://github.com/SladeSouzaSantos/ierc-rn/issues/13) e
[Issue #14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14).
