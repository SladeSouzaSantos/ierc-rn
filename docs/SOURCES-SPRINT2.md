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
- `/historias`: cinco biografias com vínculos historicamente documentados e referências; perfis sem comprovação permanecem somente na curadoria. Fotografias de terceiros são prévias em homologação e precisam de autorização antes da publicação oficial.
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

## Histórias de atletas — curadoria de 09/11/2026

A página `/historias` contém **cinco** perfis com vínculo explícito e fontes primárias ou jornalísticas. Eles **não são declarados ex-alunos** sem prova específica. As conquistas posteriores não são apresentadas como títulos conquistados pelo IERC.

| Pessoa | Vínculo documentado | Destaque esportivo registrado | Fonte |
|---|---|---|---|
| Thalita Vitória Simplício | Conheceu Clara Daniele no Instituto; atuação prévia em modalidades esportivas. | Prata nos 400m T11 em Paris 2024; ouro mundial nos 400m em Nova Déli 2025. | [CPB — Thalita](https://cpb.org.br/atletas/thalita-vitoria-simplicio-da-silva/), [CPB — Clara](https://cpb.org.br/atletas/clara-daniele-da-silva/) |
| Clara Daniele Barros da Silva | Conheceu Thalita no IERC, onde praticava karatê. O goalball por sete anos ocorreu em **outra associação**. | Ouro nos 200m T12, Mundial 2025. | [CPB — Clara](https://cpb.org.br/atletas/clara-daniele-da-silva/) |
| Sharlley Anthony do Nascimento Silva | Conheceu o goalball no IERC em **2018**. | Convocações da seleção em 2026 e bronze no Mundial de Goalball de 2026. | [CPB — trajetória](https://cpb.org.br/noticias/jovens-do-goalball-buscam-primeira-chance-em-mundial-da-modalidade/), [SESI-SP — bronze](https://mogidascruzes.sesisp.org.br/noticia/atletas-do-sesi-sp-conquistam-medalha-de-bronze-com-a-selecao-brasileira-no-mundial-de-goalball) |
| Geovana Clara Costa de Moura | Aparece como atleta **IERC-RN em convocação de 2016**. Posteriormente atuou em outras associações. | Convocação para seleção adulta, medalha no Mundial de Jovens 2017, Paris 2024. | [CPB — convocação de 2016](https://cpb.org.br/noticias/cbdv-divulga-convocacao-da-selecao-brasileira-feminina-de-goalball-para-a-i-fase-de-treinamento-do-ano/), [SESI-SP — contratação de 2025](https://mogidascruzes.sesisp.org.br/noticia/conheca-as-novas-contratacoes-das-equipes-feminina-e-masculina-do-sesi-sp-e-o-impacto-do-programa-paralimpico) |
| Maria Clara Nascimento | Entrevistada como praticante de goalball do IERC em **julho de 2026**. | Trajetória de esporte e formação acadêmica descrita em reportagem. | [Tribuna do Norte — 18/07/2026](https://tribunadonorte.com.br/rio-grande-do-norte/cegos-transformam-desafios-e-conquistam-mais-autonomia/) |

**Identificação em aberto:** a reportagem nomeia “Maria Clara Nascimento”, e a CBDV lista “Maria Clara Diniz do Nascimento” nas equipes do IERC-RN. Não unificar os registros nem adicionar sobrenomes não confirmados sem identificação inequívoca pela instituição.

### Fotografias no ambiente DEV

Em `dev`, quatro perfis possuem **referência remota para fotografias publicadas por terceiros**, com alt descritivo, crédito do veículo, link original e aviso de autorização pendente:

- **Thalita:** fotografia publicada na Secom/Gov.br sobre Paris 2024; autor/licença individual não verificados.
- **Clara:** foto jornalística publicada pelo ge/RN na cobertura do Mundial 2025.
- **Sharlley:** fotografia coletiva dele com Parazinho divulgada pelo SESI-SP, sem corte que transforme a imagem em retrato individual.
- **Geovana:** fotografia individual divulgada pelo SESI-SP em anúncio de contratação de 2025.
- **Maria Clara:** sem fotografia pessoal inequívoca; substituída por estado ilustrativo/textual, evitando identificação errada.

**Direitos e publicação:** link e crédito não constituem licença de reprodução; foto disponível publicamente também não significa uso livre. Antes de promover a galeria/biografias à `main` ou ao portal oficial, obter permissão/licença dos titulares (ou fotos cedidas pelo IERC/atletas), comprovar o direito de exibição e registrar autor, legenda, descrição acessível, prazo/escopo e autorização pessoal quando pertinente. A integração não salva arquivos de terceiros no repositório; a disponibilidade das imagens externas depende do servidor de origem.

**Outros nomes na pauta:** Rosicleide Andrade, Romário Marques e Halyson Boto têm histórico esportivo público, mas o **vínculo individual com o IERC** ainda não está inequivocamente documentado nas fontes consultadas. Não publicar como ex-alunos até apuração.
