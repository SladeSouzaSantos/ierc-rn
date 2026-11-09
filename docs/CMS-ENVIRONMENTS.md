# IERC-RN — ambientes DEV e PROD (CMS, portal e Docker)

**Situação:** DEV já existe localmente e contém a primeira conta administrativa; PROD está apenas preparada para futuro deploy. Não iniciar PROD antes da homologação e de definir os procedimentos de backup, DNS e HTTPS.

## Separação de ambientes

| Item | DEV existente (preservado) | PROD futura (isolada) |
| --- | --- | --- |
| Branch de referência | `dev` | `main` (após PR aprovado) |
| Site Next.js | `npm run dev` ou homologação | build/deploy da `main`, a definir |
| Compose Strapi | `compose.cms.yml` | `compose.cms.prod.yml` |
| Projeto Docker | `ierc-rn-cms` | `ierc-rn-cms-prod` |
| Segredos | `cms/.env` (JÁ CRIADO!) | `cms/.env.prod` (novo, apenas quando aprovado) |
| Admin no mesmo host | `http://localhost:1337/admin` | `http://localhost:1338/admin` |
| Banco | `ierc_cms` | `ierc_cms_prod` |
| Volume PostgreSQL | `ierc-rn-cms_ierc_cms_pg` | `ierc-rn-cms-prod_ierc_cms_pg_prod` |
| Volume de mídia | `ierc-rn-cms_ierc_cms_uploads` | `ierc-rn-cms-prod_ierc_cms_uploads_prod` |
| Usuários, tokens e sessões | Exclusivos do DEV | Exclusivos do PROD |
| Exposição externa | Não; acesso em localhost | Não; precisa de HTTPS e proxy autorizados |

**Compatibilidade:** a instância DEV já configurada utiliza `NODE_ENV=production` dentro do contêiner porque executa um painel pré-compilado (`strapi start`). Isso não a transforma em ambiente PROD: o isolamento lógico é determinado pelo projeto Compose, banco, volumes, segredos, base de URLs e governança. Não trocar de `strapi start` para `develop` apenas por causa do nome DEV: o modo watch reconstroi o painel e pode usar mais recursos.

### Regras para proteger os dados existentes

- **Não renomeamos** o projeto `ierc-rn-cms`: isso criaria volumes diferentes e pareceria que o usuário administrador desapareceu.
- **Não executamos `docker compose down -v`, `docker volume prune`, `docker system prune --volumes` nem recriamos o banco DEV.**
- O `node cms/scripts/init-env.mjs` sem argumentos continua respeitando `cms/.env` existente: não o sobrescreve.
- PROD necessita de segredos totalmente novos, criados explicitamente com `node cms/scripts/init-env.mjs --prod` e salvos em `cms/.env.prod`. Nunca copiar os segredos do DEV para PROD.
- Nenhum conteúdo, atleta, mídia ou usuário do DEV é migrado automaticamente à PROD. Essa transferência requer seleção e aprovação institucional, além dos direitos autorais.

## Operação DEV no PowerShell (Windows)

Todos os comandos devem ser executados na raiz do repositório, **em uma linha**, sem barra invertida `\` de continuação.

```powershell
# Estado atual: não reconstrói nem perde dados
docker compose --env-file cms/.env -f compose.cms.yml ps

# Consumo instantâneo de CPU, memória, rede e I/O
docker stats --no-stream

# Logs de falhas recentes do Strapi
docker compose --env-file cms/.env -f compose.cms.yml logs --tail=80 cms

# Verifica se o processo responde
Invoke-WebRequest -Uri "http://localhost:1337/_health" -Method Get -UseBasicParsing
```

O healthcheck do Strapi responde **204 No Content** quando a aplicação está pronta. O painel administrativo: `http://localhost:1337/admin`; Content Manager: `http://localhost:1337/admin/content-manager`.

## Lentidão no Content Manager: ordem do diagnóstico

1. Recarregar `/admin` e depois `/admin/content-manager`; confirmar se a segunda visita ainda é lenta.
2. Executar `docker stats --no-stream`. Se o CMS ou o Docker Desktop estiver com CPU muito alta, memória próxima ao limite ou I/O elevado, não ampliar infraestrutura antes de obter métricas.
3. Abrir DevTools do navegador (F12 → Network) e identificar a requisição pendente ou mais longa. A página usa JavaScript; `/_health` saudável não prova que seu carregamento visual esteja rápido.
4. Conferir os logs de Strapi pelo comando acima. Erro `/favicon.ico` nas imagens iniciais era secundário e já foi corrigido na `dev`; a correção só entra no contêiner após uma reconstrução planejada.
5. Inspecionar os recursos do Docker Desktop/WSL 2 e o espaço disponível. No Windows, o projeto pode ficar no sistema de arquivos do Windows, mas o banco e os uploads DEV são volumes Docker Linux, evitando I/O de bind mount nesses dados.

**Não é preciso reiniciar o banco ou reconstruir a imagem para apenas diagnosticar lentidão.** Se `/admin` for rápido, mas o Content Manager ficar parado, observe a aba Network para identificar a chamada específica. O CMS já passou no CI, mas a velocidade do browser local ainda precisa ser medida.

## Preparação da PROD (não executar por enquanto)

O arquivo `compose.cms.prod.yml` já deixa um segundo projeto Docker, com banco e mídias distintos, pronto para validação de configuração. A instância PROD deve, preferencialmente, rodar em infraestrutura separada da máquina de desenvolvimento; a porta `1338` é apenas uma referência local para testes de coexistência.

Quando autorizada a preparação dos segredos (não cria contêineres):

```powershell
node cms/scripts/init-env.mjs --prod
docker compose --env-file cms/.env.prod -f compose.cms.prod.yml config --quiet
```

**NÃO executar `up` da PROD ainda.** É necessário homologar antes: políticas de acesso administrativo, domínio e TLS, proxy reverso, estratégia de armazenamento de mídia, auditoria, backup/restore do PostgreSQL, testes de atualização e isolamento, e licenças das imagens.

O portal em PROD usará `CMS_ENABLED=true`, `CMS_API_URL` apontando exclusivamente para a **instância PROD** e `CMS_READ_TOKEN` específico dessa instância. O token fica no servidor, nunca em `NEXT_PUBLIC_*` e nunca no Git. Se o site estiver dentro de outro contêiner, `localhost` significa esse contêiner, não o host: configurar uma rede privada ou endereço interno adequado antes do deploy.

## Próximos gates

- [x] DEV com Strapi/PostgreSQL iniciado; primeiro administrador criado localmente.
- [x] Código para PROD isolada sem alterar o stack DEV.
- [ ] Investigar lentidão real do Content Manager (métricas e Network).
- [ ] Homologar notícia como rascunho, aprovar/publicar, autenticação e permissões.
- [ ] Validar acessibilidade e direitos de imagem.
- [ ] Definir infraestrutura de produção, backup/restore, HTTPS e acesso administrativo.
- [ ] Só então concluir o PR #12 e criar o deploy PROD.

Referências técnicas: [Docker para Strapi 5](https://docs.strapi.io/cms/installation/docker) e [Docker Desktop/WSL 2](https://docs.docker.com/desktop/features/wsl/).

**Teste CSP controlado:** ver [diagnóstico opt-in no DEV](CMS-SPRINT3.md#diagnóstico-opt-in-de-csp-no-dev-sem-alterar-prod). Nunca ativar `unsafe-eval` no Compose PROD.
