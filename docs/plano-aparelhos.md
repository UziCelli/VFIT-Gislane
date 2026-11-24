# Aparelhos e máquinas sem etiqueta

Fonte única do assunto. Código: `src/engine/aparelho.ts` (contas) e `src/data/aparelhos.ts` (catálogo).

## Estado (24/11/2026)

- **Feito (base):** modelo de aparelho, contas de nível/kg e lista do catálogo, com testes. Nada é gravado no Firestore e nenhuma tela usa ainda.
- **Próximo passo:** tela para o coach cadastrar aparelhos no app e o aluno anotar o nível (mexe no banco e nas regras).

## Modelo

- `nome`, `local` (academia/condomínio), `tipo` (halter, barra, máquina, articulada, polia, 2 polias).
- `unidade: 'kg'`: `incremento` (de quanto em quanto sobe), `minimo`/`maximo` opcionais.
- `unidade: 'nivel'`: `niveis` (1..N) e `kgNivel` (kg **estimado** de cada nível; `null` = não sei).
- `fabricante`/`modelo` opcionais (ex.: Movement W4, Life Fitness G7).
- Pilha com placa do topo mais leve: `kgDaPilha(topo, placa, niveis)` gera o kg estimado de cada nível.
- `polia: '2:1'`: o aluno puxa cerca de metade da etiqueta (`kgSentido`). `porLado`: carga anotada por lado.

## Regras das contas

- Valor anotado: aparelho em kg = número da etiqueta (como hoje); aparelho em nível = número do nível.
- Sugestão (`sugestaoNoAparelho`): kg do motor vira valor que existe no aparelho. Nível = o de kg estimado mais perto; empate fica no mais leve. Sem kg estimado: sem sugestão (o coach decide).
- Volume e carga média (`volumeNoAparelho`): o aluno anota só o nível; o nível vira kg estimado. Série sem kg estimado fica fora e é contada à parte (`semKg`).
- Nível sem kg anotado entre dois anotados: linha reta entre eles. Fora deles: não estima.

## Suposições (confirmar com o coach)

- Níveis sobem de 1 em 1, sem meio nível.
- A pilha sobe por igual entre dois níveis anotados.
- Polia 2:1 divide por 2 exato (o atrito real tira um pouco mais).
- Etiqueta em kg (sem libras).

## Como cadastrar um aparelho (até a tela existir)

Peça ao Claude: "cadastra a extensora do condomínio X, 12 níveis, nível 1 ≈ 5 kg". O item entra em `src/data/aparelhos.ts` e o teste confere.

## Pesquisa de fabricantes (24/11/2026)

- Movement W2/W4 e Life Fitness (G7, G5, G4, G2, Optima, Insignia, Axiom): nenhuma ficha pública com a pilha (placa do topo, placas, total). Nada entrou no catálogo sem fonte.
- Movement W CSR: o manual cita placas de 5 e 10 kg e polia 1:2, mas diz 65 kg e 95 kg por torre em trechos diferentes. Não entrou até medir no local.
- Caminho: medir no condomínio (peso do topo + peso de uma placa) e cadastrar com `kgDaPilha`.
