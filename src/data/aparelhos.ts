import type { Aparelho } from '../engine/aparelho'

// Catálogo de aparelhos que o coach encontrou (sobretudo os sem etiqueta de peso). Guia: docs/plano-aparelhos.md.
// Cada item é conferido por `problemasAparelho` no teste (src/engine/aparelho.test.ts). Exemplo de item:
//   {
//     id: 'cond-x-extensora', nome: 'Cadeira extensora', local: 'Condomínio X', tipo: 'maquina',
//     unidade: 'nivel', niveis: 12, kgNivel: [5, 10, null, 20], // kg estimado; null = não sei
//     obs: 'Pino à direita do banco.',
//   },
export const APARELHOS: Aparelho[] = []
