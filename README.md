# IERC-RN · Portal institucional

Primeira versão de homologação do portal do **Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte** (IERC-RN).

O site apresenta as frentes de educação, reabilitação, cultura e esporte, com espaço para goalball, histórias, notícias, eventos, galerias, bazar solidário, visitas e apoio à instituição.

> **Status — 14/11/2026:** Portal Next.js, CMS Strapi e Radar/curadoria integrados ao código de `dev` e `main`. O operador confirmou o worker PROD no MiniMac com `schedule_started`, `autoPublish:true`, `writeDrafts:true` e horários 08h/13h/19h (America/Fortaleza); isso comprova a inicialização do agendador, **não** uma publicação automática end-to-end. Uma notícia do Enem foi copiada e publicada **manualmente** no Strapi pelo operador, separada dos históricos de revisões retidas da IA. O portal ainda exige homologação institucional, de mídias e acessibilidade manual (zoom/leitores de tela).

A separação entre CMS DEV existente e PROD futura (Docker, PostgreSQL, volumes e credenciais) está documentada em [CMS: ambientes e diagnóstico](docs/CMS-ENVIRONMENTS.md). **Não é necessário alterar o Docker local para consultar a lentidão do painel.**

## Ativação da curadoria automática (DEV)

O operador aprovou a preparação de geração agendada e publicação automática controlada. A ativação **não acontece por git pull**: é necessário criar um token Custom separado para o publicador, conferir licença da matéria, fazer backup com restauração ensaiada, executar o pré-check e homologar `once` antes de iniciar o worker persistente. O cron DEV roda às **08h, 13h e 19h (America/Fortaleza)**, com uma única candidata por horário e fallback **Groq → Gemini → OpenRouter**. Somente fontes EBC originais autorizadas podem publicar automaticamente; se não houver evidência suficiente, a matéria não será publicada. O curador da MAIN/PROD tem opt-in separado, sem ligação automática com a DEV: sua ativação exige backup/restauração PROD, tokens Custom próprios e pré-check de modelos gratuitos.

Guia DEV: [ativação supervisionada](docs/ATIVACAO-CURADORIA-AUTOMATICA-MINIMAC.md). Guia PROD: [publicação automática com LLMs gratuitas no MiniMac](docs/CURADORIA-AUTOMATICA-PROD-MINIMAC.md). Os dois schedulers, Redis e tokens Strapi são isolados; o monitor RSS somente leitura da DEV permanece independente. A [validação geral de qualidade factual](docs/CURADORIA-GATES-FATUAIS.md) detalha o filtro de nomes, números e público-alvo, o limite de correções e a revisão independente.

### Descoberta RSS ampliada e foco editorial — 11/11/2026

A `dev` acrescenta **Diário PcD, Jornalista Inclusivo, Fundação Dorina, European Blind Union e IAPB** como fontes **somente para monitoramento/prévia** (`previewOnly=true`), sem autorização de IA editorial ou publicação automática. O adaptador da RNIB utiliza a descrição curta apenas como sinal temporário de relevância, sem reproduzi-la em relatórios. O monitor apresenta resultados por data decrescente e sinaliza foco visual direto, contexto especializado ou inclusão geral. Consulte [o guia MiniMac atualizado](docs/MONITOR-NOTICIAS-MINIMAC.md) e a [issue #17](https://github.com/SladeSouzaSantos/ierc-rn/issues/17) para executar o smoke real dos endpoints RSS, ainda pendente; o worker de publicação da Agência Brasil **não foi alterado**.

## Tecnologia

A `dev` possui um módulo experimental de **geração, revisão com IA e publicação automatizada opt-in**, **desativada por padrão**. A revisão integral é exigida para publicar: a primeira IA produz uma síntese original e a segunda analisa os blocos de evidências numerados da matéria. O modo `npm run --prefix curator review:preview` usa somente título+resumo RSS, sem escrita; `npm run --prefix curator review:full-preview` faz a verificação do artigo quando os direitos da fonte permitirem, igualmente sem escrita. O catálogo admite notícias **próprias da Agência Brasil (EBC)** e da **Comissão Europeia** condicionadas a direitos e autoria por artigo; materiais de parceiros, WAI e Perkins sem permissão de leitura integral permanecem bloqueados. Para a publicação real, exige token Custom separado, licença documentada e confirmação explícita no DEV. Também gera slugs legíveis para novos artigos. Consulte [Revisão IA e publicação controlada (DEV)](docs/REVISAO-IA-PUBLICACAO-DEV.md) e [Revisão baseada na fonte integral](docs/FONTE-INTEGRAL-REVIEW-DEV.md). 

A Sprint 3.2.1 acrescenta o [Radar da Inclusão com curadoria IA gratuita e rascunhos supervisionados](docs/CURADORIA-SPRINT3-2.md). Na `dev`, a rota **`/radar-da-inclusao`** separa notícias externas das notícias institucionais do IERC-RN. Só exibe conteúdos com status publicado, aprovação editorial, nome e URL HTTPS da fonte; a notícia da Perkins foi revisada e publicada manualmente em DEV pelo operador. O processo de revisão, metadados, categorias e verificações está no [guia do Radar](docs/RADAR-DA-INCLUSAO.md). O worker de geração de rascunhos e publicação permanece desligado por padrão. **A consulta RSS pode rodar continuamente em um container MiniMac separado e somente leitura**, usando [`compose.curator.monitor.yml`](compose.curator.monitor.yml): três verificações por dia às 08h/13h/19h (America/Fortaleza), varredura no boot, relatórios JSON em volume Docker, sem tokens/LLM/Strapi e sem publicação automática. Consulte o [guia MiniMac](docs/MONITOR-NOTICIAS-MINIMAC.md). A coleta está preparada para RSS da EBC, Comissão Europeia, W3C/WAI e Perkins; as listagens RNIB/IBSA permanecem só na prévia e não autorizam geração/publicação. Para notícias sobre o IERC, a página `/noticias` apresenta comunicados oficiais separados de **“IERC-RN na imprensa”**; o Radar divide as matérias de terceiros em **Brasil** e **experiências internacionais**. A `dev` também fornece `generate-preview` para testar **uma síntese original com IA gratuita**, cotas Redis e fallback, sem token de escrita, rascunhos Strapi ou cron; consultar o guia da curadoria antes de ativar qualquer worker.

A partir da Sprint 3.1, a `dev` inclui o **Strapi 5 isolado em Docker/PostgreSQL**, com painel administrativo e integração opcional de publicações aprovadas (notícias, eventos, atividades e novas trajetórias), sem migrar a interface existente. Consulte [Guia do CMS](docs/CMS-SPRINT3.md) para criar credenciais locais e configurar o acesso à API no servidor Next.js. O CMS não é ativado automaticamente no portal.


Next.js (App Router), React, TypeScript, CSS próprio, Motion, GSAP + ScrollTrigger, Lenis opcional, ícones Lucide. Testes de navegação, teclado e acessibilidade com Playwright + axe-core.

### Executar localmente

Requisitos: Node.js 22+ e npm.

```bash
git clone https://github.com/SladeSouzaSantos/ierc-rn.git
cd ierc-rn
git checkout dev
npm install
npm run dev
```

Acesse **http://localhost:3000**.

### Testar

```bash
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Para rodar os testes e2e, a aplicação deve estar compilada (`npm run build`); o Playwright inicia `next start` na porta 3000.

## Deploy Docker no MiniMac

Os portais DEV/PROD, redes de leitura Strapi exclusivas, portas locais e os endereços planejados `dev.iercrn.org.br`, `iercrn.org.br`, `strapi-dv.iercrn.org.br` e `strapi.iercrn.org.br` estão documentados em [MiniMac e domínios](docs/MINIMAC-PORTAL-DOMINIOS.md).

O código da MAIN foi integrado. Para **preparar e iniciar localmente** o CMS/portal MAIN no MiniMac, consulte o [runbook MAIN](docs/MAIN-MINIMAC-BOOTSTRAP.md) e use `bash scripts/prepare-main-minimac.sh --prepare`, `--check` ou `--start-local`. Nenhum desses passos libera domínio público, usa o banco da DEV ou ativa publicação automática em produção. DNS, Cloudflare Access, backups e aprovação institucional ainda precisam de homologação antes do lançamento.

## Fluxo de desenvolvimento

- **`dev` — desenvolvimento:** toda implementação, correção e experimento de código começa aqui. O MiniMac DEV é homologado antes de qualquer promoção.
- **`main` — produção:** somente alterações aprovadas e com testes verdes entram via pull request `dev → main`, após revisar riscos, conteúdo institucional, backups e deploy.
- **Sincronização:** se houver manutenção excepcional na `main`, trazemos seus commits de volta por PR `main → dev` sem descartar trabalho ainda não homologado na `dev`. Branches podem ter SHAs diferentes enquanto houver mudanças DEV pendentes; isso é intencional.
- **Arquivos locais:** os `nginx.conf` da MAIN e da DEV são gerados em cada checkout e ignorados pelo Git; credenciais `.env*`, backups, logs e artefatos temporários também não devem ser commitados. Os templates compartilháveis ficam em `infra/nginx/shared-*.conf`.

Não fazer deploy automático de alterações não homologadas da `dev` na PROD.

## Marcos de desenvolvimento

Veja [docs/ROADMAP.md](docs/ROADMAP.md) para as quatro sprints, [docs/CMS-SPRINT3.md](docs/CMS-SPRINT3.md) para o CMS, [docs/SOURCES-SPRINT2.md](docs/SOURCES-SPRINT2.md) para evidências de conteúdo e [docs/ACESSIBILIDADE-VALIDACAO.md](docs/ACESSIBILIDADE-VALIDACAO.md) para testes manuais.

## Acessibilidade

Objetivo: **WCAG 2.2 AA**, sujeito a auditoria manual com usuários reais e testes nos leitores de tela NVDA, VoiceOver e TalkBack. Recursos já presentes: conteúdo semântico, link para pular para o conteúdo, menus acessíveis ao teclado, foco visível, alt em imagens quando incorporadas, preferências de ampliação de texto, alto contraste, redução de movimento e rolagem suave desativada por padrão.

Motion e GSAP atuam em **elementos decorativos**. Lenis é opt-in e desativado para movimento reduzido e dispositivos menores. Testes automatizados não comprovam, sozinhos, conformidade WCAG.

## Requisitos de conteúdo

Veja [docs/CONTEUDO-E-APROVACOES.md](docs/CONTEUDO-E-APROVACOES.md) para as confirmações institucionais pendentes. Não foram inseridos meios de pagamento, links de reserva não fornecidos, fotos não autorizadas ou notícias fictícias.

## Referências

- [Instagram oficial informado: @iercrn](https://www.instagram.com/iercrn/)
- [CBDV: Regional Nordeste de Goalball 2026](https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande)
- [Mapas Culturais de Natal: IERC](https://mapacultural.natal.rn.gov.br/agente/1911/)
- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/)

Este repositório contém código de protótipo, **não um site oficial já publicado**.
