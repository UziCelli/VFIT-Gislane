# Estimativa de carga por RM

O número cinza do treino (`cargaAnterior`, `src/lib/treino.ts`) é a carga da última vez que o aluno anotou o exercício. Quando as repetições de hoje são diferentes das daquele registro, a carga é **ajustada** pela tabela de repetições máximas (`src/engine/rm.ts`). A tela avisa: "Cargas em cinza: ajustadas às repetições de hoje, a partir do Treino X".

## Como calcula
1. 1RM estimado = carga feita ÷ fração do 1RM para as reps feitas.
2. Carga de hoje = 1RM estimado × fração do 1RM para as reps de hoje, arredondada a múltiplos de 0,5 kg (`PASSO_KG`). A carga que o aluno digita aceita até 3 casas.
3. Mesmas reps: a carga anotada vale como está, sem arredondar.

## Regras e limites
- Reps feitas não anotadas valem as prescritas daquele dia.
- Só ajusta com até 12 reps no registro de origem e até 20 reps de hoje. Fora disso, mantém a carga anotada.
- Não ajusta: peso do corpo, 2 lados, isometria e drops (ficam como foram anotados).
- A tabela é de série até a falha. Série parada antes subestima o 1RM e a sugestão sai um pouco leve.
- Supino e leg press têm tabela própria no estudo; aqui vale a geral para todos.

## Evidência
- Nuzzo et al. 2023, Sports Med 54:303-321, [doi 10.1007/s40279-023-01937-7](https://doi.org/10.1007/s40279-023-01937-7): meta-regressão de 269 estudos e 7.289 pessoas. Sexo, idade e nível de treino pouco alteram a relação; a tabela geral vale para todos. Dados em sua maioria de adultos saudáveis de 20 a 40 anos; abaixo de 65% do 1RM a estimativa é menos precisa. Tabela: "Reps ~ Load table.pdf" em https://osf.io/s94gf/.
- Reynolds et al. 2006, J Strength Cond Res 20:584-592, [doi 10.1519/R-15304.1](https://doi.org/10.1519/R-15304.1): 70 pessoas de 18 a 69 anos; prever o 1RM com até 10 reps é preciso, e acima disso o erro cresce.
- Fórmulas clássicas (Epley, Brzycki, O'Conner) não foram usadas: vêm de amostras pequenas e, a 70% do 1RM, preveem menos repetições (cerca de 12 a 13) que a meta-regressão (cerca de 15).

## Testes
`src/engine/rm.test.ts`, `src/lib/treino.test.ts` (`cargaAnterior ajustada às reps de hoje`).
