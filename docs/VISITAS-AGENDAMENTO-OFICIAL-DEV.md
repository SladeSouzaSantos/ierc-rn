# IERC-RN — Agendamento oficial de visitas (DEV)

## Formulário confirmado pela instituição

A administração do IERC-RN forneceu em 12/11/2026 a URL de agendamento:
**https://forms.gle/NY35YEEkbL6HM2YF9**.

A consulta externa ao endereço, em 12/11, retornou HTTP 200 e o título
**“Formulário - AGENDAMENTO DE VISITA”**, identificando
“Instituto de Educação e Reabilitação de Cegos do RN”.

O Google Forms solicita informações de organização/grupo, quantidade de
participantes, turma/faixa etária, data/horário e duração desejados,
objetivo e contatos do responsável; existe um campo chamado
“Contribuição Solidária (OPÇÃO)”. O portal **não copia, coleta nem grava**
esses dados e não processa pagamentos. Orientações, disponibilidade,
contribuições e eventuais condições devem ser confirmadas pelo Instituto
e pelo formulário vigente.

## Implementação no portal

A página `/visitas` aponta para o formulário oficial com CTA
**“Solicitar agendamento de visita”**. O link abre em nova aba, com
`rel="noopener noreferrer"` e indicação acessível de nova aba.
Não há formulário ou iframe integrado no Next.js.

O texto explica que:
- o envio é uma **solicitação**; não confirma automaticamente uma reserva;
- datas, horários e condições de acessibilidade devem ser confirmados
  com a equipe do IERC-RN;
- os dados são preenchidos em **Google Forms**, serviço externo.

O endereço informado pelo Instituto está no código como fallback seguro,
em `lib/visit-booking.ts`. Não há QR Code, Pix ou checkout no portal
de visitas; o campo de contribuição é do formulário externo e não foi
reescrito ou divulgado como dado financeiro do portal.

## Atualizar o link no Strapi, sem mudar o código

A coleção existente **Configurações institucionais** (Single Type)
possui o campo **`visitBookingUrl`**. Quando o conteúdo estiver
**publicado** e com **`editorialStatus=aprovado`**, o Next.js tenta
ler esse campo via `/api/site-setting?status=published`, com token
privado de leitura (cache de 60 segundos). As opções são:

1. Acessar o Strapi DEV e abrir
   Content Manager → **Configurações institucionais**.
2. Editar `visitBookingUrl` com um endereço HTTPS de Google Forms
   conferido pela coordenação; preencher também os campos requeridos
   da configuração institucional (ex.: `siteName`).
3. Registrar uma referência de aprovação e aprovar editorialmente.
4. Publicar, verificar o botão de `/visitas` e confirmar que o novo
   link aponta para o formulário institucional correto.
5. Quando houver token tipo **Custom**, habilitar somente a permissão
   de leitura `find` do Single Type `site-setting`; não liberar
   create/update/delete e não divulgar o token.

**Defesa:** o site só aceita URLs HTTPS dos hosts exatos
`forms.gle` ou `docs.google.com/forms/d/e/.../viewform`;
parâmetros de consulta e fragmentos são descartados. A validação do
host não garante propriedade do formulário: a equipe precisa verificar
o destino antes de aprovar. Se a configuração estiver ausente,
não publicada, indisponível, sem permissão ou inválida, o botão usa
a URL oficial previamente informada, sem quebrar o portal.

**Não alterar `cms/schemas.mjs` nem migrar PostgreSQL**: o campo já
existia no CMS. A leitura permanece privada no servidor.

## Homologação e atualização DEV

1. CI `dev`: testes `tests/sprint2-content.spec.ts` e
   `tests/visit-booking.spec.ts` confirmam link, nova aba, texto,
   ausência de formulário local, responsividade e acessibilidade
   automatizada na rota.
2. Após CI aprovado, no MiniMac `dev`, reconstruir exclusivamente o
   portal com `compose.portal.dev.yml`, sem reiniciar Strapi/Redis/worker.
3. Conferir `http://localhost:3101/visitas` e abrir o formulário
   oficial a partir do botão. **Não enviar dados fictícios reais**
   nem marcar uma visita por teste sem combinar com a instituição.
4. Verificar manualmente teclado, leitor de tela, zoom 200/400%,
   comportamento em nova aba e a redação do aviso de privacidade.
5. Verificar se o Strapi possui autorização de leitura do Single Type
   somente caso a equipe queira alterar o link pelo painel.

Só fechar a issue #3 depois de confirmar **no MiniMac** o CTA
funcional, sua acessibilidade e, se for desejada, a configuração
no Strapi com aprovação editorial. A produção, `main`, PR #12 Draft
e publicação automática do Radar não são alterados neste incremento.
