# IERC-RN — Sprint 2: fontes, evidências e aprovações

Revisão inicial: **09/11/2026**. Este repositório ainda é um protótipo para homologação institucional e não deve ser apresentado como site oficial já publicado.

## Registros utilizados no portal

| Fonte | Fatos suportados | Limites |
|---|---|---|
| [Acervo do IERC, 27/11/2010](https://iercrn.blogspot.com/2010/11/o-instituto-de-educacao-e-reabilitacao.html) | Fundação em 16/07/1952 por Ricardo César Paes Barreto; finalidade histórica de educação, habilitação e reabilitação. | Não inferir gestão, vagas, equipe, missão formal ou funcionamento atual. |
| [CBDV, entidades cadastradas no RN](https://www.cbdv.org.br/cbdv/entidades/entidades-cadastradas/rio-grande-do-norte) | Data de fundação e endereço Rua Fonseca e Silva, 1113, Alecrim, Natal. | Cadastro publicado em 2022, modificado em 2023. CEP/telefone divergem de fontes posteriores. |
| [CBDV, Regional Nordeste de Goalball — 15/04/2026](https://www.cbdv.org.br/regional-nordeste-de-goalball-comeca-no-dia-26-de-abril-em-campina-grande) | IERC listado com equipes masculina e feminina no Regional Nordeste, disputado de 26/04 a 02/05/2026. | Escalações se referem exclusivamente à temporada e publicação de 2026. |
| [CBDV, Série A — 18/08/2026](https://www.cbdv.org.br/serie-a-do-campeonato-brasileiro-de-goalball-2026-agita-sao-paulo-na-proxima-quinta-27) | Equipe feminina do IERC e nomes da comissão técnica/atletas citados na lista de 2026. | Informação esportiva histórica: não constitui elenco atual ou autorização de fotografia. |
| [TRE-RN, 16/09/2025](https://www.tre-rn.jus.br/comunicacao/noticias/2025/Setembro/tre-rn-realizara-acao-do-projeto-201ctodo-voto-importa201d-em-parceria-com-o-instituto-dos-cegos-do-rn) | Anúncio de parceria para ação eleitoral prevista em 22 e 23/09/2025, no endereço Rua Fonseca e Silva, 1113. | O anúncio não comprova a realização; telefone mencionado deve ser revalidado. |

## Critérios editoriais aplicados

- `lib/editorial-data.ts` centraliza somente registros rastreáveis; `components/editorial-records.tsx` apresenta fontes por link externo acessível.
- `/instituto`: linha do tempo documental e missão histórica atribuída ao acervo de 2010, sem afirmar que é a redação oficial vigente.
- `/esportes`: lista da Série A feminina de 2026 referenciada à CBDV, **sem sugerir elenco atual**. Não adicionamos fotos.
- `/historias`: pautas sem atribuir vínculo a pessoas. A lista inicial de nomes sugeridos fica somente na curadoria interna.
- `/noticias`: clipping de notícias **publicadas por terceiros**, não publicações fictícias do IERC.
- `/eventos`: arquivo de competições passadas. Não anunciar programação futura, horários ou inscrições sem confirmação.
- `/visitas`: apenas endereço verificado; URL existente do sistema de agendamento ainda não foi fornecida.
- `/contato`: apenas endereço e Instagram informado pelo responsável; não inventar telefonia, e-mail ou horário.
- `/apoie`: bazar informado às terças-feiras, ainda sujeito à ratificação de horário e logística; **sem dados financeiros**.
- Nenhuma fotografia, biografia, depoimento ou vídeo foi copiado da internet para o portal.

## Divergências documentadas — não publicar como dados atuais

1. **CEP:** CBDV usa `59030-270`; o TRE-RN de 2025 informa `59040-270`. Não exibimos CEP até homologação institucional.
2. **Telefone:** cadastro CBDV cita `(84) 3211-1030`; o TRE-RN citou `(84) 3201-6839` para a ação de 2025. Nenhum foi promovido a canal oficial atual.
3. **E-mail:** precisa de confirmação pela equipe. Não publicar endereço não homologado.
4. **Equipe, missão e cursos:** conteúdo histórico e atividades informadas pelo responsável; confirmar horários, público-alvo, vagas, nome correto de “leitura cursiva”, coordenação e missão formal.
5. **Bazar:** confirmar se segue às terças-feiras, quais horários, itens aceitos, local de entrega e funcionamento em feriados.
6. **Visitas:** obter link de agendamento oficial, acessibilidade das visitas e orientações a grupos, sem criar agenda concorrente.
7. **Esporte:** confirmar elencos atuais, calendário, resultados e consentimento para perfis e imagens.
8. **Ex-alunos:** validar vínculo, dados biográficos e autorização antes de publicar pessoas como ex-alunos.
9. **Galeria e depoimentos:** obter originais, créditos, autorização de uso, texto alternativo e consentimento de responsáveis por menores.
10. **Governança:** indicar responsáveis institucionais por redação, revisão, publicação e retirada de conteúdo.

## Gate de publicação

Aprovação institucional dos fatos e identidade visual; auditoria manual com NVDA, VoiceOver e TalkBack; teste em navegador real a 200%/400%; checagem de links externos; avaliação de privacidade/LGPD e de autorização do acervo.

Os testes automatizados com Playwright e axe-core **não substituem** a homologação humana.
