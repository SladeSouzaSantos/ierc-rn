# Sprint 1 · Manual de homologação de acessibilidade

## Meta e limites
Meta: **WCAG 2.2 AA**, não certificada. Playwright/axe-core encontram parte dos problemas, mas não substituem pessoas cegas ou com baixa visão usando suas tecnologias habituais.

## 1. NVDA no Windows (Firefox ou Chrome)
1. Instalar e ativar NVDA pelo canal oficial https://www.nvaccess.org/.
2. Abrir `http://localhost:3000` em uma janela privativa (para evitar preferências prévias).
3. Usar **H** para percorrer títulos: verificar uma única entrada H1, hierarquia sem saltos semânticos e títulos que descrevem as seções.
4. Usar **K** para percorrer links: o propósito precisa ser compreensível sem ver a tela (ex.: “Apoie o IERC”).
5. Usar **B** para botões: menu de navegação e Acessibilidade devem anunciar nome, estado expandido e função.
6. Usar Tab/Shift+Tab do início ao fim: todos os elementos interativos alcançáveis e foco visível.
7. Abrir e fechar menu e painel com Enter/Espaço e **Escape**; foco deve retornar ao acionador.
8. Testar a leitura das oito atividades, seção goalball e bazar, sem depender de ícones e movimentos.
9. Conferir a logo: nome da instituição anunciado uma vez no link, sem descrição duplicada.

## 2. VoiceOver / TalkBack
- iPhone/macOS: ativar VoiceOver e usar gestos/atalhos para percorrer cabeçalhos, links e controles.
- Android: ativar TalkBack e percorrer os itens com deslizes, testando menu, painel e links.
- Garantir que os controles não escondam elementos em tamanho de texto ampliado.

## 3. Baixa visão e magnificação
- No Chrome/Firefox, testar zoom **200% e 400%** (1280px a 400% corresponde a aproximadamente 320 CSS px).
- Não deve haver rolagem horizontal da página, controles sobrepostos, textos cortados, menu impossível de abrir ou conteúdo inacessível.
- No painel, ativar **Ampliar textos** e **Alto contraste**; recarregar e verificar persistência.
- Testar com combinações de preferências do sistema: alto contraste e redução de movimento.
- Verificar estados hover, foco, selecionado e links, sem depender de cor isolada.

## 4. Movimento e teclado
- Em Preferências do Sistema, ativar “reduzir movimento” e verificar que animações decorativas não fazem navegação saltar.
- Por padrão, Lenis permanece **desligado**; navegação nativa, PageUp/PageDown e teclado continuam funcionais.
- O botão de acessibilidade fica no canto inferior direito; abrir o painel e verificar que não cobre o foco ou impede rolagem.
- Testar tela pequena, orientação paisagem e navegação por teclado (sem usar mouse).

## 5. Registro de evidências
Registrar data, navegador, versão do leitor de tela, plataforma, página, passos, esperado/observado, gravidade, captura ou áudio (com autorização). Abrir issue vinculada ao marco #6 para cada falha relevante.

## 6. Testes automatizados
```bash
npm install
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Os testes incluem axe-core, rotas, teclado, posição do botão, persistência, reflow e movimentos. A ausência de violações automáticas **não equivale à aprovação final**.
