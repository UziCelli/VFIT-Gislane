# Estimativa de carga por RM

O número cinza do treino (`cargaAnterior`, `src/lib/treino.ts`) é a carga da última vez que o aluno anotou o exercício. Quando as repetições de hoje são diferentes das daquele registro, a carga é **ajustada** pela tabela de repetições máximas (`src/engine/rm.ts`). A tela avisa: "Cargas em cinza: ajustadas às repetições de hoje, a partir do Treino X".

## Quem liga e desliga
- Campo `estimativaRm` no `usuarios/{uid}` de cada pessoa (aluno ou coach; o coach usa a sua escolha no treino presencial). Ausente = ainda não escolheu; `false` = desligada; `true` = ligada. Sem ligar, o número cinza é o da última vez, sem ajuste.
- **Pop-up de uma vez** na tela de treino (`AvisoEstimativaRm.tsx`, mini onboarding), aberto na **primeira vez em que a sugestão traria algo** (corrigida de digitação, ajustada às reps de hoje ou vinda do ciclo anterior); antes disso nada muda para o aluno. "Ligar" grava `true`; "Agora não", fundo ou Esc gravam `false`. Não volta depois da escolha. Não abre no e2e (`navigator.webdriver`). Iniciantes: não se espera 2 a 3 meses; nas simulações do Arquiteto a sugestão errou menos e sugeriu peso a mais menos vezes que a carga crua, inclusive com dados ruins.
- **Chavinha** "Carga sugerida pelas repetições" em Conta (aluno) e Minha conta (coach): `ChaveEstimativaRm.tsx`.
- Regras: `firestore.rules` aceita `estimativaRm` booleano no próprio perfil do aluno (coach já escreve no seu); teste em `tests/rules.test.ts`.

## Como calcula
1. 1RM estimado = carga feita ÷ fração do 1RM para as reps feitas.
2. Carga de hoje = 1RM estimado × fração do 1RM para as reps de hoje, arredondada a múltiplos de 0,5 kg (`PASSO_KG`). A carga que o aluno digita aceita até 3 casas.
3. Mesmas reps: a carga anotada vale como está, sem arredondar.

## Regras e limites
- Reps feitas não anotadas valem as prescritas daquele dia.
- Só ajusta com até **15** reps no registro de origem e até 20 reps de hoje. Fora disso, mantém a carga anotada. Perto de 15 reps a incerteza individual é de uns ±10% da carga (±5% até 8 reps): a sugestão é referência, o aluno digita a dele.
- Não ajusta: peso do corpo, 2 lados, isometria e drops (ficam como foram anotados).
- A tabela é de série até a falha. Série parada antes subestima o 1RM e a sugestão sai um pouco leve.
- Supino e leg press têm tabela própria no estudo; aqui vale a geral para todos.

## Digitação errada
`corrigirDigitacao` (`src/engine/rm.ts`): com 3 ou mais séries válidas, a que fica a mais de ±30% (em log) da mediana do registro vira a carga equivalente da mediana (600 em vez de 60 não vira sugestão). Variação normal de resistência (pirâmide) não passa de 30%.

## Meso anterior
Na 1ª semana de um ciclo novo, `cargaAnterior` usa o meso anterior do aluno (maior `inicio` antes do atual), **só quando o meso atual não tem nada**. Casa pelo nome **normalizado idêntico** (acento, caixa e espaços não contam; `normalizar` de `lib/iaTreino.ts`) com o mesmo `doisLados` e a mesma isometria. Nunca por "contém": "Supino Reto Barra" não é "Supino Reto Halter". Sem leitura nova no Firestore (reaproveita os mesos e registros que o `Treino.tsx` já carrega). A tela diz "ciclo anterior".

## Modelo pessoal do aluno
`src/engine/rmPessoal.ts` (puro) + `src/lib/rmPessoal.ts` (monta os pontos). Com a chave ligada, o app aprende quanto o aluno rende a mais ou a menos que a média: para cada exercício (nome normalizado + 2 lados + isometria), usa as séries anotadas antes de hoje (reps 1 a 15; meso atual e anterior) e escolhe a resistência individual δ (grade de 21 valores, encolhida para 0 com DP 0,2) que deixa o 1RM implícito mais estável. O nível vale no **último treino** (sem atraso quando a força sobe; tendência larga, 3%/semana, e nada de projetar o futuro); peso por recência com meia-vida de 6 semanas; desvio pequeno por série. **Teto:** a previsão nunca passa de −12% / +8% da tabela pura. **Digitação** é filtrada dentro de cada sessão (3 ou mais séries; nunca contra outros treinos, porque carga que muda de verdade não é erro). **Mudança de regime:** se o último treino difere mais de 15% do que vinha antes, só ele conta (queda por lesão, aparelho novo). Reps iguais às do registro, ou registro de origem com mais de 15 reps: fica a carga anotada. Sem dado válido: tabela. Fora do modelo: peso do corpo, 2 lados, isometria e drops.

Números do Arquiteto (simulação própria, 12 reps é o caso típico; erro médio ao mudar as reps, aluno experiente): carga crua 11 a 30%; tabela com base até 12, 8 a 16%; tabela com filtro e base até 15, 4,5 a 7%; **modelo pessoal 3,5 a 4%**, com sugestões mais de 10% acima do que o aluno faria em 2,4% (tabela pura 7,5%). A maior parte do ganho vem do filtro, da base até 15 e de promediar várias séries; o ajuste individual soma 0,4 a 1,5 ponto. É simulação com gerador próprio: confirmar com dados reais antes de generalizar (critério: errar menos que hoje em 70% dos alunos, 1 ponto a menos na média, sem aumentar as sugestões pesadas).

## "Confere?" na digitação
`cargaSuspeita` (`src/lib/conferirCarga.ts`): na **primeira** digitação de uma célula de carga (corrigir um número já gravado nunca pergunta), se a carga fica ≥1,5× ou ≤0,67× a referência (o número cinza que o aluno vê, já com a semana de volta) **e** a diferença passa de 5 kg (carga leve varia muito em proporção), o `LoadInput` mostra "Confere? X kg está bem diferente de Y kg" com **Está certo** (grava) e **Corrigir** (limpa o campo). Não grava antes da resposta. Sem referência, não pergunta. Vale no aluno e no presencial (mesmo componente; `CampoLados` repassa).

## Repetições que sobraram (RIR)
Campo `rir` no registro (`rir.<slotId>.s<n>`, mesmo formato de `reps`): 0, 1, 2 ou 3 (= 3 ou mais). Pergunta opcional de 1 toque ("Ainda faria quantas?", `PerguntaRir.tsx`) logo abaixo da **última série normal** do exercício, depois de gravada a carga; só no aluno; não aparece em isometria nem nas etapas de drop. Tocar de novo na opção marcada limpa. Leitura: `docParaRir` (só 0..3; o resto vira vazio). Regras: `rir` é mapa (`firestore.rules`, `registroValido`, lista do create e do update; testes em `tests/rules.test.ts`). **Não entra na carga sugerida** (o Arquiteto mostrou que não melhora); serve ao coach (esforço médio por exercício, no painel de evolução, próxima PR) e para saber quem treina longe da falha.

## Painel do coach e aba Consultas
- **Painel** (`Evolução` do aluno, só no modo coach; `PainelEvolucao.tsx`, lógica em `src/lib/rmEvolucao.ts`): no cartão "Por exercício", mostra o **1RM estimado** (maior 1RM implícito do último treino, já sem erro de digitação, **por baixo**), a **tendência** (média dos 2 últimos treinos contra a dos até 4 anteriores; ±2% é "estável"; com menos de 3 treinos não opina) e o **esforço médio** (média das últimas 5 respostas de "ainda faria quantas?"). Fora do cálculo: isometria, 2 lados, peso do corpo e drops. Não há alerta global (os alertas só leem 14 dias de registros).
- **Aba Consultas** (antes "Métodos", mesma rota `#/metodos`): seletor Treino | Físio | **Referências** (`GuiaReferencias.tsx`, rota `#/referencias`) com a fonte de cada cálculo (RM, % de gordura, peso do corpo). O editor de meso continua com a aba "Métodos" própria.

## Evidência
- Nuzzo et al. 2023, Sports Med 54:303-321, [doi 10.1007/s40279-023-01937-7](https://doi.org/10.1007/s40279-023-01937-7): meta-regressão de 269 estudos e 7.289 pessoas. Sexo, idade e nível de treino pouco alteram a relação; a tabela geral vale para todos. Dados em sua maioria de adultos saudáveis de 20 a 40 anos; abaixo de 65% do 1RM a estimativa é menos precisa. Tabela: "Reps ~ Load table.pdf" em https://osf.io/s94gf/.
- Reynolds et al. 2006, J Strength Cond Res 20:584-592, [doi 10.1519/R-15304.1](https://doi.org/10.1519/R-15304.1): 70 pessoas de 18 a 69 anos; prever o 1RM com até 10 reps é preciso, e acima disso o erro cresce.
- Fórmulas clássicas (Epley, Brzycki, O'Conner) não foram usadas: vêm de amostras pequenas e, a 70% do 1RM, preveem menos repetições (cerca de 12 a 13) que a meta-regressão (cerca de 15).

## Testes
`src/engine/rm.test.ts`, `src/engine/rmPessoal.test.ts`, `src/lib/rmPessoal.test.ts`, `src/lib/treino.test.ts` (ajuste às reps de hoje, digitação errada, meso anterior).
