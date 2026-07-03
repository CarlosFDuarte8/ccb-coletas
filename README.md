# CCB Coletas

Base web para gestão de coletas, construída com Next.js 16, React 19, TypeScript e Tailwind CSS 4.

## Executando localmente

```bash
npm install
npm run dev
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000).

## Organização

```text
app/
  (dashboard)/       # Rotas que compartilham a estrutura administrativa
components/
  layout/            # Sidebar, topbar, footer e shell responsivo
  theme/             # Tema claro, escuro e automático
  icons.tsx          # Ícones vetoriais reutilizáveis
config/
  navigation.ts      # Fonte única dos itens de navegação
public/              # Arquivos estáticos
```

Os arquivos `page.tsx` e `layout.tsx` permanecem Server Components por padrão. Componentes interativos recebem `"use client"` somente onde o navegador é realmente necessário.

## Comandos

- `npm run dev`: servidor de desenvolvimento
- `npm run build`: build otimizado de produção
- `npm run start`: executa o build de produção
- `npm run lint`: valida a qualidade do código

## Temas

A preferência é armazenada no navegador. O modo **Automático** acompanha o sistema operacional em tempo real e a inicialização evita a troca visível de cores durante o carregamento.

## Persistência temporária

Igrejas, coletas, contagens e depósitos ficam no `localStorage`, sob uma camada isolada em `lib/storage`. Isso permite substituir o armazenamento por uma API ou Firebase sem acoplar as telas à tecnologia escolhida.

Enquanto não houver banco remoto, os dados pertencem somente ao navegador atual e podem ser perdidos se os dados do site forem apagados. Use **Exportar backup** regularmente na tela de coletas.

## Fluxo mensal

1. Selecione a igreja e a competência (por exemplo, julho de 2026).
2. Registre as coletas da competência.
3. Gere o depósito como rascunho pela contagem de cédulas e moedas.
4. Abra o rascunho, informe a data bancária e o comprovante e confirme-o. A data pode pertencer ao mês seguinte sem alterar a competência.
5. Feche o mês quando não houver rascunhos ou diferença entre o total coletado e depositado.

Uma competência fechada bloqueia inclusões, alterações e exclusões. Ela pode ser reaberta explicitamente para uma correção auditável no fluxo da interface.

## Programação das igrejas

Cada igreja possui sua própria programação semanal de cultos e RJM. Exceções são registradas por data e podem cancelar ou alterar apenas um evento específico, preservando a regra dos demais dias. A Incra 08 inicia com sexta-feira às 19:30, RJM domingo às 10:00 e culto domingo às 19:00; em 04/10/2026 a RJM está cancelada e o culto noturno identificado como Santa Ceia.

Na tela de igrejas, os cadastros são agrupados por setor. Inclusões e edições acontecem em modal, e cada card oferece acesso à programação específica daquela igreja.

Na competência mensal, as coletas previstas são calculadas automaticamente a partir dessa programação. Datas canceladas por exceção não aparecem, alterações como Santa Ceia recebem o nome correto e o lançamento financeiro só é criado quando um valor real é informado.

As despesas são registradas separadamente por igreja e mês de referência, com vencimento e pagamento independentes, além de categoria, favorecido e documento. Os relatórios consolidam arrecadação, depósitos, despesas, resultado líquido e conciliação sem misturar os conceitos contábeis.

Em **Configurações**, o banco local pode ser exportado ou importado em JSON. A opção de mesclagem normaliza nomes e remapeia relacionamentos para adicionar apenas igrejas e lançamentos ausentes, preservando os cadastros existentes.
