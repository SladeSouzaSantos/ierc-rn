# IERC-RN — competições CBDV automáticas e cadastro institucional (DEV)

Atualizado em 11/11/2026. Branch: \`dev\`. A \`main\` e o site público não foram alterados.

## Duas origens, duas responsabilidades

1. **Fonte externa CBDV — leitura automática:** a rota \`/esportes\` busca
   exclusivamente \`https://www.cbdv.org.br/calendario\`, no **servidor**
   Next.js. O leitor limita tamanho, timeout, redirecionamentos e domínio de
   origem. Considera a tabela **TORNEIOS / CALENDÁRIO AAAA** e somente
   competições da modalidade Goalball, com datas, título e local validados.
   Exclui treinamentos, arbitragem e outras modalidades nesta primeira
   entrega. Considera provas recentes (90 dias) e futuras (até 550 dias)
   e retorna no máximo 20 registros.
2. **Cadastro manual institucional — Strapi:** a coleção existente \`events\`
   ganhou apenas **três campos opcionais**, sem remover nem alterar campos
   preexistentes: \`eventType\` (padrão \`institucional\`, valor
   \`competicao_esportiva\` para esporte); \`sportModality\` (ex.: Goalball);
   \`participationStatus\` (padrão \`nao_confirmada\`, valor \`confirmada\`
   somente após confirmação documentada). O Strapi oferece edição,
   rascunho e publicação. O portal só lê eventos **publicados e com
   \`editorialStatus=aprovado\`**, com token exclusivo de leitura no servidor.

Os conteúdos aparecem em grupos distintos e nomeados:
**Competições informadas pelo IERC-RN** e **Calendário oficial CBDV · Goalball**.
Se uma competição da CBDV receber registro institucional aprovado com o
mesmo título e data, a visualização desduplica, priorizando o registro
institucional. Nunca sobrescrever a fonte nem inventar participação.

A lista de atletas citados pela CBDV na Série A de 2026 permanece como
**arquivo daquela competição**. A novidade NÃO cria elenco atual, nem
transforma participantes históricos em pessoas atualmente vinculadas ao IERC.
Outras competições do calendário CBDV tampouco comprovam que o Instituto
estará presente; a página declara essa limitação.

## Intervalo de atualização real

O fetch público usa cache Next.js com revalidação a cada **6 horas**
(\`next: { revalidate: 21600 }\`). Trata-se de leitura automática **quando a
página recebe acesso após a validade do cache**, não de cron independente:
se ninguém visitar, nenhuma tarefa é executada em segundo plano.

- Alterações futuras publicadas pela CBDV poderão aparecer sem modificar
  o código nem o Strapi, na consulta seguinte após expirar o cache.
- Se a fonte estiver fora do ar, mudar o layout, responder erro ou
  exceder o limite, o portal não inventa eventos. Mostra orientação
  para consultar a fonte e preserva os registros editoriais existentes.
- Atualização externa não recebe poder de escrita no CMS, no Redis,
  nos volumes ou na base de eventos. Nenhum endpoint de terceiros é aberto
  a partir de dados fornecidos pelo navegador.
- Uma futura fase pode adicionar monitor agendado com alertas e propostas
  de revisão para a equipe, mas **isso não foi ativado nesta etapa**.

## Como cadastrar uma competição fora da CBDV

**Antes de usar a funcionalidade, é necessário homologar a atualização
aditiva de schema no Strapi DEV, com backup verificado e preflight da
estrutura implantada.** Apenas atualizar o portal não expõe os campos no
painel antigo do CMS. Não aplicar a migração em produção.

Quando o Strapi DEV estiver homologado:

1. Abrir o Content Manager, coleção **Eventos**.
2. Criar o título, slug, resumo, início, término e local corretos.
3. Definir \`eventType = competicao_esportiva\`.
4. Preencher \`sportModality\` conforme a modalidade.
5. Definir \`participationStatus = nao_confirmada\` até haver
   confirmação específica da coordenação. Só selecionar \`confirmada\`
   após aprovação editorial e comprovação institucional.
6. Se existir publicação externa, preencher \`sourceName\` e \`sourceUrl\`
   com referência oficial verificável. Para torneio interno sem página
   pública, documentar em \`approvalNote\` a fonte institucional e o
   responsável pela conferência, sem expor dados pessoais.
7. Marcar \`editorialStatus = aprovado\` e **Publicar** no Strapi,
   depois da revisão. Enquanto estiver em Draft ou com status diferente
   de aprovado, **não poderá aparecer** no portal.
8. O mesmo evento pode integrar \`/eventos\`; somente os classificados
   como competição esportiva entram também em \`/esportes\`.

Somente editores/administradores autenticados no painel privado podem
cadastrar ou aprovar. **Não criar formulário público de cadastro**.

## Plano de homologação do schema no MiniMac (não executado)

A inclusão de três campos opcionais é aditiva no modelo declarativo, mas
**não prova** que a migração real de PostgreSQL do ambiente DEV é segura.
Antes de qualquer reconstrução do CMS:

1. Fazer backup verificável do PostgreSQL/arquivos de mídia, com a rotina
   existente \`scripts/backup-cms-dev.sh\` e checar seu resultado.
2. Capturar o diretório \`/opt/app/src/api\` do contêiner CMS DEV atual
   em pasta temporária segura e executar o preflight read-only
   \`node cms/scripts/check-deployed-schema.mjs --schema-root <pasta>/api\`.
   Espera-se apenas \`additions_only\` dos novos campos, nunca remoções.
3. Revisar qualquer \`hazards\`; se houver diferenças não previstas,
   **interromper**. O preflight compara schemas, **não o catálogo SQL**.
4. Homologar geração e leitura da estrutura em uma cópia/sandbox da
   base DEV, confirmar conteúdo preexistente e ausência de perda de dados.
5. Só após validação e autorização, migrar o serviço CMS DEV existente,
   mantendo seus volumes. **Não executar \`docker compose down -v\`.**
6. Verificar acessos e papéis Author/Editor, Draft & Publish, novo
   cadastro real e edição das competições; testar acessibilidade
   com teclado e leitor de tela.
7. A \`main\` e o ambiente PROD permanecem bloqueados até liberação.

## Gates de testes

- Fixture estrutural baseada na tabela oficial da CBDV de 2026:
  leitura de datas, ano, título, local, modalidade Goalball, exclusão de
  treinamentos, histórico fora da janela e markup inseguro.
- Duplicação de registro e deduplicação com cadastro manual.
- Contrato do modelo Strapi: campos novos são opcionais, com padrão
  conservador de participação **não confirmada**.
- Verificação E2E de \`/esportes\` com seções distintas, link da fonte
  oficial e elenco **histórico** preservado.
- Nunca alegar participação do IERC sem registro institucional aprovado.

**Importante:** sucesso de CI não equivale a consulta real da CBDV pelo
MiniMac, nem a confirmação de migração do Strapi ou do cadastro manual
em ambiente real.
