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
