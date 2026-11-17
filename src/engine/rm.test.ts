import { describe, expect, it } from 'vitest'
import { arredondarKg, cargaEquivalente, fracaoDoRM, rmEstimado } from './rm'

describe('fracaoDoRM (tabela geral de Nuzzo 2023)', () => {
  it('1 repetição = 100% do 1RM', () => expect(fracaoDoRM(1)).toBe(1))
  it('pontos da tabela: 4,94 reps = 90%, 9,76 = 80%, 14,82 = 70%', () => {
    expect(fracaoDoRM(4.94)).toBeCloseTo(0.9, 5)
    expect(fracaoDoRM(9.76)).toBeCloseTo(0.8, 5)
    expect(fracaoDoRM(14.82)).toBeCloseTo(0.7, 5)
  })
  it('interpola entre os pontos e diminui com mais reps', () => {
    expect(fracaoDoRM(10)).toBeCloseTo(0.7954, 3)
    for (let r = 1; r < 20; r++) expect(fracaoDoRM(r + 1)!).toBeLessThan(fracaoDoRM(r)!)
  })
  it('fora de 1..20 não estima', () => {
    expect(fracaoDoRM(0)).toBeNull()
    expect(fracaoDoRM(0.5)).toBeNull()
    expect(fracaoDoRM(21)).toBeNull()
    expect(fracaoDoRM(Number.NaN)).toBeNull()
  })
})

describe('rmEstimado', () => {
  it('60 kg x 10 reps ≈ 75 kg', () => expect(rmEstimado(60, 10)).toBeCloseTo(75.4, 1))
  it('1 rep é o próprio 1RM', () => expect(rmEstimado(100, 1)).toBe(100))
  it('mais de 12 reps ou carga inválida: sem base', () => {
    expect(rmEstimado(40, 13)).toBeNull()
    expect(rmEstimado(0, 8)).toBeNull()
    expect(rmEstimado(-5, 8)).toBeNull()
  })
})

describe('arredondarKg', () => {
  it('passo de 0,5 kg e até 3 casas', () => {
    expect(arredondarKg(62.8)).toBe(63)
    expect(arredondarKg(62.7)).toBe(62.5)
    expect(arredondarKg(12.5, 2.5)).toBe(12.5)
    expect(arredondarKg(10.1234, 0.001)).toBe(10.123)
  })
})

describe('cargaEquivalente', () => {
  it('mesmas reps: devolve o que foi anotado, sem arredondar', () => expect(cargaEquivalente(61.25, 10, 10)).toBe(61.25))
  it('menos reps pede mais carga; mais reps pede menos', () => {
    expect(cargaEquivalente(60, 10, 8)).toBe(63)
    expect(cargaEquivalente(60, 10, 15)).toBeLessThan(60)
    expect(cargaEquivalente(60, 10, 15)).toBe(52.5)
  })
  it('ida e volta não deriva além do passo', () => {
    const ida = cargaEquivalente(80, 6, 12)!
    expect(Math.abs(cargaEquivalente(ida, 12, 6)! - 80)).toBeLessThanOrEqual(1)
  })
  it('sem base: null (reps de origem > 12, alvo > 20, carga 0)', () => {
    expect(cargaEquivalente(30, 15, 8)).toBeNull()
    expect(cargaEquivalente(30, 10, 25)).toBeNull()
    expect(cargaEquivalente(0, 10, 8)).toBeNull()
  })
})
