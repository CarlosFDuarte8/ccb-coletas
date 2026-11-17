# Operação e validação

## Ambiente e diagnóstico

O projeto usa Node.js 22. Para um ambiente novo, crie `.env.local` com base em `.env.example`. Preserve arquivos de ambiente existentes e mantenha segredos fora do Git.

`npm run db:status` faz consultas de leitura: lista migrações aplicadas e pendentes, tabelas, RLS, colunas de manutenção, políticas, gatilhos de auditoria e publicação Realtime. O comando termina com código diferente de zero se houver migração pendente ou falha de conexão. Suas mensagens de erro não imprimem a conexão com senha.

Em 17/11/2026, o projeto Supabase configurado retornou DNS `ENOTFOUND` e o pool retornou `tenant/user not found`. O responsável está verificando o projeto no painel. Isso não confirma que qualquer migração local esteja aplicada no ambiente remoto.

## Validação local

Em um ambiente novo, o primeiro Superadministrador deve ser definido pelo operador do banco a partir do ID de uma conta verificada no Supabase Auth. Cadastros novos começam inativos e sem escopo global; a aplicação não promove contas por correspondência de e-mail. Os Superadministradores já existentes são preservados pela migração.

No editor SQL administrativo do ambiente correto, substitua o UUID pelo ID verificado do responsável:

```sql
update public.profiles
set role = 'super_admin', active = true,
    all_churches_access = true, all_churches_write = true
where id = 'UUID-DA-CONTA-VERIFICADA';
```

```powershell
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Por padrão, os testes usam PostgreSQL em memória via PGlite. Eles executam os arquivos SQL reais, com uma estrutura mínima de autenticação para testar permissões e auditoria. Esse ambiente é descartável e não acessa o Supabase. Ele não reproduz Supabase Auth, entrega de eventos Realtime nem concorrência entre conexões.

Resultado da entrega local: 65 testes aprovados e um cenário de concorrência condicionado a PostgreSQL dedicado. Lint, TypeScript e build passaram. O teste HTTP confirmou a página de login e o redirecionamento de quatro rotas protegidas. O fluxo financeiro autenticado no navegador continua pendente de homologação remota.

Para testar concorrência, a mesma suíte aceita `TEST_DATABASE_URL`, restrita a `localhost` e a banco terminado em `_test`. O banco precisa estar vazio e ser exclusivo para testes. O workflow de CI prepara PostgreSQL 17 e executa esse cenário com duas conexões.

Exemplo opcional para quem possui Docker em execução:

```powershell
docker run --name ccb-coletas-tests --rm -d -p 127.0.0.1:54329:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ccb_coletas_test postgres:17
$env:TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:54329/ccb_coletas_test'
npm test
Remove-Item Env:TEST_DATABASE_URL
docker stop ccb-coletas-tests
```

Aguarde o PostgreSQL ficar pronto antes dos testes. Crie uma nova instância descartável para cada execução. As credenciais do exemplo são exclusivas desse banco de teste local.

## Homologação e atualização do ambiente operacional

1. Confirmar o acesso ao projeto remoto e preencher as variáveis do ambiente de homologação.
2. Executar o diagnóstico de migrações e obter um backup do banco antes da atualização.
3. Validar os dados existentes contra as novas regras. Uma migração com dados incompatíveis falha e sua transação é desfeita; os registros precisam ser conferidos antes de reaplicar.
4. Executar `npm run db:migrate` em homologação e depois `npm run db:status`.
5. Executar os fluxos autenticados de coleta, reserva local, depósito, despesa, fechamento, pagamento posterior, estorno e reabertura, com diferentes perfis.
6. Testar a restauração de um backup em homologação e registrar responsável, resultado e tempo de recuperação.
7. Atualizar banco e aplicação da mesma entrega durante uma janela coordenada. A nova aplicação depende das funções SQL da migração `202611170001_financial_integrity.sql`.
8. Recarregar os navegadores e acompanhar falhas de gravação, conciliação e atualização entre usuários antes de ampliar o piloto.

O executor aplica cada migração dentro de uma transação e usa um lock de transação para coordenar execuções concorrentes. Mudanças posteriores ao schema devem ser novas migrações; preserve o histórico já aplicado.

Antes de aplicar a nova migração, conferir também os acessos dos usuários existentes. Contas sem menus e sem vínculos explícitos com igrejas ou setores perdem flags globais herdadas do antigo padrão; usuários com permissões configuradas e Superadministradores são preservados.

## Backups

O JSON exportado pela aplicação é um backup dos dados operacionais carregados: setores, igrejas, programação, coletas, depósitos, competências e despesas. Usuários, credenciais, permissões e o histórico de auditoria exigem também um backup do ambiente PostgreSQL/Supabase.

A importação com substituição é atômica e preserva acessos atuais aos IDs que continuarem existindo. Ela não substitui a validação de uma restauração completa do ambiente, incluindo autenticação e auditoria.

## Pendências para liberar o piloto

- Confirmar e atualizar as migrações remotas.
- Executar o teste com conexões PostgreSQL independentes e o workflow de CI.
- Validar a interface autenticada e o Realtime no navegador.
- Registrar o volume esperado e medir desempenho nesse cenário.
- Executar e documentar uma restauração completa em homologação.

## Auditoria das dependências em 17/11/2026

O Next.js foi atualizado para 16.4.6 e as correções disponíveis dentro das faixas compatíveis foram aplicadas. `npm audit --omit=dev` retornou zero vulnerabilidades.

A auditoria completa ainda aponta 14 dependências de desenvolvimento na cadeia do ESLint, derivadas do alerta [GHSA-fc5q-39xc-vjpf, em picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). O aviso informa ausência de versão corrigida; a versão publicada mais recente consultada foi 4.0.7. Acompanhar a publicação da correção e repetir a auditoria ao atualizar o lockfile.
