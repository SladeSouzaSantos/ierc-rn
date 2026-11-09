# Diretriz das ilustrações — Sprint 1.1

## Conceito e responsabilidade editorial

### Capa — leitura tátil abre caminhos
Arquivo: `public/illustrations/leitura-tatil.svg`.

A arte do hero foi substituída **pelo arquivo enviado pelo responsável pelo projeto** (`leitura-tatil(1).svg`). Ela contém uma imagem PNG incorporada ao contêiner SVG: portanto, mantém o desenho e a transparência originais, mas sua nitidez depende da resolução interna do PNG. A composição representa a educação e a autonomia promovidas pelo IERC-RN. **Não é uma fotografia da instituição nem uma transcrição válida de texto em Braille**: os pontos são meramente decorativos.

O texto sobre educação e autonomia continua presente no hero, independente da imagem.

### Goalball — esporte, escuta e protagonismo
Arquivo: `public/illustrations/goalball-quadra.svg`.

Quadra panorâmica com rede e marcações claras, sem a bola dentro do arquivo. A bola tem um SVG próprio (`public/illustrations/goalball-bola.svg`) e é sobreposta em `components/goalball-scene.tsx`, onde GSAP simula um quique suave e dois anéis de vibração no impacto. **Não há som real, Web Audio, arquivos de áudio ou controles de volume.** **Não é um desenho técnico das regras ou medidas oficiais da modalidade.**

O texto explicativo sobre o esporte continua no bloco ao lado da ilustração; a bola e os ecos são decorativos.

## Acessibilidade

- Os arquivos têm `alt=""` e são apresentados dentro de elementos `aria-hidden="true"` porque são **ilustrações decorativas**, não recursos únicos de informação.
- O conteúdo textual adjacente continua descritivo, estruturado e disponível para leitores de tela.
- Não codificar conceitos essenciais exclusivamente em cores, linhas ou movimentos das artes.
- Movimento do hero em Motion respeita `prefers-reduced-motion` e o controle “Reduzir animações”.
- Parallax do bloco esportivo, se habilitado, respeita o mesmo requisito via GSAP.
- SVGs locais sem scripts ou dependências externas; quadra e bola são vetoriais, enquanto o SVG do hero enviado pelo usuário contém uma imagem PNG embutida, que não possui escalabilidade vetorial ilimitada.
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

## Movimento e vibração (alteração solicitada)

- A quadra foi separada da bola; o SVG da quadra agora contém exclusivamente o cenário esportivo (fundo, gol e marcações).
- O movimento é gerado por GSAP num componente cliente independente e executado somente quando a seção está visível.
- A bola sobe discretamente, retorna à quadra e comprime no impacto; anéis translúcidos crescem e desaparecem como **eco visual do som**.
- Sem reprodução de áudio, sem solicitar permissão do navegador e sem botão de som.
- Quando `prefers-reduced-motion: reduce` ou a preferência equivalente do site estiver ativa, a cena fica estática e legível.
- Nenhuma informação essencial depende dos efeitos: o título e a descrição do goalball permanecem como conteúdo textual acessível.
