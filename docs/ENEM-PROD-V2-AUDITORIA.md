# Enem 2026 — proposta editorial v2 e auditoria privada em PROD

## Objetivo e limites

Publicar **somente** a síntese original do Enem vinculada ao `documentId`
`s5fc7fiy2wtub65mwbndg7j2`, e **somente após** avaliação factual
independente, com evidências literais de dois blocos diferentes do texto
original licenciado da Agência Brasil/EBC. A proposta v2 é significativamente
mais concisa que a versão anterior; nunca foi previamente aprovada.

A integração v2 não muda a decisão das versões anteriores, nem deleta ou
reinicia suas chaves Redis. Usa um *journal* novo por documento, digest da
proposta e SHA-256 fixado do artigo integral. O limite é de até duas
correções, com revisão independente após cada uma. Uma retenção ou saída
inválida NÃO publica nem permite repetir a mesma proposta para obter
aprovação casual.

A funcionalidade de auditoria criptografada desta implantação está vinculada
ao comando Enem v2 em PROD. O agendador geral continua com suas regras próprias;
a meta de resumo de 90–160 caracteres também foi aplicada aos prompts de
geração e correção automáticos, mas o limite rígido continua 250.

## Configuração no MiniMac

Use exclusivamente `/opt/projects/ierc-rn` (MAIN / PROD).
`dev` e `main` não devem ser confundidos na configuração de Docker.

1. Faça backup do `curator/.env.prod` para um local privado, preserve suas
   permissões e confira que o arquivo continua fora do Git.
2. Na máquina local, gere um segredo **único** e acrescente a variável
   `CURATOR_PROD_EDITORIAL_AUDIT_KEY=<64 hex>` ao `curator/.env.prod`.
   Gerar apenas no MiniMac, com `openssl rand -hex 32`, sem copiar o valor
   para GitHub, issue, log ou ChatGPT. Não reusar a chave DEV, do CMS ou da IA.
   Mantenha o segredo seguro e estável entre deploys: perdê-lo impede a leitura
   do histórico criptografado.
3. Mantenha limites conforme o orçamento confirmado pelo operador:
   `CURATOR_GLOBAL_MAX_CALLS=60`, `CURATOR_GROQ_MAX_CALLS=20`,
   `CURATOR_GEMINI_MAX_CALLS=20`, `CURATOR_OPENROUTER_MAX_CALLS=20`.
   A aplicação NÃO modifica automaticamente `.env.prod`; valores do exemplo
   são apenas referência. A conta gratuita do provedor pode ter limites
   externos menores; a aplicação respeita 429/quotas sem contorná-las.
4. Mantenha os ACKs de política, a allowlist EBC, os tokens customizados
   e as redes privadas conforme o preflight existente.

### Nota sobre permissões de deploy (MiniMac)

Se a sessão de shell utilizou `umask 077` para gerar/proteger
`curator/.env.prod`, restaure `umask 022` **antes de novos git pulls**.
Uma nova versão de `.mjs` pode chegar com modo `0600`, causando
`EACCES` porque a imagem executa o worker como `USER node`.
O Dockerfile da curadoria agora normaliza **apenas** `/app/src` com
`chmod -R a+rX` antes de mudar para o usuário não-root.

Em checkouts anteriores, corrija exclusivamente o código:

```bash
cd /opt/projects/ierc-rn
umask 022
find curator/src -type d -exec chmod 755 {} +
find curator/src -type f -name '*.mjs' -exec chmod 644 {} +
```

**Nunca** aplique `chmod -R` à raiz do repositório nem altere as
permissões da chave em `curator/.env.prod`; mantenha o arquivo privado
(com permissão `0600`).

### Verificação de versão e imagem

```bash
cd /opt/projects/ierc-rn
git status --short
git pull --ff-only origin main
git rev-parse --short HEAD

docker compose --env-file curator/.env.prod \
  -f compose.curator.prod.yml --profile curator build worker

bash scripts/preflight-curator-autopublish-prod.sh
```

Exigir `PROD_PREFLIGHT_OK` e CI MAIN completo com sucesso.

### 1. Verificação sem escrita

```bash
docker compose --env-file curator/.env.prod \
  -f compose.curator.prod.yml --profile curator run --rm --no-deps -T worker \
  node src/enem-v2-cli-prod.mjs check
```

O resultado `enem_v2_editorial_check` informa `canPublish`,
`previousRecoveryRecorded`, `newVersionUnused`, cotas atuais e hashes
da fonte e proposta. **Não** publica, consome cotas, grava notas ou usa IA.

### 2. Avaliação factual e publicação condicionada

**Somente se o `check` retornou `canPublish:true` e se o CI Main passou:**

```bash
docker compose --env-file curator/.env.prod \
  -f compose.curator.prod.yml --profile curator run --rm --no-deps -T worker \
  node src/enem-v2-cli-prod.mjs publish
```

Operação real: o mesmo artigo **pode ser publicado imediatamente**.
O fluxo preserva as cotas dos três provedores (Groq → Gemini →
OpenRouter), a licença EBC, os blocos originais verificados e o
histórico de revisões criptografadas.

Resultados possíveis: `draft_published`, `draft_review_pending`,
`already_attempted`, `locked` ou `ENEM_V2_PROD_DENIED`.
Se houver retenção, não repetir e não limpar marcadores Redis.

### 3. Diagnóstico privado das objeções

`inspect` acessa APENAS a auditoria cifrada desta revisão e exige
acknowledgment temporário. A saída apresenta objeções textuais e a
última versão da síntese; **não** inclui a íntegra da fonte, tokens ou
chaves. Execute só num terminal confiável. Não coloque a saída integral
em logs públicos.

```bash
docker compose --env-file curator/.env.prod \
  -f compose.curator.prod.yml --profile curator \
  run --rm --no-deps -T \
  -e CURATOR_PROD_AUDIT_INSPECT_ACK=PRINT_PRIVATE_EDITORIAL_NOTES worker \
  node src/enem-v2-cli-prod.mjs inspect
```

A auditoria usa AES-256-GCM, AAD vinculada ao documento, dedupe e
digests da fonte/proposta; chave de registro derivada por HMAC,
TTL de 45 dias. Ausência/tamper de registros falha em modo fechado.
As observações vêm da IA, são **alegações a checar**, não verificação
independente do próprio modelo.

## Notas editoriais e integridade

- A proposta v2 remove detalhes clínicos/estatísticos secundários do
  resumo inicial e privilegia as informações de acessibilidade.
- `objectionHints` lista IDs candidatos calculados por sobreposição
  lexical: não valida nenhuma afirmação. A IA recebe os blocos
  originais e deve comprovar cada afirmação ou removê-la.
- O alvo de resumo é 90–160 caracteres em uma frase completa, o
  limite técnico da publicação permanece 60–250.
- Não realizar `DEL`/`FLUSH` no Redis, não alterar documentos Strapi
  manualmente para simular aprovação e não reciclar chaves de journals.
- As tentativas anteriores (v1 e recuperação técnica) seguem
  registradas e não são interpretadas como aprovação da nova versão.
