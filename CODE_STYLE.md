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

## Comentários, documentação e testes

- Comente decisões, fórmulas e restrições; evite narrar código óbvio. Documente contrato alterado na fonte principal, sem copiar histórico.
- Testes unitários próximos ao módulo (`*.test.ts`); regras/integração em `tests/`; navegador em `e2e/`.
- Use testes existentes pertinentes. Mudanças de autorização exigem testes de recusa e isolamento; interface exige cenários afetados. Não crie testes que apenas repitam a implementação.
