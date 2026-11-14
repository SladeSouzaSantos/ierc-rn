# Radar da Inclusão — fluxo editorial autônomo DEV

## Objetivo

Descobrir e filtrar notícias sobre deficiência visual, acessibilidade,
Braille, educação inclusiva, tecnologia assistiva, goalball e direitos
no Brasil e no exterior; redigir sínteses ORIGINAIS em pt-BR;
revisar, corrigir automaticamente quando necessário e publicar apenas
conteúdo com direitos e evidências verificados.

O monitor independente continua vasculhando fontes internacionais de
maneira READ-ONLY, inclusive fontes sem permissão de republicação.
**Monitorar não autoriza publicar**. O publicador só pode usar as
fontes explicitamente incluídas em
`CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES`, que também tenham política
de reutilização documentada, extração legal de artigo integral e
checagem de autoria da notícia. Na configuração atual, são quatro
categorias EBC/Agência Brasil. A Comissão Europeia permanece
tecnicamente pausada por timeouts; WAI, Perkins, RNIB, IBSA, WBU e
outras fontes seguem apenas nos circuitos de descoberta conforme
as permissões documentadas. Não se presume que material na web
seja livre para copiar/publicar.

## Fluxo automático de cada notícia nova

```text
agendamento DEV (08h, 13h e 19h — Fortaleza)
  -> 1 slot atômico Redis / máximo 1 candidata
  -> antes de novas fontes: 1 recuperação elegível de Draft pendente
     (no máximo 2 tentativas automáticas por Draft em 45 dias)
  -> se não houver Draft elegível: filtros RSS + arquivo EBC autorizado
  -> relevância temática + data ≤45 dias + deduplicação
  -> permissão da fonte e direitos da matéria específica
  -> extração de texto integral com blocos numerados
  -> LLM redige síntese original curta
  -> CMS cria Draft explicitamente (nunca publica por padrão)
  -> LLM independente revisa com artigo integral
     -> APPROVE e duas citações literais de blocos distintos:
        validação determinística -> Publisher confere Draft -> publica
     -> HOLD explicável:
        LLM reescreve apenas fatos sustentados pelo texto integral
        -> validação determinística do novo Draft
        -> NOVA revisão com o mesmo artigo integral
        -> APPROVE + verificações -> publica versão corrigida
        -> HOLD: segunda correção pontual, se ainda houver orçamento
           -> nova revisão independente; se aprovado, publica
        -> HOLD ou falha final -> conserva Draft e histórico privado
     -> indisponível/saída inválida -> conserva Draft
```

### Políticas e limites de segurança

- **Até duas** correções pontuais por linhagem editorial do mesmo Draft,
  cada uma seguida de nova revisão; não repetir até obter aprovação por acaso.
  O progresso sobrevive ao reinício via histórico criptografado Redis DEV,
  vinculado a evidência e Draft original. Veja
  [Revisões incrementais DEV](CURADORIA-REVISOES-INCREMENTAIS-DEV.md).
- O revisor pode rejeitar uma síntese por conteúdo: `hold` é decisão
  válida, não falha do provedor. Nunca usar fallback apenas para procurar
  um parecer favorável. Fallback Groq → Gemini → OpenRouter aplica-se
  a falhas de serviço/formato.
- A IA de correção recebe os trechos integrais permitidos, o Draft e
  as objeções transitórias do revisor; não pode introduzir novos
  fatos. Se não for possível fundamentar os fatos, retorna skip.
- Nenhuma versão corrigida é publicada por confiança na IA redatora:
  exige **outra** revisão independente e as mesmas duas citações
  literais de blocos distintos.
- A versão corrigida é enviada ao Strapi no **mesmo PUT com
  `?status=published`**, depois de GET conferindo o Draft original.
  A integridade da nova versão é ligada por SHA256 ao objeto editorial
  que passou pela revisão; a resposta do Strapi deve confirmar título,
  slug, resumo, corpo, justificativa, categoria e `publishedAt`.
- Sem direitos de reutilização, fonte não permitida, evidência
  incompleta, publicação de terceiro, revisão contrária, imagem
  não autorizada ou alterações manuais no Draft: **não publica**.
- Não duplicar notícias: recuperação usa o `documentId` e o
  hash da URL originais; não há POST de segundo Draft.
- A recuperação agendada consulta apenas o Reader Custom do Strapi
  DEV, usa o Publisher Custom separado e guarda contagem atômica de
  até 2 tentativas automáticas por Draft no Redis DEV. Depois disso,
  a notícia permanece retida, e a descoberta de novos temas continua.
- Na DEV, a recuperação agendada é ativa por padrão quando
  `CURATOR_AUTO_PUBLISH_ENABLED=true`; desabilite com
  `CURATOR_AUTO_RECOVER_PENDING_ENABLED=false`. Continua
  **DESABILITADA na PROD** independentemente de variáveis até a
  homologação e promoção explícita de código.
- Cotas gratuitas de LLM são compartilhadas com a rotina de geração
  e contadas em Redis. Não alterar limite de uma candidata por horário
  nem desligar quotas para forçar uma publicação.
- Os logs incluem somente eventos, contagens, categorias, hashes
  truncados de IDs e status; nunca texto de fontes, respostas de LLM,
  tokens, URLs privadas ou redações internas.

## Homologar no MiniMac DEV

Antes do deployment, exigir 4/4 jobs GitHub Actions verdes.
Sem editar `curator/.env`:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/prepare-curator-progress-dev.sh
bash scripts/preflight-curator-autopublish-dev.sh
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator up -d --build --no-deps --force-recreate worker
docker compose --env-file curator/.env -f compose.curator.dev.yml \
  --profile curator logs --tail=40 worker
```

A confirmação de `schedule_started` deve incluir
`autoPublish:true` e `autoRecover:true`. Isso confirma a
configuração, **não** uma publicação. O próximo slot reservado
gera `pending_auto_started`, `editorial_repair_started`,
`editorial_repair_approved` ou `editorial_repair_held`,
`pending_auto_completed` e `run_completed`.
As verificações de citações, publicação e CMS só podem ser homologadas
com uma candidata real da fonte autorizada e sem alterar o conteúdo
do Draft pelo operador.

Para inspecionar slots sem executar LLMs nem editar o CMS:

```bash
bash scripts/check-curator-slots-dev.sh
```

**Não executar `retry-pending` repetidamente após um HOLD válido,
não apagar chaves Redis e não pressionar `Publish` manualmente**
para simular sucesso da curadoria. Os testes locais não equivalem à
aprovação factual da notícia real nem a garantia de que todo artigo
será publicável.

## Produção

A implementação só deve ser promovida de `dev` para `main`
após homologação em DEV, aprovação editorial amostral, checagem dos
direitos/attribution na página renderizada e backups/restore.
A MAIN existente permanece intacta até o PR autorizado.

## Incremento: histórico seguro de correções

Antes do deploy deste incremento, gerar localmente a chave DEV com
`bash scripts/prepare-curator-progress-dev.sh`, sem exibir o segredo.
O preflight exige essa chave quando a recuperação automática está ativa.
O histórico é criptografado em Redis por 14 dias e só é reaproveitado
se o Draft e a fonte integral licenciada forem revalidados.
Duas correções negativas tornam o progresso terminal; a IA não
continua repetindo chamadas para obter uma aprovação artificial.
