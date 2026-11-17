# Plano de evolução do CCB Coletas

Data: 17/11/2026. Base: commit `5865d21`, branch `develop`.

## Objetivo e premissas

Evoluir o sistema para atender mais igrejas, setores e usuários, com números financeiros confiáveis, permissões verificáveis e desempenho mensurável.

O plano considera inicialmente uma administração com várias igrejas e setores. Atender administrações independentes é uma expansão separada, que exige definir uma nova fronteira de isolamento dos dados.

As etapas seguem dependências técnicas e critérios de conclusão. Prazos devem ser estimados depois da confirmação do banco e das regras de negócio da etapa 0.

## Andamento em 17/11/2026

Primeira entrega implementada e validada localmente:

- Diagnóstico identificou DNS indisponível e `tenant/user not found` no projeto Supabase configurado; o responsável está verificando a reativação.
- Ambiente descartável de testes com PostgreSQL em memória, migrações reais e usuários sintéticos; `.env.example` e procedimento de homologação documentados.
- Regras acordadas: conta local acumulada; competência separada da data do pagamento; reabertura administrativa com motivo; correção de depósito confirmado por estorno.
- Lotes de gravação e importação atômicos, validações no banco, locks por igreja, detecção de edição concorrente e proteção de reenvios por identificador de operação.
- Formulários aguardam confirmação do banco, preservam os dados em caso de erro e apresentam o estado de gravação.
- Dashboard com dados reais, relatórios por competência e caixa e saldo local transportado entre meses.
- Novos usuários começam inativos e sem acesso global; a promoção automática por e-mail foi removida.
- Leitura completa com paginação para evitar truncamento do histórico; índices iniciais e workflow de CI com PostgreSQL 17.
- Next.js atualizado para 16.4.6 e dependências corrigidas conforme a auditoria do npm.

Validações: lint, TypeScript, build de produção e 65 testes locais aprovados de regras financeiras, permissões, reenvios, restauração operacional e leitura paginada. Um cenário de concorrência requer PostgreSQL dedicado. O teste HTTP confirmou login público e redirecionamento das rotas protegidas. A auditoria de produção está zerada; permanece uma pendência de desenvolvimento do picomatch, sem patch publicado, registrada no procedimento operacional.

**Ainda não concluído:** homologação remota, execução do teste com duas conexões independentes, piloto autenticado e restauração completa do ambiente. A leitura ainda carrega o histórico acessível; consultas por escopo, consolidações no banco e atualização Realtime seletiva permanecem na etapa 3. O transporte de mudanças ainda deriva um lote do cache; migrar para comandos explícitos por operação permanece no roteiro.

As regras detalhadas estão em [REGRAS_FINANCEIRAS.md](REGRAS_FINANCEIRAS.md), e os procedimentos e limites de validação em [OPERACAO_E_VALIDACAO.md](OPERACAO_E_VALIDACAO.md). Os checklists abaixo representam os critérios completos das etapas; implementação local isolada não equivale à liberação do piloto.

## Ponto de partida

- Implementados no código: igrejas, programações, coletas, depósitos, despesas, relatórios, autenticação, permissões e auditoria.
- Última evolução: rateio das coletas, reserva para manutenção, origem do pagamento de despesas e reflexos no fechamento e nos relatórios.
- Lint e build de produção passaram no commit de referência.
- A aplicação da migração `202608030001_maintenance_cash_and_expense_source.sql` no banco remoto ainda não foi confirmada. A tentativa anterior de consulta falhou.
- A página inicial contém dados fixos; Agenda, Rotas e Equipes são telas preparadas.
- Não foi encontrada uma suíte de testes automatizados nem um fluxo de integração contínua versionado.

## Problemas que orientam as prioridades

| Observação no código | Consequência | Etapa |
| --- | --- | --- |
| O cache muda antes da confirmação da gravação e erros de sincronização são tratados sem mensagem para o usuário. | Um lançamento pode aparentar sucesso antes de ser persistido. | 1 |
| As alterações são enviadas tabela por tabela, sem transação única para a operação completa. | Falhas intermediárias podem deixar uma operação parcialmente aplicada. | 1 |
| Regras de fechamento, rateio e saldo são verificadas no navegador. | É necessário garantir as mesmas regras no banco, inclusive com usuários simultâneos. | 1 |
| A importação com substituição apaga e regrava tabelas em chamadas separadas. | Uma falha pode deixar o conjunto de dados incompleto. | 1 |
| A carga inicial consulta todas as linhas acessíveis de oito tabelas e mudanças Realtime provocam nova carga completa. | Custo de transferência, memória e atualização aumenta com o histórico. | 3 |
| A visão geral usa dados demonstrativos. | A primeira tela não informa a situação financeira real. | 2 |

## Etapa 0 — Confirmar a base e as regras

**Prioridade: imediata.**

- [ ] Diagnosticar a falha de conexão ao PostgreSQL sem expor credenciais.
- [ ] Comparar as migrações versionadas com `app_migrations` e verificar tabelas, colunas, políticas de acesso, auditoria e Realtime.
- [ ] Preparar um ambiente de homologação com dados sintéticos e documentar as variáveis necessárias em um arquivo de exemplo sem segredos.
- [ ] Validar a última migração em homologação e preparar a atualização do ambiente operacional com backup e procedimento de recuperação.
- [ ] Definir se o saldo de manutenção permanece no mês ou é transferido para a competência seguinte.
- [ ] Definir quais alterações em despesas são permitidas após o fechamento e quem pode reabrir uma competência.
- [ ] Definir a correção de depósitos confirmados: estorno, cancelamento ou outro procedimento auditável.
- [ ] Registrar o volume atual e o esperado: igrejas, usuários simultâneos, lançamentos mensais e anos de histórico.

**Critério de conclusão:** ambiente reproduzível, situação das migrações conhecida e regras acima registradas. A indisponibilidade do banco permite avançar em testes locais e desenho técnico, mas impede validar a integração remota.

## Etapa 1 — Garantir a integridade financeira

**Prioridade: crítica. Depende das decisões da etapa 0.**

- [ ] Substituir a gravação por diferenças do banco inteiro por operações explícitas: registrar coleta, editar despesa, confirmar depósito, fechar e reabrir competência.
- [ ] Validar no servidor e no banco os valores, vínculos com a igreja, rateio, reserva de manutenção e transições de estado.
- [ ] Executar operações financeiras relacionadas dentro de uma transação no PostgreSQL, com proteção contra concorrência na igreja e competência afetadas.
- [ ] Garantir que reenvios e cliques repetidos não criem lançamentos ou confirmações duplicados.
- [ ] Revalidar o saldo ao editar, excluir ou transferir registros que afetem o caixa de manutenção, inclusive ao mudar igreja ou competência.
- [ ] Exibir estados de carregamento, salvamento e erro. Informar sucesso após confirmação da gravação e preservar os dados do formulário em caso de falha.
- [ ] Garantir que auditoria e alteração financeira sejam consistentes; registrar motivo nas correções e reaberturas conforme a regra definida.
- [ ] Tornar a importação validada e atômica, com resumo antes da execução. Tratar a substituição completa como operação administrativa específica.
- [ ] Testar as permissões diretamente no banco: leitura, escrita, menus e isolamento por igreja e setor, incluindo tentativas fora da interface.
- [ ] Automatizar testes das regras financeiras e testes de integração com banco de homologação.

**Cenários obrigatórios:** rateio inválido; caixa insuficiente; duas despesas concorrentes disputando o mesmo saldo; fechamento simultâneo a um lançamento; mês fechado; comprovante repetido; falha durante importação; reenvio de uma operação; acesso indevido; depósito com data bancária no mês seguinte.

**Critério de conclusão:** operações inválidas são rejeitadas pelo banco, operações interrompidas não deixam gravações parciais e falhas não são apresentadas como sucesso.

**Marco 1:** núcleo financeiro confiável e coberto pelos testes dos fluxos críticos.

## Etapa 2 — Concluir a experiência de operação

**Prioridade: alta. Depende da etapa 1.**

- [ ] Substituir os dados demonstrativos da visão geral por totais reais dentro das permissões do usuário.
- [ ] Mostrar arrecadação, valor a depositar, reserva e saldo de manutenção, despesas pendentes e competências com pendências.
- [ ] Usar os mesmos conceitos financeiros nas telas, gráficos, exportações e fechamento, diferenciando competência de data de pagamento ou depósito.
- [ ] Revisar textos antigos sobre armazenamento local e instruções que já não correspondem à persistência no Supabase.
- [ ] Concluir recuperação de senha, tratamento de sessão expirada e atualização da interface após mudanças de acesso.
- [ ] Validar os fluxos em celular: seleção da igreja e do mês, lançamento, contagem, confirmação, despesa, fechamento e reabertura.
- [ ] Realizar um piloto acompanhado com poucas igrejas e recolher problemas reais de operação.

**Critério de conclusão:** um responsável consegue executar o ciclo mensal completo sem intervenção técnica; dashboard, relatório e exportação conferem com o mesmo conjunto de lançamentos.

## Etapa 3 — Preparar desempenho e operação contínua

**Prioridade: alta, antes de ampliar o piloto.**

- [ ] Consultar dados por igreja, setor, competência e período, com paginação e ordenação estável nas listagens.
- [ ] Separar consultas de listagem, totais e exportação. Garantir que totais incluam todo o escopo filtrado, independentemente da página exibida.
- [ ] Calcular consolidações no banco para evitar baixar o histórico completo apenas para somar valores.
- [ ] Substituir a recarga completa por invalidação e atualização dos dados afetados, limitando as assinaturas Realtime ao contexto necessário.
- [ ] Criar índices conforme as consultas reais e conferir os planos de execução.
- [ ] Testar volumes acima do limite de uma resposta da API, garantindo listagens completas e exportações sem truncamento silencioso.
- [ ] Medir tempos de consulta, abertura das telas, gravação e exportação no volume definido na etapa 0; estabelecer metas antes de ampliar o uso.
- [ ] Configurar integração contínua com lint, checagem de tipos, testes críticos e build, incluindo validação de novas migrações.
- [ ] Documentar implantação, atualização do banco, recuperação de falhas e separação entre homologação e produção.
- [ ] Configurar acompanhamento de erros e falhas de gravação sem registrar credenciais ou dados financeiros completos nos logs.
- [ ] Definir responsáveis, frequência e retenção dos backups e testar uma restauração em homologação.

**Critério de conclusão:** listagens e totais continuam corretos com maior volume, as metas de desempenho são atendidas e uma restauração foi executada com sucesso.

**Marco 2:** sistema pronto para ampliar o piloto com acompanhamento de desempenho, erros e recuperação.

## Etapa 4 — Ampliar os módulos a partir do uso real

**Prioridade: após o núcleo financeiro e a operação estarem estáveis.**

| Ordem | Entrega | Critério de conclusão |
| --- | --- | --- |
| 1 | Agenda baseada na programação e nas exceções existentes. | A agenda mensal corresponde aos eventos previstos nas coletas, sem duplicar cadastros. |
| 2 | Equipes, responsáveis e atribuições por igreja ou setor. | Cada atribuição possui escopo definido e respeita as permissões. |
| 3 | Comprovantes e documentos anexados aos registros. | Arquivos têm acesso restrito, limites definidos e vínculo auditável com o lançamento. |
| 4 | Alertas de despesas vencidas, depósitos pendentes e fechamento incompleto. | O destinatário recebe apenas informações do seu escopo; os canais são definidos antes da integração. |
| 5 | Rotas, caso o piloto confirme a necessidade de coleta física. | Fluxo, endereço, responsáveis e uso em campo são validados antes de escolher integração de mapas. |

**Marco 3:** novos módulos resolvem necessidades observadas no piloto e possuem critérios próprios de aceitação.

## Etapa 5 — Expandir a administração

- [ ] Permitir cadastro e gestão de igrejas e setores por administradores delegados, conforme as regras de acesso acordadas.
- [ ] Melhorar inclusão, alteração e revogação de acesso em lote, com auditoria e confirmação do escopo afetado.
- [ ] Avaliar importações e exportações como tarefas em segundo plano quando os volumes medidos exigirem, com acompanhamento e retomada.
- [ ] Acompanhar capacidade e custo por igreja ativa, volume de dados e uso simultâneo.
- [ ] Se houver necessidade de administrações independentes, projetar organizações, vínculos de usuários, políticas de isolamento, auditoria e migração dos dados existentes.

**Critério de conclusão:** ampliar o número de igrejas exige configuração e capacidade operacional, com isolamento e responsabilidades claros.

## Primeira sequência de entregas

1. Diagnóstico do banco, das migrações e das decisões financeiras pendentes.
2. Ambiente de homologação e testes de acesso e das regras atuais.
3. Operações transacionais de coleta e despesa, com validação de rateio e saldo.
4. Confirmação de depósito, fechamento e reabertura protegidos contra concorrência.
5. Mensagens de gravação e erro e importação atômica.
6. Dashboard com dados reais e execução do primeiro ciclo mensal no piloto.
7. Consultas paginadas, consolidações no banco e atualização seletiva dos dados.
8. Automação de validação, restauração de backup e ampliação gradual do piloto.

Cada entrega deve ser pequena o suficiente para revisão e commit próprios, com evidência do critério de conclusão. Antes de alterar código do Next.js, consultar o guia relevante em `node_modules/next/dist/docs/`, conforme `AGENTS.md`.

## Decisões de arquitetura

Manter Next.js, PostgreSQL e Supabase como base e evoluir a aplicação por módulos. O navegador cuida da interação; o banco garante as regras financeiras e a integridade das operações; as consultas atendem o escopo necessário para cada tela. Serviços adicionais entram quando uma necessidade e uma medida de capacidade justificarem seu uso.

## Indicadores para acompanhar

- Nenhuma perda ou duplicação nos cenários financeiros automatizados.
- Conciliação entre coletas, manutenção e depósitos em todas as competências do piloto.
- Tempo e taxa de falha de gravações, consultas e exportações.
- Igrejas ativas, usuários simultâneos e volume mensal de lançamentos.
- Quantidade de intervenções técnicas necessárias para concluir um mês.
- Última restauração de backup validada e tempo necessário para recuperar o serviço.
