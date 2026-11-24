import { describe, expect, it } from 'vitest'
import { arredondarKg, cargaEquivalente, corrigirDigitacao, fracaoDoRM, rmEstimado } from './rm'

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
  it('até 15 reps serve de base; acima disso ou com carga inválida: sem base', () => {
    expect(rmEstimado(40, 15)).toBeCloseTo(57.5, 1)
    expect(rmEstimado(40, 16)).toBeNull()
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
  it('60 kg x 15 reps vira carga para 8 reps', () => {
    expect(cargaEquivalente(60, 15, 8)).toBe(72)
  })
  it('sem base: null (reps de origem > 15, alvo > 20, carga 0)', () => {
    expect(cargaEquivalente(30, 16, 8)).toBeNull()
    expect(cargaEquivalente(30, 10, 25)).toBeNull()
    expect(cargaEquivalente(0, 10, 8)).toBeNull()
  })
})

describe('corrigirDigitacao', () => {
  it('600 no lugar de 60 vira a carga equivalente da mediana', () => {
    const r = corrigirDigitacao([60, 60, 600, 60], [10, 10, 10, 10])
    expect(r.series).toEqual([60, 60, 60, 60])
    expect(r.trocadas).toEqual([2])
  })
  it('variação normal de resistência (pirâmide) não é erro', () => {
    const r = corrigirDigitacao([80, 70, 62, 55], [6, 8, 10, 12])
    expect(r.trocadas).toEqual([])
  })
  it('menos de 3 séries válidas: não mexe', () => {
    expect(corrigirDigitacao([60, 600], [10, 10]).trocadas).toEqual([])
    expect(corrigirDigitacao([60, null, 600], [10, 10, 10]).trocadas).toEqual([])
  })
  it('série vazia ou com reps fora da faixa não entra na conta', () => {
    const r = corrigirDigitacao([60, 60, 60, null, 40], [10, 10, 10, 10, 20])
    expect(r.series).toEqual([60, 60, 60, null, 40])
  })
})

describe('passo do aparelho', () => {
  it('passo como função do peso', () => {
    const halter = (kg: number) => (kg <= 10 ? 1 : 2)
    expect(arredondarKg(8.6, halter)).toBe(9)
    expect(arredondarKg(13.1, halter)).toBe(14)
  })
  it('máquina de placas de 5 kg: 60 x 10 para 8 reps vira 65, não 63', () => {
    expect(cargaEquivalente(60, 10, 8, 5)).toBe(65)
    expect(cargaEquivalente(60, 10, 15, 5)).toBe(55)
  })
  it('mesmas reps: não arredonda o anotado nem com passo grande', () => expect(cargaEquivalente(62, 10, 10, 5)).toBe(62))
})
