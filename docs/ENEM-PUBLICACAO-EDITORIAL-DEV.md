# Enem 2026 — publicação editorial supervisionada DEV

## Razão do procedimento

O artigo da Agência Brasil de 08/11/2026 tem uma referência
contraditória ao sobrenome do ministro: "Leonardo Barchin" no
corpo e "Leonardo Barchini" na legenda. A revisão do Draft
foi concluída em \`terminal\` após duas correções, embora a
última objeção à presença da frase na fonte tenha sido um falso
negativo (literal exato presente em E04). Adicionalmente,
\`lastCorrectedDraft.summary\` terminou em \`A\`, sem frase completa.

**Nunca reinicializar o histórico terminal para obter aprovação.**
Este procedimento separa publicação editorial explicitamente
autorizada por operador da aprovação automatizada por LLM.

## Escopo e proteção

Somente um documento conhecido de ambiente DEV:
\`nxh3gri9njyrag8uvbtgux4i\`, com URL exata de origem,
título da matéria, hash da URL, status Draft, fonte oficial,
data de publicação e direitos revalidados.

- Primeiro comando **preview**: somente GET privado no CMS + GET
  da reportagem permitida, sem chamadas a LLM e sem Redis write.
- Retorna um conteúdo substitutivo original e coerente em pt-BR,
  sem menção ao sobrenome divergente, com \`summary\` completo;
  \`approvalDigest\` SHA256 vincula o conteúdo proposto, o Draft
  original, a licença e o hash da evidência integral.
- O comando **publish** aceita somente esse digest de 64 caracteres
  e exige confirmação ativa do operador após leitura de **todos os
  cinco campos** do texto proposto.
- Confirma novamente fonte/licença, relê o Draft exato antes do
  PUT \`?status=published\`, preserva \`documentId\` e verifica
  todos os campos e status via resposta do PUT e GET publicado.
- \`approvalNote\` e \`approvalReference\` identificam **revisão
  editorial supervisionada**, e **não aprovação automática por IA**.
- A imagem da notícia permanece vazia; fotos requerem análise
  independente dos direitos.
- Não modifica token, histórico Redis, contadores, branches ou
  agendador. PROD é recusada pelo CLI.

## Passos no MiniMac DEV

Aguardar CI 4/4 verde para o último HEAD da \`dev\`:

\`\`\`bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
bash scripts/preflight-curator-autopublish-dev.sh
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator build worker
\`\`\`

Inspecionar proposta (somente leitura):

\`\`\`bash
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator \
  run --rm --no-deps -T worker \
  node src/publish-enem-human.mjs preview
\`\`\`

Conferir independentemente o artigo
\`https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-2026-estreia-apoio-emocional-e-novas-regras-de-acessibilidade\`
e **todas** as afirmações em title/summary/body/whyItMatters/category.
Se o texto estiver correto, copiar \`approvalDigest\` do
preview para o comando abaixo (não reutilizar hash anterior):

\`\`\`bash
docker compose --env-file curator/.env \
  -f compose.curator.dev.yml --profile curator \
  run --rm --no-deps -T worker \
  node src/publish-enem-human.mjs publish HASH_SHA256_DE_64_CARACTERES
\`\`\`

Esse segundo comando **PUBLICA DE VERDADE NO CMS DEV** e
precisa de concordância com a proposta. Se a matéria, o Draft,
a licença ou o digest de aprovação mudarem, a operação falha
fechada sem PUT. Se houver timeout na resposta ao PUT, verificar
o CMS antes de tentar novamente: a escrita pode ter ocorrido.

Resultado de sucesso:

\`\`\`json
{
  "event":"human_reviewed_draft_published_dev",
  "documentId":"nxh3gri9njyrag8uvbtgux4i",
  "status":"Published",
  "editorialStatus":"aprovado",
  "slug":"...",
  "approvalReference":"human-editorial-v1-..."
}
\`\`\`

Conferir a exibição em \`https://dev.iercrn.org.br/radar-da-inclusao\`
e \`/noticias/<slug>\` com o slug exato retornado. Confirmar
crédito e link para a Agência Brasil, data original, acessibilidade
e ausência de cópia integral de terceiros. Não adicionar imagem
protegida ou duplicar notícia.

## Notas sobre automação

Este é um **fluxo de revisão editorial humana** porque o revisor de
IA emitiu HOLD válido em uma linhagem terminal. A homologação do
publicador 100% automático com uma nova notícia autorizada permanece
pendente; ela requer \`draft_published\` efetivo, revisão integral
independente e inspeção no portal. O PR DEV→MAIN continua em Draft
até concluir a homologação e as verificações de produção isolada.
