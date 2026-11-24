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

export const REPS_MAX_ORIGEM = 15 // acima disso a carga feita não serve de base. O estudo é preciso até ~65% do 1RM (~17 reps); a incerteza individual chega a ±10% da carga aqui
export const REPS_MAX_ALVO = 20 // acima disso a carga cai para perto de 60% do 1RM, onde o estudo perde precisão
export const PASSO_KG = 0.5
// Passo fixo (kg) ou uma função do peso bruto (ex.: halter de 1 em 1 até 10 kg, depois de 2 em 2). Ver engine/passo.ts.
export type Passo = number | ((kg: number) => number)

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
export const arredondarKg = (kg: number, passo: Passo = PASSO_KG) => {
  const p = typeof passo === 'function' ? passo(kg) : passo
  return Math.round(Math.round(kg / p) * p * 1000) / 1000
}

// Carga para `repsAlvo` repetições a partir de uma série feita (`carga` x `repsFeitas`). Mesmo número de reps: devolve a
// carga como está (sem arredondar o que o aluno anotou). null quando não há base (reps fora da faixa, carga ≤ 0).
export function cargaEquivalente(carga: number, repsFeitas: number, repsAlvo: number, passo: Passo = PASSO_KG): number | null {
  if (!(carga > 0)) return null
  if (repsFeitas === repsAlvo) return carga
  const rm = rmEstimado(carga, repsFeitas)
  const f = fracaoDoRM(repsAlvo)
  if (rm == null || f == null) return null
  const kg = arredondarKg(rm * f, passo)
  return kg > 0 ? kg : null
}

// Desvio (em log) de cada série em relação à tabela: ln(kg) - ln(fração do 1RM para as reps). Serve para achar digitação errada.
export const logDesvio = (kg: number, reps: number): number | null => {
  const f = fracaoDoRM(reps, REPS_MAX_ORIGEM)
  return f == null || !(kg > 0) ? null : Math.log(kg) - Math.log(f)
}
export const LIMITE_DIGITACAO = 0.3 // ~±30% da carga em relação à mediana das séries: acima disso é erro de digitação, não de resistência

const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

// Troca por um valor plausível a série digitada com erro óbvio (ex.: 600 em vez de 60): com 3 ou mais séries válidas, a que
// fica a mais de LIMITE_DIGITACAO da mediana vira a carga equivalente da mediana para as reps dela. Menos de 3: não mexe.
// Devolve o novo vetor e quais posições foram trocadas.
export function corrigirDigitacao(series: (number | null | undefined)[], reps: number[], passo: Passo = PASSO_KG) {
  const pontos = series.flatMap((kg, i) => {
    const d = kg == null ? null : logDesvio(kg, reps[i])
    return d == null ? [] : [{ i, d }]
  })
  const out = series.map((x) => x ?? null)
  const trocadas: number[] = []
  if (pontos.length < 3) return { series: out, trocadas }
  const med = mediana(pontos.map((p) => p.d))
  for (const { i, d } of pontos) {
    if (Math.abs(d - med) <= LIMITE_DIGITACAO) continue
    const f = fracaoDoRM(reps[i], REPS_MAX_ORIGEM)!
    const kg = arredondarKg(Math.exp(med) * f, passo)
    if (kg > 0) {
      out[i] = kg
      trocadas.push(i)
    }
  }
  return { series: out, trocadas }
}
