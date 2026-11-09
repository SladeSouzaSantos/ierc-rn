# Diretriz das ilustrações — Sprint 1.1

## Conceito e responsabilidade editorial

### Capa — leitura tátil abre caminhos
Arquivo: `public/illustrations/leitura-tatil.svg`.

Livro aberto com pontos táteis **simbólicos**, mãos explorando as páginas, percurso amarelo, fachada **conceitual e não fotográfica** identificada como IERC e uma bengala longa; a composição azul/amarela/roxa se aproxima do modelo visual aprovado. A composição representa a educação e a autonomia promovidas pelo IERC-RN. **Não é uma fotografia da instituição nem uma transcrição válida de texto em Braille**: os pontos são meramente decorativos.

Legenda visível: “Leitura tátil, autonomia e novos caminhos.”

### Goalball — esporte, escuta e protagonismo
Arquivo: `public/illustrations/goalball-quadra.svg`.

Ilustração panorâmica da quadra com rede, marcações claras, bola estilizada com aberturas sonoras e ondas que simbolizam a orientação auditiva, ocupando toda a área visual como no modelo de referência. **Não é um desenho técnico das regras ou medidas oficiais da modalidade.**

Legenda visível: “GOALBALL · BOLA SONORA”.

## Acessibilidade

- Os arquivos têm `alt=""` e são apresentados dentro de elementos `aria-hidden="true"` porque são **ilustrações decorativas**, não recursos únicos de informação.
- O conteúdo textual adjacente continua descritivo, estruturado e disponível para leitores de tela.
- Não codificar conceitos essenciais exclusivamente em cores, linhas ou movimentos das artes.
- Movimento do hero em Motion respeita `prefers-reduced-motion` e o controle “Reduzir animações”.
- Parallax do bloco esportivo, se habilitado, respeita o mesmo requisito via GSAP.
- SVGs locais sem scripts, animações embutidas ou dependência externa: boa definição para zoom e dispositivos móveis.
- Testar zoom 200% e 400% em navegador real, além do reflow automatizado em 320 CSS px.
- Submeter a UI a testes manuais com NVDA, VoiceOver e TalkBack antes da publicação.

## Paleta

- Azul principal: `#123C5A` e azul profundo `#0B2941`.
- Amarelo principal: `#F2C65E`.
- Roxo complementar: `#5A2C86` e tons de lavanda.
- Tons de pele e papel são exclusivos das ilustrações, não alteram tokens de interface.

## Manutenção

As duas artes são SVGs de autoria do projeto, não retratos de alunos, atletas ou funcionários. Podem ser substituídas futuramente por fotografias originais autorizadas, mantendo equivalência de conteúdo textual, `alt` adequado e desempenho.

## Nota de fidelidade ao mockup

O mockup é uma imagem estática de referência. A implementação permanece composta por HTML/CSS acessível e artes vetoriais redimensionáveis, em vez de transformar a página inteira numa imagem. A fachada do hero é uma ilustração simbólica, não uma fotografia do prédio do IERC; substituir por fotografia autorizada se a instituição desejar reproduzir sua fachada real. Não garantir equivalência pixel a pixel entre viewports diferentes.
