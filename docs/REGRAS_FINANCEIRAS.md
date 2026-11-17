# Regras financeiras

Decisões incorporadas em 17/11/2026 a partir do fluxo informado pelo responsável.

## Destino das coletas

A coleta pertence a uma igreja e a uma competência. O valor reservado ao caixa local de manutenção preventiva é uma parte da finalidade Manutenção. Todo o restante compõe o valor esperado para depósito na administração geral do DF.

Valor esperado para depósito = total coletado − parcela destinada ao caixa local.

A reserva local começa em zero. Ao informar a reserva, o formulário ajusta sua parcela de Manutenção. O detalhamento por finalidade pode ser conferido e alterado antes de salvar.

## Conta local acumulada

O caixa local é uma conta com saldo contínuo entre os meses. As entradas ocorrem na data da coleta que destinou o recurso ao caixa. As saídas ocorrem na data do pagamento das despesas identificadas como pagas pelo caixa local.

Saldo final = saldo anterior + entradas locais − pagamentos locais.

Uma despesa paga pela administração geral do DF aparece nos relatórios da igreja e não reduz o caixa local. Uma despesa pendente não consome saldo. O sistema rejeita alterações que deixem o saldo negativo em qualquer data, inclusive pagamentos retroativos e redução de reservas já utilizadas. Os movimentos são agrupados por dia, pois o sistema não registra a hora financeira das entradas e saídas.

## Competência e caixa

Há duas consultas complementares:

- **Competência:** usa o mês de referência da despesa, independentemente de quando será paga. Coletas e depósitos são conciliados pela competência à qual foram vinculados.
- **Caixa:** considera a data do recebimento das coletas, a data bancária dos depósitos e a data efetiva do pagamento das despesas. Contas pendentes ficam fora das saídas de caixa.

Exemplo: uma conta de energia de novembro, no valor de R$ 150, debitada em 5 de dezembro, é uma despesa de novembro por competência e um pagamento de dezembro por caixa. O vencimento é usado para acompanhar atrasos e não substitui nenhuma dessas datas.

Na visão de caixa, o valor a depositar é o saldo acumulado até o fim do período. Isso permite mostrar em dezembro o depósito de uma coleta recebida em novembro sem criar uma arrecadação fictícia em dezembro. Depósitos representam transferência para a administração e não são deduzidos novamente como despesas.

Os relatórios e arquivos exportados identificam a visão selecionada. As contas mantêm referência, vencimento e pagamento próprios.

## Fechamento e pagamento posterior

O fechamento exige ausência de depósitos em rascunho e igualdade entre o valor esperado e os depósitos confirmados da competência. O caixa local pode manter saldo para os meses seguintes.

Coletas e depósitos de mês fechado ficam protegidos. Valor, referência e demais dados de reconhecimento da despesa também exigem reabertura para correção. Uma despesa já registrada em novembro pode ser baixada em dezembro aberto sem reabrir novembro. Alterar uma baixa que afete um mês de pagamento fechado exige reabrir esse mês.

A reabertura exige motivo e usuário com perfil Superadministrador, Administrador ou Responsável pelo setor, com acesso de escrita à igreja e ao módulo de coletas. O histórico registra responsável, momento e alterações.

## Correção de depósitos

Um depósito confirmado preserva valor, data, comprovante e competência. A correção ocorre por estorno do registro com motivo, seguido do cadastro do depósito correto. Se a competência estiver fechada, primeiro é necessária uma reabertura autorizada.

O estorno retifica o registro no sistema: o original continua visível e auditado, com identificação do responsável, e deixa de compor os totais conciliados. O sistema não executa movimentações bancárias. Registros estornados também permanecem preservados.

## Gravações e importação

As operações são confirmadas pelo banco antes de atualizar o cache e concluir o formulário. Um lote de alterações é gravado em uma transação. Reenvios financeiros após falha de rede reutilizam um identificador de operação; conflitos de versão exigem atualização dos dados.

Adicionar registros ausentes preserva registros que já possuem o mesmo identificador e respeita as competências fechadas. Cadastros equivalentes com identificadores diferentes continuam sujeitos às regras de unicidade do banco; erros desfazem o lote. A substituição restaura o conjunto operacional do arquivo de forma atômica. As permissões atuais por igreja e setor são reaplicadas aos identificadores que permanecerem existentes.

## Referências conceituais

- [CPC 00 (R2), itens 1.17 a 1.20](https://www.cpc.org.br/Arquivos/Documentos/573_CPC00%28R2%29.pdf): distinção entre informações por competência e por fluxos de caixa.
- [CFC — orientação sobre retificação e referência aos itens 31 a 36 da ITG 2000](https://cfc.org.br/tecnica/perguntas-frequentes/livro-diario/): preservação da escrituração e correção por lançamentos retificadores.

Essas referências orientam a organização das informações. A aplicação implementa o controle operacional das igrejas e não produz, nesta etapa, uma escrituração contábil completa com partidas dobradas.
