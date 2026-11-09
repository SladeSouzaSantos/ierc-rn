# Aviso de hidratação causado por extensões

## Sintoma
No navegador com algumas extensões, o Next.js pode mostrar:
`A tree hydrated but some attributes of the server rendered HTML didn't match the client properties`

Exemplo observado no site em desenvolvimento:
`<body cz-shortcut-listen="true">`

## Causa e escopo
O atributo `cz-shortcut-listen` é associado à extensão ColorZilla. Ele pode ser
inserido na página antes de o React executar a hidratação. Não faz parte do HTML
produzido pelo IERC-RN.

O projeto utiliza `suppressHydrationWarning` **somente em `<body>`**.
Esta medida tolera atributos externos nesse elemento. Não desabilita a hidratação
nem silencia avisos de diferenças de conteúdo nos componentes internos.
Não aplicar a mesma propriedade em componentes por conveniência: diagnosticar a
causa real de qualquer outro erro de hidratação.

## Como confirmar
1. Recarregar `/eventos` em janela anônima com todas as extensões desativadas.
2. Comparar com a janela comum.
3. Se desaparecer, desativar ColorZilla ou outra extensão no `localhost` é
   uma alternativa durante o desenvolvimento.
4. Executar `npm run build` e `npm run test:e2e` para verificar regressões.

O teste `tests/hydration-extension.spec.ts` intercepta a resposta HTML e
insere `cz-shortcut-listen` antes da hidratação, sem instalar extensões.
Ele verifica carregamento da rota, interação do painel de acessibilidade e
ausência de avisos de hidratação no console.

## Referências
- https://nextjs.org/docs/messages/react-hydration-error
- https://github.com/vercel/next.js/discussions/72035
