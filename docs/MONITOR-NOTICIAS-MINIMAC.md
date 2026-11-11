# Monitor automático de notícias — MiniMac (DEV, somente leitura)

## Estado e finalidade

O arquivo [`compose.curator.monitor.yml`](../compose.curator.monitor.yml) entrega uma rotina Docker **independente do portal, Strapi e worker de geração de rascunhos**. O monitor faz a consulta RSS e registra quais notícias parecem relevantes para o IERC-RN, a inclusão no Brasil e experiências internacionais.

**A instalação ainda depende de ser executada no MiniMac.** Adicionar o arquivo ao repositório não inicia containers remotamente. Este Compose não contém senha, token de CMS ou chave de IA, não expõe portas, não pertence à rede privada do Strapi e **jamais publica notícias ou cria rascunhos**. Não é o fluxo `curator/src/cli.mjs schedule` que pode gerar Drafts; usa exclusivamente `curator/src/monitor.mjs`.

## Periodicidade

- **08h, 13h e 19h** (America/Fortaleza, horário de Natal).
- Faz **uma consulta ao inicializar** o serviço, para confirmar funcionamento sem esperar pelo horário.
- A execução agendada ocorre nos primeiros três minutos de cada horário; Redis usa chave `ierc:monitor:slot:AAAA-MM-DD:HH` com TTL de 3 dias para evitar duplicação do mesmo slot após reinício.
- Usa janela de 45 dias e até 20 registros por execução. A lista de fontes, os filtros de relevância, a distinção Brasil/mundo e a quarentena da Comissão Europeia são os mesmos da prévia homologada.
- Serviço `restart: unless-stopped`: retoma junto com o Docker **se o daemon Docker iniciar automaticamente**. Sem computador ligado e sem Docker, não existe consulta no horário perdido.
- A leitura de conteúdo original de terceiros segue as regras de licença existentes. O monitor **não baixa reportagens completas**, somente títulos e links dos feeds/listagens autorizados para descoberta; `previewOnly` continua restrito a descoberta e não vira publicação.

## No MiniMac

Em uma pasta própria para este repositório (não sobrescrever a implantação atual do portfólio), use a branch `dev`. Se o projeto ainda não estiver clonado:

```bash
git clone --branch dev https://github.com/SladeSouzaSantos/ierc-rn.git
cd ierc-rn
```

Se já estiver clonado e estiver na branch `dev`:

```bash
git pull --ff-only origin dev
```

Confira a configuração e inicie em background:

```bash
docker compose -f compose.curator.monitor.yml config
docker compose -f compose.curator.monitor.yml up -d --build
docker compose -f compose.curator.monitor.yml ps
docker compose -f compose.curator.monitor.yml logs --tail=80 monitor
```

O primeiro relatório é criado na inicialização, no volume Docker `monitor_reports`. Para ler o mais recente:

```bash
docker compose -f compose.curator.monitor.yml exec -T monitor cat /reports/latest.json
```

Para acompanhar próximas consultas:

```bash
docker compose -f compose.curator.monitor.yml logs -f --tail=50 monitor
```

Eventos relevantes: `monitor_started`, `feed_checked`, `source_paused`, `feed_unavailable`, `monitor_completed`. O relatório JSON contém timestamp, motivo (`startup` ou `scheduled`), totais, saúde das fontes, artigos com data/título/URL original, categoria Brasil/mundo e pontuação editorial. Os arquivos ficam no **volume privado do monitor**, com gravação atômica e retenção de até 90 relatórios (aproximadamente 30 dias em três execuções por dia). A nomenclatura é `monitor-AAAA...Z.json` e `latest.json`.

O comando de inspeção da rotina **não exige `curator/.env`, `cms/.env` ou tokens**. Use somente o Compose indicado. Não use o Compose antigo `compose.curator.dev.yml` para ativar publicação ou geração automática.

Para pausar sem apagar dados:

```bash
docker compose -f compose.curator.monitor.yml stop monitor
```

Para retomar:

```bash
docker compose -f compose.curator.monitor.yml start monitor
```

**Não execute `docker compose down -v`**: esse comando remove volumes e relatórios históricos. O serviço possui `read_only: true`, roda como usuário `node` sem privilégios, com armazenamento montado só em `/reports` e acesso de saída para consultar os sites RSS.

## Limites e próximos gates

1. **Consulta automática ≠ publicação automática.** Notícias coletadas vão para relatórios locais; não aparecem sozinhas em `/noticias` ou `/radar-da-inclusao`.
2. A amostra RSS da Agência Brasil retorna apenas os dez itens recentes por editoria. O monitor não faz busca histórica retroativa e não deve baixar indiscriminadamente o acervo. A ausência de itens relevantes na amostra não significa ausência de notícias no país.
3. Para produção do site no MiniMac, ainda serão necessários: HTTPS/reverse proxy, domínios oficiais, backup e restauração de PostgreSQL e volumes, segregação de ambientes e segredos, aprovação de conteúdo/direitos e testes manuais de acessibilidade.
4. Um incremento futuro poderá notificar a equipe editorial quando houver **novas** matérias relevantes, com links para revisão, sem publicar automaticamente. Isso exigirá armazenamento de estado específico do monitor e canal de notificação escolhido.

**Política de segurança:** o serviço `monitor` não carrega `env_file`, não utiliza credenciais ou rede do Strapi, nem inicializa os provedores LLM. Nenhum `CURATOR_AUTO_PUBLISH_ENABLED` é ativado. Seu início é seguro para homologação de RSS; não é autorização de PROD do CMS nem do site.

Relacionado: [Radar e fontes integrais](FONTE-INTEGRAL-REVIEW-DEV.md), [Roadmap](ROADMAP.md), [issue #13](https://github.com/SladeSouzaSantos/ierc-rn/issues/13).
