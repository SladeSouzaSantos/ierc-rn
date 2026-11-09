# Sprint 3.1 — CMS editorial do IERC-RN

## Arquitetura

**DEV e PROD separados:** [consulte arquitetura, portas, bancos/volumes, geração de segredos independentes e diagnóstico de lentidão do Content Manager](CMS-ENVIRONMENTS.md). O arquivo `compose.cms.yml` é o DEV existente e continua preservando o usuário administrador já criado. A PROD futura usa `compose.cms.prod.yml`, sem inicialização automática.

O portal **Next.js 15.5/React 19** permanece intacto em `/`; o gerenciador **Strapi 5.59 (React 18)** executa isolado em `cms/`, com PostgreSQL 17 em volume persistente. A separação evita alterar a base visual já aprovada e respeita as faixas de compatibilidade do Payload/Next.js publicadas em novembro de 2026.

O CMS possui o próprio painel de administração, autenticação, RBAC, mídia e Draft & Publish. A origem pública do portal **não** publica as rotas `/admin` e `/api` do Strapi. O Docker vincula o CMS em **127.0.0.1:1337**, sem acesso externo ou porta exposta do banco.

### Coleções

| Modelo | Conteúdo | Observações |
| --- | --- | --- |
| `news-articles` | Notícias com título, resumo, texto, categoria, fonte e data | URL pública `/noticias/[slug]` somente para conteúdo aprovado |
| `events` | Agenda, local, datas e link de inscrição | Sem datas inventadas |
| `activities` | Atividades, categorias, horários e instruções | Atualizações aprovadas podem complementar as oito atividades atuais |
| `athletes` | Trajetórias, vínculo histórico e referências | Sem presumir que atleta de 2019 represente o IERC hoje |
| `galleries` | Galerias editoriais | Dependentes do módulo de autorização de mídia |
| `media-records` | Arquivos com texto alternativo, créditos, licença e comprovante | Direitos devem ser avaliados **por arquivo** |
| `site-settings` | Missão, contatos, atendimento e URL de agendamento | Um único registro; dados ainda não confirmados não são expostos |

Os schemas ficam em `cms/schemas.mjs`; `cms/scripts/generate.mjs` gera os arquivos nativos do Strapi. A geração é determinística e verificada com `node --test cms/tests/schema.test.cjs`.

## Instalação local

Pré-requisitos: **Docker Desktop/Engine**, Docker Compose v2, **Node.js 22+** para gerar o arquivo de configuração. Não é necessário mexer em dependências ou na build do Next.js.

```bash
git switch dev
git pull --ff-only origin dev

# Cria cms/.env com segredos aleatórios e permissões restritas (não sobrescreve).
node cms/scripts/init-env.mjs

# Inicializa PostgreSQL + painel Strapi; porta disponível apenas neste computador.
docker compose --env-file cms/.env -f compose.cms.yml up -d --build

# Consultar estado e logs:
docker compose --env-file cms/.env -f compose.cms.yml ps
docker compose --env-file cms/.env -f compose.cms.yml logs -f cms
```

Abra **http://localhost:1337/admin** e crie o primeiro administrador. **Não use senha de exemplo nem publique essa porta na internet**.

No painel, visite *Content Manager* para cadastrar conteúdo. Os estados de publicação são independentes: **Draft & Publish** do Strapi e o campo **`editorialStatus`** (`em_preparacao`, `em_revisao`, `aprovado`). O portal exige **ambos**: documento efetivamente publicado no Strapi e `editorialStatus=aprovado`. Conteúdos desatualizados ou não aprovados não devem ser marcados como aprovados.

### Papéis

No Strapi: **Settings → Administration panel → Roles**. O primeiro login cria um *Super Admin*. Atribua a quem redige o papel **Author**, e a quem revisa/publica **Editor**. O Strapi Community inclui RBAC. Confirme as permissões no painel antes de convidar outras pessoas; não crie usuários com Super Admin por conveniência. **É necessário validar o fluxo real de publicação, permissões e teclado em ambiente local antes de homologar.**

### Conectar o portal às publicações

No Strapi, crie **Settings → API Tokens → Create new API Token**, de tipo **Read-only**; nunca Full Access. Guarde o token apenas no seu computador ou no ambiente servidor. As permissões públicas das coleções podem continuar **desativadas**.

No arquivo `.env.local` da raiz (git-ignored):

```dotenv
CMS_ENABLED=true
CMS_API_URL=http://127.0.0.1:1337
CMS_READ_TOKEN=COLE_AQUI_O_TOKEN_DE_LEITURA
```

Não use `NEXT_PUBLIC_` para o token. Execute `npm run dev` na raiz do site. Apenas o servidor Next.js consulta o Strapi; a credencial nunca é enviada ao navegador. Com o CMS desligado ou token ausente, **o portal permanece com o conteúdo atual da Sprint 2**, sem falha de carregamento.

Integração disponível na Sprint 3.1: lista de notícias e detalhes `/noticias/[slug]`, agenda em `/eventos`, atualização/adicionamento de atividades na página e homepage, e novos perfis aprovados em `/historias`. Os nove perfis documentais originais continuam intactos e não são duplicados quando o slug coincide. As galerias e configurações institucionais já têm modelos no CMS, mas a exibição pública exige um incremento específico de aprovação.

### Regras de segurança/editorial

- **Strapi não deve ser publicado externamente** até configurar HTTPS, autenticação, backup de banco/mídia, proxy reverso, limitação de acesso e revisão das permissões de usuários.
- A conta admin, o banco e os tokens não são compartilhados via GitHub; `cms/.env` e `.env.local` ficam ignorados.
- Sem conteúdo fictício, pagamento, Pix ou URL de visitas inventada.
- **Nenhuma foto nova do CMS é renderizada pelo Next.js nesta fase.** O cadastro contém `imageRightsStatus`, `imageAlt`, `imageCredit`, `licenseEvidence` e/ou um `media-record` individual; integração visual depende de licença e consentimento documentados.
- Não habilitar permissões públicas de edição em *Users & Permissions*. A integração usa token de leitura apenas para registros aprovados e publicados.
- O texto recebido é tratado como texto puro, sem HTML arbitrário nem `dangerouslySetInnerHTML`. Links externos só são usados quando têm protocolo HTTP(S).
- CMS indisponível, sem token ou com erro: resultado vazio, sem derrubar o site.
- **Arquivos de mídia e PostgreSQL têm volumes separados e precisam de backup regular.** Não execute `docker compose down -v` sem backup.
- O primeiro cadastro de admin e o teste de inicialização com Docker **precisam ser realizados em máquina com Docker**, pois a verificação de geração de schemas e CI do Next.js não substituem uma homologação real do Strapi.

### Encerramento local

```bash
docker compose --env-file cms/.env -f compose.cms.yml down
```

Isso desliga os serviços **preservando** os dados dos volumes. Para não perder conteúdo, nunca acrescente `-v` sem motivo documentado.

## Gate para Sprint 3.2

1. Subir Strapi no Docker e realizar primeiro login em `/admin`.
2. Cadastrar uma notícia de teste *sem* aprovar: não deve aparecer no site.
3. Publicar como rascunho de homologação, verificar papéis Author e Editor e definir `editorialStatus=aprovado`: deve aparecer somente depois da publicação efetiva.
4. Verificar CMS offline, atualização de atividades e validade dos links de notícias; inspecionar logs sem exposição de tokens.
5. Testar painel com teclado, NVDA/VoiceOver, zoom 200%/400% e validar experiência com a equipe do IERC.
6. Só então considerar infraestrutura, backups, fotografia licenciada e URL pública de administração.

Referências: [Strapi instalação Docker](https://docs.strapi.io/cms/installation/docker), [Draft & Publish](https://docs.strapi.io/cms/features/draft-and-publish), [RBAC](https://docs.strapi.io/cms/features/rbac), [REST API](https://docs.strapi.io/cms/api/rest).

## Endereço correto do painel e correção de favicon (09/11/2026)

A URL local é exatamente `http://localhost:1337/admin` (sem asteriscos, barras extras ou parâmetros como `utm_source`). Um link copiado com `/admin**?utm_source=chatgpt.com` gera HTTP 404 mesmo com o Strapi saudável.

O primeiro boot do Docker em Windows confirmou Strapi 5.59, PostgreSQL saudável e `/_health` HTTP 204. A imagem inicial registrava `ENOENT: /opt/app/favicon.png` em chamadas a `/favicon.ico`, um problema independente do login. O gerador agora inclui um favicon PNG provisório; o CI verifica sua existência, a rota exata `/admin` e o retorno HTTP 200 de `/favicon.ico`. O arquivo provisório deverá ser substituído pela marca oficial após validação institucional.

A correção do favicon **não é necessária para criar o administrador** nem justifica um rebuild imediato da imagem Docker se o painel `/admin` já abre. Na próxima reconstrução, execute no PowerShell em uma única linha:

```powershell
docker compose --env-file cms/.env -f compose.cms.yml up -d --build
```

Para observar o status sem expor credenciais: `docker compose --env-file cms/.env -f compose.cms.yml ps`.


## Diagnóstico opt-in de CSP no DEV (sem alterar PROD)

O erro do Chrome *"Content Security Policy ... blocks the use of eval"* não comprova, isoladamente, a causa do spinner. A issue [Strapi #28303](https://github.com/strapi/strapi/issues/28303) também descreve um problema de redirecionamento no Content Manager 5.59.0. É necessário comparar comportamentos.

**Proteção:** a CSP padrão permanece intacta. Foi adicionado um controle explicitamente temporário, que só ativa a diretiva `script-src 'self' 'unsafe-eval'` quando `CMS_INSTANCE_KIND=dev` **e** `CMS_DIAGNOSTIC_UNSAFE_EVAL=true`. O arquivo PROD não define `CMS_INSTANCE_KIND=dev`. Não liberamos `unsafe-inline`, `https:` genérico ou mudanças de CORS, imagens ou mídia. O uso de `unsafe-eval` aumenta o risco de XSS, mesmo localmente, e não deve ser utilizado como solução permanente.

Para testar no **PowerShell** (no diretório raiz do repositório):

```powershell
git switch dev
git pull --ff-only origin dev

# Só o CMS: reconstrói a imagem com o novo controle sem apagar banco/volumes.
$env:CMS_DIAGNOSTIC_UNSAFE_EVAL="true"
docker compose --env-file cms/.env -f compose.cms.yml up -d --build --no-deps cms

# Com a autenticação já existente, abrir novamente:
Start-Process "http://localhost:1337/admin/content-manager"

# Confira no Console e na aba Network se o spinner mudou.
# Verifique se o cabeçalho contém unsafe-eval neste teste:
curl.exe -s -D - -o NUL "http://localhost:1337/admin" | Select-String "content-security-policy"
```

Se aparecerem erros, reúna a **primeira exceção da aba Console**, sem tokens/cookies. Teste também a rota direta `/admin/content-manager/collection-types/api::news-article.news-article`. A reconstrução com cache pode ser demorada no Windows; não execute `down -v`.

**Desativar após o teste (sem rebuild):**

```powershell
Remove-Item Env:CMS_DIAGNOSTIC_UNSAFE_EVAL -ErrorAction SilentlyContinue
docker compose --env-file cms/.env -f compose.cms.yml up -d --no-deps --force-recreate cms
```

Esse segundo comando recria só o contêiner do CMS, reutilizando os volumes existentes e a mesma imagem. Confirme `docker compose --env-file cms/.env -f compose.cms.yml ps`. Não instale plugins, não use `strapi develop` nem limpe diretórios temporários de uma instalação diferente para esse teste. Se liberar `unsafe-eval` não resolver, não mantenha o flag ativo: investigue redirecionamento, erros React e rede em vez de enfraquecer a política permanentemente.
