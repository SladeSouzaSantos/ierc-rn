# IERC-RN · Apoie o Instituto — informações do Bazar Solidário (DEV)

**Atualizado:** 11/11/2026. **Branch:** `dev`. **Escopo:** Sprint 4.1, `/apoie`.

## Fonte e limites de confirmação

Informações operacionais repassadas ao responsável pelo portal por uma pessoa
da instituição em 11/11/2026. Consideradas suficientes para atualizar o
ambiente de homologação **DEV**; a publicação definitiva em `main` exige
confirmação editorial final junto à administração do IERC-RN.

Não expor nomes de pessoas encarregadas da entrega sem autorização para
divulgação pública. Nenhum telefone ou contato pessoal foi adicionado.

## Bazar Solidário — informações recebidas

| Item | Informação |
| --- | --- |
| Dia e horário das vendas | **Terças-feiras, das 8h às 11h** |
| Local do bazar | **Sede do IERC-RN**, Rua Fonseca e Silva, 1113, Alecrim, Natal/RN (endereço já documentado no portal) |
| Quem pode comprar | Qualquer pessoa |
| Pagamento das compras | **Dinheiro ou Pix presencial**, com instruções fornecidas no próprio bazar |
| Entrega de doações de itens | **Segunda a quinta-feira, das 8h às 11h**, presencialmente na sede |
| Itens aceitos | **Roupas, sapatos e bolsas em bom estado** |
| Serviço de coleta | **Não há coleta domiciliar** |
| Parcerias institucionais | Instituição informou que recebe propostas de parceria de empresas e organizações, incluindo materiais e serviços; detalhes a combinar com a equipe |

A referência à equipe de recebimento não exige publicação de nomes ou
dados de contato de pessoas físicas. Por segurança, confirmar mudanças
excepcionais de funcionamento ou feriados antes de deslocamentos.

### Pix do bazar NÃO é o Pix de doações

Duas operações distintas:
1. **Compra presencial no bazar:** o IERC-RN informou aceitar dinheiro ou
   Pix. A página explica isso **sem criar botão de pagamento** e sem
   supor qual chave ou conta é usada presencialmente.
2. **Doação financeira ao IERC-RN:** a instituição confirmou existir Pix
   oficial e autorizou sua futura divulgação. **Chave, titular da conta,
   vínculo com a pessoa jurídica e autorização final dos dados exibidos
   ainda não foram apresentados/validados**. Não publicar chave, QR Code,
   conta bancária ou link de pagamento nesta etapa.

Não há formulário, armazenamento de dados financeiros, processamento de
pagamentos, webhooks, gateway ou função de checkout na aplicação.

## Mudança no portal

`components/support-page.tsx`:
- informa hora/dia do bazar e endereço já documentado;
- explica itens em bom estado, horários de entrega e impossibilidade de coleta;
- informa acesso público ao bazar e Pix/dinheiro como pagamento presencial;
- apresenta somente parcerias com empresas e organizações, sem bloco de voluntariado, e direciona propostas à página `/contato`;
- diferencia claramente doações financeiras futuras de pagamentos de compras;
- mantém contato via `/contato` e perfil Instagram informado, sem dados fictícios.

Nenhum schema do Strapi, Docker Compose, Redis, worker IA, monitor, volume
ou configuração de produção foi alterado. O conteúdo será editável pelo
CMS somente após escolha e homologação de modelo administrativo apropriado.

## Critérios automatizados

`tests/support-page.spec.ts` cobre as informações do bazar, a separação
dos dois tipos de Pix, ausência de QR Code/chaves/formulários e dados pessoais
de responsáveis, links internos e externos, alinhamento de ícones, reflow
(320/375/768/1440 px) e WCAG A/AA com axe-core.

Testes automatizados não equivalem a teste assistivo humano de navegação
por teclado, ampliação 200/400%, NVDA, VoiceOver ou TalkBack.

## Perguntas que permanecem para a visita de 12/11/2026

- Confirmação administrativa do horário, endereço e informações recebidas,
  especialmente funcionamento em feriados/recessos;
- Telefone/WhatsApp/e-mail **institucional** que pode ser divulgado;
- Quem aprova notícias, eventos, fotos e permissões de edição do Strapi;
- Próximos eventos, campanhas e atividades institucionais, com datas aprovadas;
- Licenças/consentimentos de imagens, especialmente menores e atendidos;
- Condições e canal institucional para propostas de parceria;
- Validação formal e documental da chave Pix de doações financeiras,
  titularidade, suporte e política de prestação de contas, caso se decida
  habilitar essa segunda etapa.

## Homologação do portal DEV

Após CI do portal aprovado:

```bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
git rev-parse --short HEAD

docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml up -d --build portal

docker compose --env-file deploy/.env.portal.dev \
  -f compose.portal.dev.yml ps
```

Conferir `http://127.0.0.1:3101/apoie`. Não reconstruir Strapi, worker IA,
monitor ou Redis; não usar `down -v` e não alterar produção.

As issues #9 e #4 permanecem abertas: a página informativa e o Pix
financeiro são entregas distintas.

## Ajuste editorial de 13/11/2026

Por solicitação do responsável pelo portal, a página `/apoie` passou a
apresentar **parcerias institucionais** sem divulgar voluntariado. O cartão de
parcerias descreve propostas de apoio com materiais ou serviços e conduz aos
canais oficiais em `/contato`. O Bazar Solidário, as orientações para doações
presenciais e as precauções para Pix permanecem inalterados.
