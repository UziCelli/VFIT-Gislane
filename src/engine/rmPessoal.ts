// Modelo pessoal de RM: aprende, a partir das séries que o aluno já anotou do exercício, quanto ele rende a mais ou a menos
// que a média do estudo (tabela de Nuzzo et al. 2023, engine/rm.ts). Funções puras, sem LLM e sem servidor.
// Desenho do Arquiteto (simulação: docs/estimativa-rm.md). Ideia: cada série diz um "1RM implícito" y = ln(kg) − ln F(reps·e^−δ),
// onde δ é a resistência individual (δ > 0: o aluno faz MAIS repetições que a média na mesma %). Escolhe-se o δ (grade de 21
// valores, com encolhimento para 0) que deixa o 1RM implícito mais estável entre séries de reps diferentes; o nível vale no
// ÚLTIMO treino (sem atraso quando a força sobe) e a tendência é só para não atrasar (não se projeta o futuro).
// Limites de segurança: a previsão nunca passa de −12%/+8% sobre a da tabela pura; sem dado suficiente, δ = 0 (= tabela).
import { arredondarKg, fracaoDoRM, LIMITE_DIGITACAO, logDesvio, REPS_MAX_ALVO, REPS_MAX_ORIGEM } from './rm'

export interface PontoRm {
  t: number // tempo em semanas (semana + (treino−1)/frequência), sem usar o relógio do aparelho
  sessao: string // série(s) do mesmo treino compartilham a sessão
  kg: number // carga total da série
  reps: number // reps feitas (efetivas)
  serie: number // posição da série no exercício (0 = S1)
}
export interface ModeloRm {
  delta: number // resistência individual (log das reps vs a tabela)
  nivel: number // ln do 1RM implícito no último treino, sob a curva pessoal
  nivelTabela: number // o mesmo nível com δ = 0 (base da trava de segurança)
  desvios: number[] // desvio pequeno por série (S1..), encolhido para 0
  sessoes: number
}

const SD_INTRA = 0.025 // ruído de uma série dentro do mesmo treino
const SD_DIA = 0.04 // ruído do nível de um dia para outro
const SD_TEND = 0.03 // tendência (log por semana): larga para não atrasar
const SD_DELTA = 0.2 // DP da resistência individual (Nuzzo: DP das reps / média ≈ 0,2 a 0,3)
const MEIA_VIDA = 6 // semanas
const TETO_BAIXO = 0.88
const TETO_ALTO = 1.08
const GRADE = Array.from({ length: 21 }, (_, i) => Math.round((-0.5 + 0.05 * i) * 100) / 100)

// F com reps escalonadas por e^−δ; a tabela vai de 1 a ~26 reps.
const F = (reps: number, delta: number) => fracaoDoRM(Math.min(26, Math.max(1, reps * Math.exp(-delta))), 26)!

const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

// Ajusta o modelo; null quando não há ponto válido (reps 1..15, carga > 0). Descarta série cujo desvio da tabela fica a mais
// de LIMITE_DIGITACAO da mediana (erro de digitação), com 3 ou mais pontos.
export function ajustarRm(pontosBrutos: PontoRm[]): ModeloRm | null {
  let pontos = pontosBrutos.filter((p) => p.kg > 0 && p.reps >= 1 && p.reps <= REPS_MAX_ORIGEM && Number.isFinite(p.kg) && Number.isFinite(p.t))
  if (pontos.length >= 3) {
    const med = mediana(pontos.map((p) => logDesvio(p.kg, p.reps)!))
    pontos = pontos.filter((p) => Math.abs(logDesvio(p.kg, p.reps)! - med) <= LIMITE_DIGITACAO)
  }
  if (!pontos.length) return null
  const tUltimo = Math.max(...pontos.map((p) => p.t))
  const porSessao = new Map<string, PontoRm[]>()
  for (const p of pontos) porSessao.set(p.sessao, [...(porSessao.get(p.sessao) ?? []), p])
  const sessoes = [...porSessao.values()].map((ps) => ({ ps, x: ps.reduce((s, p) => s + p.t, 0) / ps.length - tUltimo, n: ps.length }))

  // Para cada δ: 1RM implícito por série, média por sessão e regressão ponderada (nível a e tendência b, com b encolhido).
  const ajusta = (delta: number) => {
    const ys = sessoes.map(({ ps }) => ps.map((p) => Math.log(p.kg) - Math.log(F(p.reps, delta))))
    const ym = ys.map((v) => v.reduce((s, y) => s + y, 0) / v.length)
    const w = sessoes.map(({ x, n }) => Math.pow(0.5, -x / MEIA_VIDA) / (SD_DIA ** 2 + SD_INTRA ** 2 / n))
    let sw = 0, swx = 0, swxx = 0, swy = 0, swxy = 0
    sessoes.forEach(({ x }, i) => {
      sw += w[i]
      swx += w[i] * x
      swxx += w[i] * x * x
      swy += w[i] * ym[i]
      swxy += w[i] * x * ym[i]
    })
    const a11 = sw, a12 = swx, a22 = swxx + 1 / SD_TEND ** 2
    const det = a11 * a22 - a12 * a12
    const a = (swy * a22 - a12 * swxy) / det
    const b = (a11 * swxy - a12 * swy) / det
    let j = (delta / SD_DELTA) ** 2 + (b / SD_TEND) ** 2
    ys.forEach((v, i) => {
      for (const y of v) j += (y - ym[i]) ** 2 / SD_INTRA ** 2
      j += w[i] * (ym[i] - a - b * sessoes[i].x) ** 2
    })
    return { delta, a, b, j, ys }
  }
  const todos = GRADE.map(ajusta)
  const melhor = todos.reduce((m, c) => (c.j < m.j ? c : m))
  const tabela = ajusta(0)
  // Desvio por série (S1, S2...): média dos resíduos em relação ao nível, encolhida (n + 2).
  const soma: number[] = []
  const cont: number[] = []
  sessoes.forEach(({ ps, x }, i) =>
    ps.forEach((p, j) => {
      const res = melhor.ys[i][j] - (melhor.a + melhor.b * x)
      soma[p.serie] = (soma[p.serie] ?? 0) + res
      cont[p.serie] = (cont[p.serie] ?? 0) + 1
    }),
  )
  const desvios = Array.from({ length: soma.length }, (_, k) => ((soma[k] ?? 0) / ((cont[k] ?? 0) + 2)))
  return { delta: melhor.delta, nivel: melhor.a, nivelTabela: tabela.a, desvios, sessoes: sessoes.length }
}

// Carga (kg) para `reps` repetições na série `serie` (0 = S1). null fora de 1..20 reps. Presa a −12%/+8% da tabela pura.
export function cargaPessoal(m: ModeloRm, reps: number, serie = 0): number | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > REPS_MAX_ALVO) return null
  const tabela = Math.exp(m.nivelTabela) * F(reps, 0)
  const pessoal = Math.exp(m.nivel + (m.desvios[serie] ?? 0)) * F(reps, m.delta)
  const razao = Math.min(TETO_ALTO, Math.max(TETO_BAIXO, pessoal / tabela))
  const kg = arredondarKg(tabela * razao)
  return kg > 0 ? kg : null
}

