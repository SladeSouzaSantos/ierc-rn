# IERC-RN · Roadmap e sprints

> As issues de **marco** representam o planejamento por sprint. O conector atual não permite criar objetos nativos de Milestone; portanto, estes ainda dependem da configuração pelo GitHub. Não confundir *issues de marco* com Milestones nativos.

## Sprint 1 — Identidade e acessibilidade
**Código e visual aprovados pelo responsável e integrados à `main` (PR #5).** Testes manuais com tecnologias assistivas seguem exigidos para o lançamento público.
**Acompanhamento:** [#6](https://github.com/SladeSouzaSantos/ierc-rn/issues/6) · [#1](https://github.com/SladeSouzaSantos/ierc-rn/issues/1)

- Integrar logo original sem fundo branco, mantendo proporções.
- Ajustar azul + amarelo + roxo como paleta com contraste.
- Levar botão de acessibilidade ao canto inferior direito, garantir navegação por teclado.
- Esconder "N" de desenvolvimento.
- Testar lint/typecheck/build, axe-core, zoom/reflow, desktop/mobile e movimento reduzido.
- **Gate de aprovação manual obrigatório:** NVDA, VoiceOver ou TalkBack, leitura linear, links, botões, modo alto contraste e revisão com usuários.

## Sprint 1.1 — Ilustrações institucionais
**Acompanhamento:** [#10](https://github.com/SladeSouzaSantos/ierc-rn/issues/10) **encerrada como entrega de código**; acessibilidade manual segue em [#6](https://github.com/SladeSouzaSantos/ierc-rn/issues/6).

- Trocar capa abstrata por mãos, leitura tátil e percurso de autonomia.
- Redesenhar goalball com quadra, meta e bola com aberturas sonoras.
- Usar SVG autoral e conteúdo equivalente em textos adjacentes, sem depender de imagem.
- Validar desktop/mobile, movimento reduzido e leitores de tela.

## Sprint 2 — Conteúdo e acervo
**Situação em 09/11/2026:** conteúdo institucional, arquivo de goalball e nove trajetórias esportivas integrados à `main` pelo PR #11, após CI aprovado. **Permanecem pendentes para lançamento público:** aprovação institucional, testes manuais de acessibilidade, contatos oficiais e licenças das fotografias de terceiros. Ver [fontes da Sprint 2](SOURCES-SPRINT2.md).
**Acompanhamento:** [#7](https://github.com/SladeSouzaSantos/ierc-rn/issues/7) · [#1](https://github.com/SladeSouzaSantos/ierc-rn/issues/1) · [#3](https://github.com/SladeSouzaSantos/ierc-rn/issues/3)

- Confirmar textos, canais, atividades e horários, bazar e excursões.
- Pesquisar e validar atletas e ex-alunos.
- Usar imagens e depoimentos autorizados; escrever descrições acessíveis.

## Sprint 3 — CMS editorial
**Sprint 3.2.1 em DEV:** fundação do Radar da Inclusão — RSS internacional, fila de rascunhos, roteador gratuito no padrão Orbe (OpenRouter → Gemini → Groq → Ollama local), quotas e cooldown Redis, scheduler 08h/13h/19h America/Fortaleza, todas as gravações explícitas como Draft, worker Docker opt-in e zero publicação sem Editor. [Arquitetura e testes](CURADORIA-SPRINT3-2.md). Não ativado em produção; ampliação de fontes e homologação real pendentes.
**Sprint 3.1 em DEV (09/11/2026):** estrutura isolada de Strapi 5/PostgreSQL, sete coleções editoriais, RBAC nativo, Draft & Publish, campos de licenças de mídia e integração server-only de conteúdos aprovados, com fallback para o acervo anterior. O painel necessita da primeira inicialização real no Docker e homologação manual antes do merge. [Guia CMS](CMS-SPRINT3.md).
**Acompanhamento:** [#8](https://github.com/SladeSouzaSantos/ierc-rn/issues/8) · [#2](https://github.com/SladeSouzaSantos/ierc-rn/issues/2)

- CMS, editor/administrador, permissões, revisão, notícias, agenda, galerias, atletas, eventos.
- Acessibilidade também no painel e nos formulários.

## Operação automatizada de notícias e futura implantação MiniMac

**Código do monitor concluído na `dev`:** Compose independente `compose.curator.monitor.yml`, sem tokens Strapi/LLM, sem escrita de CMS e sem publicação. Faz uma varredura ao iniciar e três verificações diárias às **08h/13h/19h America/Fortaleza**. Resultados ficam em JSON no volume Docker, com proteção contra repetição de slot e reinício automático do serviço. **Não está ativo no MiniMac enquanto o operador não executar o Compose nesse host.** Guia: [Monitor MiniMac](MONITOR-NOTICIAS-MINIMAC.md).

**Acompanhamento:** [#15](https://github.com/SladeSouzaSantos/ierc-rn/issues/15) para ativação/homologação do monitor no MiniMac; [#16](https://github.com/SladeSouzaSantos/ierc-rn/issues/16) para deploy do portal Next.js + Strapi e PostgreSQL, proxy HTTPS, backups e acessibilidade. As issues [#13](https://github.com/SladeSouzaSantos/ierc-rn/issues/13) e [#14](https://github.com/SladeSouzaSantos/ierc-rn/issues/14) continuam abertas: busca temática histórica na EBC, revisão editorial e eventual publicação automática exigem homologação separada. Não publicar automaticamente pelo simples fato de o monitor estar em execução.

## Sprint 4 — Participação e sustentabilidade
**Acompanhamento:** [#9](https://github.com/SladeSouzaSantos/ierc-rn/issues/9) · [#3](https://github.com/SladeSouzaSantos/ierc-rn/issues/3) · [#4](https://github.com/SladeSouzaSantos/ierc-rn/issues/4)

**Etapa 4.1 — Apoio não financeiro em DEV (11/11/2026):** página `/apoie` reorganizada com Bazar Solidário, doação de itens condicionada à confirmação da equipe, visita ao bazar, divulgação e proposta de colaboração. Links apenas para `/contato` e o perfil Instagram informado. Mensagens explícitas sobre horários, itens e entrega ainda não confirmados; nenhum pagamento habilitado. Testes de acessibilidade, reflow e ausência de Pix/checkout. Runbook: [Apoie o Instituto](APOIE-INSTITUICAO-DEV.md). **Homologação visual e com tecnologias assistivas no MiniMac ainda pendente.**

- Link oficial de visitas (sem duplicar plataforma).
- Confirmar funcionamento, itens aceitos e orientações do bazar.
- Doações via Pix/cartão/recorrência somente após aprovação da conta recebedora e provedor autorizado.
- Política de privacidade, prestação de contas e jornada acessível.

## Critério geral de entrega
Código entra por `dev` e PR para `main` após CI verde e homologação com o IERC. Resultados automatizados e revisão manual são evidências distintas.
