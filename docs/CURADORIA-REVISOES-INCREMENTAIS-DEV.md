# Duas correções incrementais e histórico editorial criptografado — DEV

## Objetivo

A curadoria do Radar da Inclusão encontra notícias nacionais e
internacionais, mas somente utiliza para publicação automática
artigos com direitos de reutilização autorizados. Para cada fonte
habilitada, a IA redige síntese original, outra etapa revisa
integralmente os fatos, e a IA corrige especificamente os pontos
questionados. A implementação DEV permite **até duas correções em
sequência para o mesmo artigo**, exigindo uma nova revisão independente
após cada correção. Não altera o máximo de uma candidata por slot,
as janelas de 08h/13h/19h, as quotas gratuitas nem a allowlist.

Este limite é **duas correções por linhagem editorial do documento**,
inclusive entre retomadas, não um contador que reinicia ilimitadamente
a cada horário. O agendador mantém o máximo de **duas recuperações
automáticas por Draft** (Redis `ierc:curator:auto-recovery:...`).
Logo, duas correções rejeitadas não se tornam uma busca por aprovações
de outros modelos.

## Etapas

1. O writer produz um Draft inicial, gravado no CMS Strapi como `Draft`.
2. O revisor avalia título, summary, body e whyItMatters contra os
   blocos numerados do artigo integral com licença confirmada.
3. `approve` exige `fully_supported`, dois excertos **literais
   de blocos diferentes**, nenhuma ressalva e demais gates de fonte
   e integridade; só então o Publisher pode publicar.
4. `hold` válido produz objeções e possíveis afirmações sem suporte.
   A IA de correção recebe a versão anterior, os blocos da fonte e
   as objeções; deve **ajustar os pontos questionados**, preservando
   fatos já fundamentados e sem inventar outros.
5. A primeira versão corrigida passa por nova revisão. Se houver
   outro `hold` fundamentado, uma segunda correção pode ser gerada
   sobre **essa versão**, seguida de uma terceira revisão.
6. Sem aprovação, a publicação permanece bloqueada; `review_unavailable`,
   direitos de uso indisponíveis, evidências divergentes, `hold` final,
   conteúdo incompleto ou falta de quotas nunca viram aprovação.
7. Se aprovado, o CMS recebe **uma atualização única** do mesmo
   `documentId`, com título/slug/resumo/corpo/categoria corrigidos e
   `status=published`. Um digest SHA256 vincula a versão publicada
   à versão revista; o Publisher confere os dados retornados.

## Retomada privada segura

Se a chave `CURATOR_EDITORIAL_PROGRESS_KEY` for configurada,
cada etapa intermediária é guardada no **Redis DEV**, com:

- conteúdo da síntese corrigida (não o texto integral da reportagem);
- contador de correções, `phase` (`repair`, `review` ou `terminal`);
- histórico curto das objeções do revisor, com limites de comprimento;
- criptografia **AES-256-GCM** e nonce aleatório para cada gravação;
- AAD vinculando criptograficamente `documentId`, hash da URL da fonte,
  digest do artigo integral verificado e hash de **todos os campos do
  Draft original** (incluindo categoria e whyItMatters);
- TTL de **14 dias** no Redis e chave de busca derivada por HMAC;
- nenhum token, chave, bloco original ou resposta completa das LLMs
  é armazenado no histórico; logs revelam somente eventos e contagens.

Na retomada, o sistema consulta novamente o Strapi, verifica se o
Draft está **inalterado**, comprova a autorização e o conteúdo
integral da fonte, confere o hash e só depois descriptografa o
histórico. Se o Draft ou evidência mudou, se a autenticação falhou
ou se o JSON armazenado foi adulterado, **a tentativa falha fechada**
sem publicação. Se o progresso estiver na fase `review`, a IA
revisa novamente o texto corrigido, não o publica diretamente;
se estiver na fase `repair`, usa a objeção registrada para uma
correção adicional, seguida de nova revisão. `terminal` nunca
permite novas chamadas para buscar uma aprovação diferente.

Histórico prévio à implantação **não pode ser reconstruído**:
o primeiro ciclo com a nova implementação começa com o conteúdo
atualmente mantido no Strapi. A versão corrigida na rodada das 19h
de 13/11/2026 não foi preservada pelo código anterior.

A chave de criptografia é única do ambiente e não deve ser
reutilizada de Groq, Gemini, OpenRouter ou Strapi. Perdê-la ou girá-la
invalida as revisões salvas; isso **não** apaga os rascunhos do CMS.
Não apagar o Redis nem alterar a chave para tentar forçar publicação.

## Implantação DEV no MiniMac

Executar na **DEV** e nunca na MAIN:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/prepare-curator-progress-dev.sh
bash scripts/preflight-curator-autopublish-dev.sh
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator \
  up -d --build --no-deps --force-recreate worker
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator \
  logs --tail=50 worker
```

O preparador gera a chave via `secrets.token_hex(32)` se estiver
ausente, preserva a chave existente, aplica `chmod 600` e **não
imprime a chave**. Não compartilhe seu `curator/.env`.

**O preflight DEV agora recusa a configuração** se recuperação
automática estiver habilitada e a chave estiver ausente ou inválida.
O runner não gera segredos automaticamente.

Se nenhum segredo estiver configurado, o código pode realizar
até duas correções **na memória**, mas não armazena versões
intermediárias em plaintext no Redis. O evento
`editorial_progress_disabled` indica essa condição;
não considere a retomada criptografada homologada até o
preflight passar com a chave configurada.

## Homologação

Depois do CI 4/4 verde, verificar:
- `schedule_started` com `autoPublish:true` e `autoRecover:true`;
- nas janelas, `pending_auto_started`, `full_article_review_held`,
  `editorial_repair_started`, `editorial_repair_generated`,
  `editorial_repair_approved` ou `editorial_repair_held`,
  `pending_auto_completed` e `run_completed`;
- (published:1) **somente** se o CMS confirmar aprovação e publicação;
- no caso de rejeição, `published:0`, Draft sem duplicação;
- o conteúdo público no Radar só aparecerá depois de publicação
  efetiva e da leitura CMS permitida pelo portal.

Comandos para ver logs da própria DEV sem expor o `.env`:

```bash
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator \
  logs --since=2h --tail=120 worker
bash scripts/check-curator-slots-dev.sh
```

Se o editor humano modificar o Draft durante esse processo, a
recuperação automática deve reter a matéria e não sobrepor as
mudanças. **Não executar `retry-pending` repetidamente após um
HOLD válido e não remover locks/contadores Redis**. A `main`
permanece intocada até a homologação real na DEV e o PR aprovado.
