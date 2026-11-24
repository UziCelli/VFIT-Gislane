# Aparelhos e máquinas sem etiqueta

Fonte única do assunto. Código: `src/engine/aparelho.ts` (contas) e `src/data/aparelhos.ts` (catálogo).

## Estado (24/11/2026)

- **Feito (base):** modelo de aparelho, contas de nível/kg e lista do catálogo, com testes. Nada é gravado no Firestore e nenhuma tela usa ainda.
- **Próximo passo:** tela para o coach cadastrar aparelhos no app e o aluno anotar o nível (mexe no banco e nas regras).

## Modelo

- `nome`, `local` (academia/condomínio), `tipo` (halter, barra, máquina, articulada, polia, 2 polias).
- `unidade: 'kg'`: `incremento` (de quanto em quanto sobe), `minimo`/`maximo` opcionais.
- `unidade: 'nivel'`: `niveis` (1..N) e `kgNivel` (kg **estimado** de cada nível; `null` = não sei).
- `polia: '2:1'`: o aluno puxa cerca de metade da etiqueta (`kgSentido`). `porLado`: carga anotada por lado.

## Regras das contas

- Valor anotado: aparelho em kg = número da etiqueta (como hoje); aparelho em nível = número do nível.
- Sugestão (`sugestaoNoAparelho`): kg do motor vira valor que existe no aparelho. Nível = o de kg estimado mais perto; empate fica no mais leve. Sem kg estimado: sem sugestão (o coach decide).
- Nível sem kg anotado entre dois anotados: linha reta entre eles. Fora deles: não estima.

## Suposições (confirmar com o coach)

- Níveis sobem de 1 em 1, sem meio nível.
- A pilha sobe por igual entre dois níveis anotados.
- Polia 2:1 divide por 2 exato (o atrito real tira um pouco mais).
- Etiqueta em kg (sem libras).

## Como cadastrar um aparelho (até a tela existir)

Peça ao Claude: "cadastra a extensora do condomínio X, 12 níveis, nível 1 ≈ 5 kg". O item entra em `src/data/aparelhos.ts` e o teste confere.
