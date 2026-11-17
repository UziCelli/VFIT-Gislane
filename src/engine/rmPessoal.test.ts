import { describe, expect, it } from 'vitest'
import { arredondarKg, cargaEquivalente, fracaoDoRM } from './rm'
import { ajustarRm, cargaPessoal, type PontoRm } from './rmPessoal'

const F = (reps: number, delta = 0) => fracaoDoRM(Math.min(26, Math.max(1, reps * Math.exp(-delta))), 26)!
// Série de um aluno com 1RM `rm` e resistência individual `delta` (sem ruído).
const ponto = (rm: number, delta: number, reps: number, t = 1, sessao = `s${t}`, serie = 0): PontoRm => ({ t, sessao, kg: rm * F(reps, delta), reps, serie })

describe('ajustarRm / cargaPessoal', () => {
  it('sem ponto válido: null', () => {
    expect(ajustarRm([])).toBeNull()
    expect(ajustarRm([{ t: 1, sessao: 'a', kg: 60, reps: 20, serie: 0 }])).toBeNull() // acima de 15 reps
    expect(ajustarRm([{ t: 1, sessao: 'a', kg: 0, reps: 10, serie: 0 }])).toBeNull()
  })

  it('aluno na média (sem ruído) reproduz a tabela', () => {
    const pts = [1, 2, 3, 4].flatMap((t) => [8, 10, 12].map((r, j) => ponto(100, 0, r, t, `s${t}`, j)))
    const m = ajustarRm(pts)!
    expect(Math.abs(m.delta)).toBeLessThanOrEqual(0.05)
    for (const r of [6, 8, 12, 15]) expect(cargaPessoal(m, r)).toBeCloseTo(arredondarKg(100 * F(r)), 0)
  })

  it('1 sessão com 1 série: mesma conta da tabela (δ = 0)', () => {
    const m = ajustarRm([{ t: 1, sessao: 'a', kg: 60, reps: 10, serie: 0 }])!
    expect(m.delta).toBe(0)
    expect(cargaPessoal(m, 8)).toBe(cargaEquivalente(60, 10, 8))
    expect(cargaPessoal(m, 10)).toBe(60)
  })

  it('pirâmide de aluno "resistente" desloca δ para cima e respeita o teto de +8%', () => {
    const pts = [1, 2, 3].flatMap((t) => [6, 10, 15].map((r, j) => ponto(100, 0.3, r, t, `s${t}`, j)))
    const m = ajustarRm(pts)!
    expect(m.delta).toBeGreaterThan(0.1)
    const tabela = Math.exp(m.nivelTabela) * F(12) // o que a tabela pura prevê para 12 reps com os dados DESTE aluno
    const verdade = 100 * F(12, 0.3)
    const p = cargaPessoal(m, 12)!
    expect(Math.abs(p - verdade)).toBeLessThan(Math.abs(tabela - verdade)) // melhora sobre a tabela
    expect(p).toBeLessThanOrEqual(arredondarKg(tabela * 1.08) + 0.001) // teto
  })

  it('pirâmide de aluno que rende menos: δ negativo e piso de −12%', () => {
    const pts = [1, 2, 3].flatMap((t) => [6, 10, 15].map((r, j) => ponto(100, -0.4, r, t, `s${t}`, j)))
    const m = ajustarRm(pts)!
    expect(m.delta).toBeLessThan(-0.1)
    const tabela = Math.exp(m.nivelTabela) * F(12)
    const p = cargaPessoal(m, 12)!
    expect(p).toBeGreaterThanOrEqual(arredondarKg(tabela * 0.88) - 0.001) // piso
    expect(p).toBeLessThan(tabela) // e continua abaixo da tabela: o aluno rende menos
    expect(Math.abs(p - 100 * F(12, -0.4))).toBeLessThan(Math.abs(tabela - 100 * F(12, -0.4)))
  })

  it('600 no lugar de 60 é ignorado', () => {
    const pts: PontoRm[] = [
      { t: 1, sessao: 'a', kg: 60, reps: 10, serie: 0 },
      { t: 1, sessao: 'a', kg: 60, reps: 10, serie: 1 },
      { t: 1, sessao: 'a', kg: 600, reps: 10, serie: 2 },
      { t: 1, sessao: 'a', kg: 60, reps: 10, serie: 3 },
    ]
    expect(cargaPessoal(ajustarRm(pts)!, 10)).toBe(60)
  })

  it('progresso linear: o nível vale no último treino (sem atraso)', () => {
    // 4 semanas, +2%/semana, sempre 10 reps
    const pts = [0, 1, 2, 3].map((i) => ponto(100 * 1.02 ** i, 0, 10, i + 1))
    const m = ajustarRm(pts)!
    const ultimo = 100 * 1.02 ** 3 * F(10)
    expect(Math.abs(cargaPessoal(m, 10)! - ultimo)).toBeLessThanOrEqual(1) // no máximo 1 passo de 0,5 kg a mais ou a menos
  })

  it('reps fora de 1..20 no alvo: sem sugestão', () => {
    const m = ajustarRm([ponto(100, 0, 10)])!
    expect(cargaPessoal(m, 25)).toBeNull()
    expect(cargaPessoal(m, 0)).toBeNull()
  })

  it('é determinístico e rápido (menos de 5 ms para 60 séries)', () => {
    const pts = Array.from({ length: 20 }, (_, t) => [6, 10, 12].map((r, j) => ponto(90, 0.1, r, t + 1, `s${t}`, j))).flat()
    const t0 = performance.now()
    const a = ajustarRm(pts)
    const ms = performance.now() - t0
    expect(JSON.stringify(a)).toBe(JSON.stringify(ajustarRm(pts)))
    expect(ms).toBeLessThan(50) // folga larga para CI lento; em média fica abaixo de 1 ms
  })
})
