# IERC-RN — Hardening de arquitetura e segurança
Revisão: 14/11/2026. Escopo: código fonte DEV. **Este relatório não é um pentest nem homologa automaticamente o MiniMac.**

## Responsividade
Até 760 px, o cabeçalho de períodos como **1970 a 1979** e **1980 a 1989** é exibido em uma linha; acima desse breakpoint, mantém o arranjo vertical com o conector "a". A marcação `<time>` conserva o significado temporal sem ARIA inválido. Playwright cobre reflow em 320, 375, 768 e 1440 px.

## Fase 1 — Dependências e builds reproduzíveis
- `next`: fixado em 15.5.18 (linha 15, patch de segurança de maio/2026; conferir atualizações posteriores antes de cada deploy). Fonte: https://vercel.com/changelog/next-js-may-2026-security-release .
- `@strapi/strapi`, `@strapi/plugin-users-permissions`, `@strapi/typescript-utils` e override `@strapi/admin`: alinhados à 5.62.0. Fonte: https://github.com/strapi/strapi/releases/tag/v5.62.0 .
- `fast-xml-parser`: 4.5.4; `processEntities:false` e rejeição antecipada de DTD/custom entities. Fonte: https://github.com/advisories/GHSA-jmr7-xgp7-cmfj .
- Três `package-lock.json` foram criados em ambiente controlado do GitHub Actions, sem executar `postinstall` durante a geração, e o workflow temporário de escrita foi **removido**.
- Dockerfiles e CI agora instalam dependências com `npm ci`, não com resolução dinâmica `npm install`.
- **Cuidado:** atualizar Strapi pode alterar estrutura interna do banco. Não reiniciar PROD antes de backup consistente, restauração ensaiada e validação do painel, tokens e workflows editoriais no ambiente DEV.

## Fase 2 — Segurança contínua no GitHub
- Workflow `.github/workflows/security.yml`: `npm audit --omit=dev --audit-level=critical` para portal, CMS e curadoria, verificação do lockfile via `npm ci --ignore-scripts`, varredura heurística de segredos em arquivos versionados e CodeQL JavaScript/TypeScript com regras security-extended.
- CodeQL depende de permissão GitHub `security-events: write` e da habilitação de code scanning no repositório; se impedido pela política da conta, a proteção **não está comprovada**. Revisar alertas e estados de execução.
- O scanner local é um filtro conservador, não um substituto de secret scanning do GitHub com varredura do histórico. Se um segredo real tiver sido publicado, rotacionar e revogar; apagar da branch não é suficiente.
- Alertas HIGH/MODERATE ainda devem ser triados e corrigidos; o gate de falha automático bloqueia CRITICAL. Não interpretar um workflow verde como ausência de risco.

## Fase 3 — Imagens, cabeçalhos e operação
- Proxy de imagens: somente caminho aprovado `/uploads` de mídia autorizada; sem seguir redirects; limite de **8 MiB durante o consumo** do corpo, inclusive sem `Content-Length`.
- Cabeçalhos do Next.js: X-Frame-Options DENY, X-Content-Type-Options nosniff, referrer policy, Permissions-Policy e CSP básica (frame-ancestors, base-uri, object-src). CSP total `script-src` com nonces é etapa separada para evitar bloqueio da hidratação Next.js.
- Executar somente no host, sem expor credenciais:

```bash
cd /opt/projects/ierc-rn-dev
git branch --show-current
git status --short
bash scripts/security-preflight.sh dev

cd /opt/projects/ierc-rn
git branch --show-current
git status --short
bash scripts/security-preflight.sh prod
```

- O script é **somente leitura**: verifica branch, permissões de arquivos privados, Compose, resposta do portal, recusa anônima do Strapi e cabeçalhos HTTP; não reinicia o portal, não altera volumes, não faz deploy e não executa LLM.
- **Verificações manuais ainda obrigatórias:** MFA/admin Strapi, restrições Cloudflare Access de `/admin`, exposições reais de portas, escopos de tokens, políticas de backup off-host/criptografia e teste de restauração, TLS, logs de auditoria, estado das flags de publicação automática PROD, teste com tecnologias assistivas e plano de resposta a incidentes.
- **Proibido marcar essa fase como homologada somente com testes de GitHub:** o CI não possui acesso autorizado ao MiniMac nem ao painel Cloudflare.

## Fase 4 — Refatoração controlada
- `lib/cms-policy.ts` torna `status=published` e `editorialStatus=aprovado` um **contrato único**, recusando sobreposição por filtros locais. O portal revalida a publicação e a aprovação **após receber** os dados.
- `lib/stream-limiter.ts` encapsula leitura limitada de recursos externos, separando transporte da política editorial e permitindo testes isolados.
- Os módulos existentes de publicação do curador mantêm seus gates de fonte, licenças, aprovação, evidência, escopo de token e deduplicação. Não houve migração de banco, mudança de schema, endpoint de escrita novo ou alteração da cadência de publicação.
- Refatorações maiores de `curator/src` (domínio/aplicação/adapters) deverão seguir por PRs menores e com testes específicos de modo OFF/ACTIVE e paridade editorial. Não desmontar os controles para simplificar pastas.

## Gates para MAIN e MiniMac
1. `dev` e PR para `main` com CI do portal, CMS, curadoria, Nginx e segurança verde; revisar CodeQL e auditorias. Se bloqueados, documentar impacto antes de qualquer merge.
2. Criar backup de PROD e **restaurar cópia de teste**; registrar versão e documentação do Strapi.
3. Deploy **DEV** primeiro (portal → CMS/curadoria só depois de validação explícita), testar publicação, rascunho, despublicação, imagens, cron e roteamento.
4. Aprovação manual do responsável sobre o DEV e então merge `dev`→`main`, seguido de deploy controlado de PROD. A integração Git não é implantação.
5. Rollback: manter imagem anterior e backup do banco; voltar somente o código pode ser insuficiente após migrations do Strapi. Se houver incompatibilidade de schema, restaurar o backup do mesmo ponto no tempo.

## Segurança editorial/IA
Textos de RSS/HTML e respostas de LLM são **dados não confiáveis**. O controle da publicação deve continuar fora do texto do prompt: allowlist de origem, evidência integral autorizada, escopo de token e comparação do documento. Não transformar links ou comandos publicados por terceiros em instruções de execução. Simular prompt-injection em testes negativos antes de ampliar novas fontes.
