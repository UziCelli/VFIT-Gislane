# Aparelhos e máquinas sem etiqueta

Fonte única do assunto. Código: `src/engine/aparelho.ts` (contas) e `src/data/aparelhos.ts` (catálogo).

## Estado (24/11/2026)

- **Feito (base):** modelo de aparelho, contas de nível/kg e lista do catálogo, com testes.
- **Feito (#260, 27/11/2026):** tela Guias → Catálogo → Máquinas (`#/maquinas`). O coach cadastra cada máquina por local (tipo, marca/modelo, kg ou nível, degraus, plaquinhas, polia, por lado) e liga aos exercícios. Firestore `maquinas/{id}` (ver `docs/mapa.md`); conferência em `src/lib/maquinas.ts`. O catálogo de exercícios mostra as máquinas de cada um.
- **Feito (#261):** o coach escolhe a máquina de cada exercício na montagem (Divisão) ou só no dia (presencial). O aluno vê só o rótulo da máquina (nome ou "Nome para o aluno"); local, observação e marca ficam no catálogo do coach. O treino guarda a identidade opaca (`ref`), nunca o id do catálogo: apagar A e cadastrar B igual dá outra identidade, e o histórico de A continua em A. Ao iniciar, a cópia do treino no registro guarda a escala daquele dia: trocar ou editar a máquina depois não muda o passado. Treino antigo sem cópia = "legado": as telas não mostram a máquina do plano nele (`maquinaDesconhecida`). O campo continua em kg: anotar o nível (e as métricas em nível) fica para a #262.
- **Próximo passo:** carga sugerida por máquina (#262), usando `maquinaUsada`.

## Modelo

- `nome`, `local` (academia/condomínio), `tipo` (halter, barra, máquina, articulada, polia, 2 polias).
- `unidade: 'kg'`: `incremento` (de quanto em quanto sobe), `minimo`/`maximo` opcionais, `complementos` (plaquinhas que somam por cima do degrau, cada uma 1 vez; ex.: Life Fitness `[0.625, 0.625]`: 11,25 → 11,875 → 12,5 → 13,75).
- `unidade: 'nivel'`: `niveis` (1..N) e `kgNivel` (kg **estimado** de cada nível; `null` = não sei).
- `fabricante`/`modelo` opcionais (ex.: Movement W4, Life Fitness G7).
- Pilha com placa do topo mais leve: `kgDaPilha(topo, placa, niveis)` gera o kg estimado de cada nível.
- `polia: '2:1'`: o aluno puxa cerca de metade da etiqueta (`kgSentido`). `porLado`: carga anotada por lado.

## Regras das contas

- Arredondamento: sempre para o valor que existe mais perto; empate sobe (igual ao arredondamento padrão por tipo). Aparelho do catálogo vence o padrão por tipo.

- Valor anotado: aparelho em kg = número da etiqueta (como hoje); aparelho em nível = número do nível.
- Sugestão (`sugestaoNoAparelho`): kg do motor vira valor que existe no aparelho. Nível = o de kg estimado mais perto. Sem kg estimado: sem sugestão (o coach decide).
- Volume e carga média (`volumeNoAparelho`): o aluno anota só o nível; o nível vira kg estimado. Série sem kg estimado fica fora e é contada à parte (`semKg`).
- Nível sem kg anotado entre dois anotados: linha reta entre eles. Fora deles: não estima.

## Suposições (confirmar com o coach)

- Níveis sobem de 1 em 1, sem meio nível.
- A pilha sobe por igual entre dois níveis anotados.
- Polia 2:1 divide por 2 exato (o atrito real tira um pouco mais).
- Etiqueta em kg (sem libras).

## Como cadastrar um aparelho

No app: Guias → Catálogo de exercícios → Máquinas → Adicionar máquina. Pilha com placas desiguais: a tela só faz topo + placa fixa (`kgDaPilha`); para outra, peça ao Claude.

## Pesquisa de fabricantes (24/11/2026)

- Movement W2/W4 e Life Fitness (G7, G5, G4, G2, Optima, Insignia, Axiom): nenhuma ficha pública com a pilha (placa do topo, placas, total). Nada entrou no catálogo sem fonte.
- Movement W CSR: o manual cita placas de 5 e 10 kg e polia 1:2, mas diz 65 kg e 95 kg por torre em trechos diferentes. Não entrou até medir no local.
- Caminho: medir no condomínio (peso do topo + peso de uma placa) e cadastrar com `kgDaPilha`.
