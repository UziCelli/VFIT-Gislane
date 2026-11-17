// Estimativa de carga por repetições máximas (RM). Funções puras.
// Base: meta-regressão de Nuzzo et al. 2023 (Sports Med 54:303-321, doi 10.1007/s40279-023-01937-7; 269 estudos,
// 7.289 pessoas). Sexo, idade e nível de treino pouco mexem na relação, então vale a tabela geral para todos.
// Tabela geral = "Reps ~ Load table.pdf" do OSF do estudo (https://osf.io/s94gf/): repetições médias até a falha
// em cada % do 1RM. Referência complementar: Reynolds et al. 2006 (J Strength Cond Res 20:584, doi 10.1519/R-15304.1):
// prever o 1RM com até 10 repetições é preciso; acima disso o erro cresce.
// Limites: dados de adultos de 20 a 40 anos; abaixo de 65% do 1RM o estudo é menos preciso; supino e leg press têm tabela
// própria no estudo (leg press rende mais reps), aqui vale a geral. A tabela é de série até a FALHA: série parada antes
// subestima o 1RM, e a sugestão sai um pouco leve (lado seguro).

// [% do 1RM, repetições médias até a falha]. O ponto [100, 1] vale por definição de 1RM.
const TABELA: readonly (readonly [number, number])[] = [
  [100, 1], [95, 3.28], [90, 4.94], [85, 7.16], [80, 9.76], [75, 12.38], [70, 14.82], [65, 17.13],
  [60, 19.56], [55, 22.46], [50, 26.03],
]

export const REPS_MAX_ORIGEM = 12 // acima disso a carga feita não serve de base (Reynolds: até ~10)
export const REPS_MAX_ALVO = 20 // acima disso a carga cai para perto de 60% do 1RM, onde o estudo perde precisão
export const PASSO_KG = 0.5

// Fração do 1RM (0–1) que se levanta em `reps` repetições até a falha; null fora de 1..limite.
export function fracaoDoRM(reps: number, limite = REPS_MAX_ALVO): number | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > limite) return null
  for (let i = 1; i < TABELA.length; i++) {
    const [p0, r0] = TABELA[i - 1]
    const [p1, r1] = TABELA[i]
    if (reps <= r1) return (p0 + ((p1 - p0) * (reps - r0)) / (r1 - r0)) / 100
  }
  return null
}

// 1RM estimado de uma série de `reps` repetições com `carga` kg; null se não der para estimar.
export function rmEstimado(carga: number, reps: number): number | null {
  const f = fracaoDoRM(reps, REPS_MAX_ORIGEM)
  return f == null || !(carga > 0) ? null : carga / f
}

// Até 3 casas (aparelhos com microcarga); o passo não força número inteiro.
export const arredondarKg = (kg: number, passo = PASSO_KG) => Math.round(Math.round(kg / passo) * passo * 1000) / 1000

// Carga para `repsAlvo` repetições a partir de uma série feita (`carga` x `repsFeitas`). Mesmo número de reps: devolve a
// carga como está (sem arredondar o que o aluno anotou). null quando não há base (reps fora da faixa, carga ≤ 0).
export function cargaEquivalente(carga: number, repsFeitas: number, repsAlvo: number, passo = PASSO_KG): number | null {
  if (!(carga > 0)) return null
  if (repsFeitas === repsAlvo) return carga
  const rm = rmEstimado(carga, repsFeitas)
  const f = fracaoDoRM(repsAlvo)
  if (rm == null || f == null) return null
  const kg = arredondarKg(rm * f, passo)
  return kg > 0 ? kg : null
}
