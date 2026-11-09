# IERC-RN · Portal institucional

Primeira versão de homologação do portal do **Instituto de Educação e Reabilitação de Cegos do Rio Grande do Norte** (IERC-RN).

O site apresenta as frentes de educação, reabilitação, cultura e esporte, com espaço para goalball, histórias, notícias, eventos, galerias, bazar solidário, visitas e apoio à instituição.

> **Status:** protótipo editorial em `dev`, **não aprovado para publicação oficial**. A branch `main` permanece com a base original. A marca textual é provisória até a obtenção do logotipo oficial do [@iercrn](https://www.instagram.com/iercrn/).

## Tecnologia

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

## Fluxo de desenvolvimento

- `main`: base institucional aprovada.
- `dev`: implementação e homologação.
- Pull requests para revisão antes da publicação.

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
