# Estilo de código

Propósito: mudanças pequenas, legíveis e compatíveis com o treino offline. Este guia resume o código existente; não exige reformatação geral.

## Tecnologias e estrutura

- TypeScript estrito, React, Vite, Tailwind e Firebase; Workers Cloudflare no backend. Versões e comandos: [package.json](package.json).
- `src/engine/`: cálculos puros, sem React/Firebase. `src/lib/`: dados e lógica compartilhada. `src/features/`: telas por funcionalidade. `marcas/`: identidade das duas marcas.
- Amplie o módulo existente antes de criar abstração. Não misture regra de negócio com apresentação. Consulte [arquitetura](ARCHITETURE.md) para fronteiras.

## Nomes e formato

- Funções/variáveis em camelCase, componentes/tipos em PascalCase; preserve o vocabulário em português e a convenção local do arquivo.
- Siga a formatação vizinha: normalmente dois espaços, aspas simples, sem ponto e vírgula. Não reformate arquivos sem relação com a tarefa.
- Tipos explícitos nas fronteiras; valide dados externos em execução. Evite `any`, coerções amplas e estado duplicado.

## Componentes e interface

- Reutilize componentes de `src/ui.tsx` e ícones de `src/icones.tsx`; não introduza emoji/símbolos improvisados na interface.
- Use os tokens da marca, sem fixar identidade de VFIT em tela compartilhada com Gislane.
- Preserve acessibilidade, foco, rótulos, áreas de toque e telas estreitas; animação não pode perder carga, posição ou cronômetro. Consulte os pontos sensíveis específicos antes de alterar UI compartilhada.
- Hooks sem efeitos durante renderização; efeitos precisam limpar recursos quando aplicável.

## Hierarquia visual e UX (toda mudança que aparece na tela)

- **Uma coisa principal por tela/card.** Ordem de leitura: o quê (título curto) → por quê (1 linha) → o que fazer/muda. O mais importante é o maior, mais forte e mais alto.
- **Poucas palavras.** Título de 2–4 palavras; frases de até ~12 palavras; listas com " · ". Linguagem do aluno, sem jargão.
- **Escala fixa:** título `text-base`/`text-lg` bold; texto `text-sm`; apoio `text-xs text-slate-400`. Sem tamanhos novos sem motivo.
- **Cor tem significado e é consistente:** a mesma cor para o mesmo conceito no app inteiro; não reutilize cor de método para outra coisa; texto nunca só por cor (ícone ou palavra junto); contraste legível no fundo escuro.
- **Aviso no nível certo:** o que vale para a semana ou o dia vai uma vez no topo; no item, só o específico dele. Não repita o mesmo aviso em cada card.
- **Destaque é raro:** borda/fundo colorido só para o que muda a ação do usuário; o resto fica neutro.
- **Espaço agrupa:** itens relacionados juntos, blocos separados por espaço (`gap`/`mb` da escala vizinha), não por linhas extras.
- **Toque e leitura:** alvo ≥ 44 px (`min-h-11`), funciona em 360 px de largura, uma mão, com pressa e suado; estado vazio, carregando e erro sempre ditos.
- **Feedback e reversão:** toda ação responde na hora; ação destrutiva pede confirmação ou permite desfazer.
- **Siga o padrão vizinho** (componentes, ícones, espaçamento) antes de criar um novo; mudança visual relevante pede print/conferência em tela estreita.

## Comentários, documentação e testes

- Comente decisões, fórmulas e restrições; evite narrar código óbvio. Documente contrato alterado na fonte principal, sem copiar histórico.
- Testes unitários próximos ao módulo (`*.test.ts`); regras/integração em `tests/`; navegador em `e2e/`.
- Use testes existentes pertinentes. Mudanças de autorização exigem testes de recusa e isolamento; interface exige cenários afetados. Não crie testes que apenas repitam a implementação.
