# EBC — descoberta complementar por listagem oficial (DEV)

## Diagnóstico da lacuna RSS — 11/11/2026

No MiniMac, os quatro feeds autorizados à autopublicação da EBC retornaram
10 notícias cada e **0 candidatas** às 08h e 13h. O worker funcionou e as
fontes não autorizadas foram corretamente bloqueadas. Esse resultado NÃO
prova que não existam reportagens sobre deficiência visual.

Uma matéria real publicada em 08/11/2026:
[Enem 2026 estreia apoio emocional e novas regras de acessibilidade](https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-2026-estreia-apoio-emocional-e-novas-regras-de-acessibilidade)
aparece na listagem oficial https://agenciabrasil.ebc.com.br/educacao.
O texto integral menciona baixa visão, auxílio para leitura e prova em
Braille. **Uma listagem não é autorização de publicação no IERC.**

A página oficial exibe navegação ?page=1 e cards datados. O robots.txt
oficial vigente em 11/11/2026 traz User-agent: * e Crawl-delay: 10,
além de proibir caminhos como /search/, /admin/ e /user/.
A descoberta usa somente páginas públicas de editoria.

## Implementação

- src/ebc-archive.mjs: parser estrito da listagem pública EBC.
  - Somente as editorias já aprovadas para **leitura integral EBC**:
    educação, direitos-humanos, esportes e internacional.
  - No máximo duas páginas públicas (0 e 1) por execução.
  - Requisições GET separadas por pelo menos 10 segundos dentro da
    execução, inclusive para artigos; sem seguir redirecionamentos.
  - Host HTTPS, caminho de notícia na editoria, data válida e
    recência máxima de 45 dias; até duas matérias para evidência integral.
  - Termos no título são pistas preliminares e NÃO elegibilidade editorial.
    O leitor existente fetchArticleEvidence exige autoria EBC, corpo
    integral e ausência de restrição/autor de agência parceira.
  - Correspondência visual direta apenas quando a evidência verificada
    contém elementos específicos de cegueira/baixa visão/Braille.
    O conteúdo do artigo não é enviado aos logs ou arquivos.
- src/check-ebc-archive.mjs: CLI manual sem CMS, Redis, LLM, tokens,
  escrita em arquivo nem acesso ao worker publicador.
- tests/ebc-archive.test.mjs: paginação, datas, autorização, links, direitos
  e espaçamento de requisições.
- Comando npm: npm run sources:ebc:archive -- --section=educacao --pages=2 --max-evidence=2.

O status visual_evidence_verified_for_review identifica somente uma
matéria com direitos/evidência de leitura verificados. NÃO dispensa
geração original com IA, revisão independente, dedupe e autorização
Strapi. Nenhuma notícia é criada ou publicada pelo diagnóstico.

## Homologação no MiniMac (monitor existente)

~~~bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
git rev-parse --short HEAD

docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml up -d --build monitor

# Somente leitura; 1 editoria, 2 páginas, até 2 artigos.
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml exec -T monitor \
  node src/check-ebc-archive.mjs --section=educacao --pages=2 --max-evidence=2

# Conferir novo timestamp, sem imprimir notícias inteiras.
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml exec -T monitor \
  node -e 'const r=JSON.parse(require("fs").readFileSync("/reports/latest.json","utf8"));console.log(JSON.stringify({date:r.generatedAt,reason:r.reason,summary:r.summary},null,2))'

# Verificar worker IA sem tocar sua configuração.
docker compose --env-file curator/.env -f compose.curator.dev.yml --profile curator ps
~~~

**Atenção a logs antigos:** o monitor foi reiniciado às 15h10 BRT
(18:10Z), mas latest.json lido tinha sido gerado às 14h43 BRT (17:43Z),
quando o novo startup ainda não havia concluído. Exigir monitor_completed
e timestamp novo para declarar o ciclo homologado.

## Próximo gate — integração controlada ao worker IA

1. Homologar no MiniMac uma matéria real como
   visual_evidence_verified_for_review, com URL/data/autoria EBC.
2. Confirmar que a listagem traz casos não vistos no RSS e verificar
   a licença individual. Não confundir descoberta com licença ou aprovação.
3. Implementar integração **opt-in** com o worker após o gate 1:
   conservando leitura integral, checagem de direitos, duas fases de IA,
   deduplicação CMS/Redis, quotas, maxArticles=1 e revisão editorial.
4. Observar a primeira publicação REAL em Strapi DEV e Radar, incluindo
   operação de retirada. NÃO fazer merge, deploy PROD ou publicar
   matérias artificiais para forçar um resultado.

Monitor e worker são independentes: autoPublish:false no monitor
NÃO significa desligar a autopublicação da issue #14.
Nenhuma mudança aqui modifica compose.curator.dev.yml, credenciais,
allowlist, dados persistidos ou main. Rastreamento: #14 e #18.


## Diagnóstico de zero resultados — estrutura HTML da listagem

Na primeira validação operacional do commit 140cfbf, o monitor foi reconstruído
com sucesso, mas a CLI retornou duas páginas verificadas e 0 itens
datados. Esse resultado NÃO deve ser interpretado como zero notícias
no site oficial: o HTML público visto fora do MiniMac contém cards
datados e links de matérias.

A partir do commit 8ff0e4c, cada ebc_archive_page_checked possui
diagnostics com contadores sem conteúdo de terceiros:

- cardsFound: quantidade de cards .ultima-noticia encontrados;
- linksMissing: nenhum link de título encontrado;
- titlesInvalid: título vazio, curto ou acima do limite;
- urlsRejected: URL fora de HTTPS, domínio ou categoria autorizada;
- datesUnrecognized: data ausente ou não interpretável;
- datesOutsideWindow: data fora da janela máxima de 45 dias;
- duplicates: URLs duplicadas na mesma página;
- accepted: itens estruturais aceitos.

Se accepted = 0 e cardsFound > 0, classificar como PARSER/HTML não
homologado; não afirmar que não há notícias. A correção da causa real
ainda depende de novo log do MiniMac; não remover barreiras de segurança.

~~~bash
cd /opt/projects/ierc-rn-dev
git pull --ff-only origin dev
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml up -d --build monitor
docker compose -p ierc-rn-monitor-dev -f compose.curator.monitor.yml exec -T monitor \
  node src/check-ebc-archive.mjs --section=educacao --pages=2 --max-evidence=2
~~~

Nenhuma mudança foi realizada no worker de autopublicação. Continuar
respeitando os direitos de terceiros e o intervalo de 10 segundos.
