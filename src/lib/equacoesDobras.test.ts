import { describe, expect, it } from 'vitest'
import { escolherEquacao, gorduraPorEquacao } from './equacoesDobras'
import { etm, foraDaTolerancia, mediaDupla, mudancaReal } from './etm'

const todas = (mm: number) => ({ peitoral: mm, axilar: mm, triceps: mm, subescapular: mm, abdominal: mm, suprailiaca: mm, coxa: mm, biceps: mm, panturrilha: mm })

describe('escolha da equação', () => {
  it('adulto na faixa: Pollock 7', () => expect(escolherEquacao({ sexo: 'M', idade: 30, dobras: todas(10), imc: 24 })?.eq).toBe('jp7'))
  it('acima da faixa ou IMC ≥ 30: Durnin & Womersley', () => {
    expect(escolherEquacao({ sexo: 'F', idade: 60, dobras: todas(15), imc: 25 })?.eq).toBe('dw')
    expect(escolherEquacao({ sexo: 'M', idade: 40, dobras: todas(25), imc: 32 })?.eq).toBe('dw')
  })
  it('menor de 18: Slaughter', () => expect(escolherEquacao({ sexo: 'F', idade: 15, dobras: todas(12), imc: 20 })?.eq).toBe('slaughter'))
  it('só 3 dobras: Pollock 3', () => expect(escolherEquacao({ sexo: 'M', idade: 25, dobras: { peitoral: 8, abdominal: 15, coxa: 12 }, imc: 23 })?.eq).toBe('jp3'))
})

describe('equações', () => {
  it('valores plausíveis', () => {
    expect(gorduraPorEquacao('jp3', { sexo: 'M', idade: 25, dobras: { peitoral: 8, abdominal: 15, coxa: 12 }, imc: null })).toBeCloseTo(10, 0)
    expect(gorduraPorEquacao('dw', { sexo: 'M', idade: 25, dobras: todas(10), imc: null })).toBeCloseTo(16.1, 0)
    expect(gorduraPorEquacao('slaughter', { sexo: 'M', idade: 12, dobras: todas(10), imc: null })).toBeCloseTo(15.7, 1)
  })
})

describe('ETM', () => {
  it('ETM = √(Σd²/2n) e % sobre a média', () => {
    const e = etm([[10, 11], [20, 19]], 'dobra')!
    expect(e.abs).toBeCloseTo(0.71, 2)
    expect(e.pct).toBeCloseTo(4.7, 1)
    expect(e.dentro).toBe(true)
  })
  it('menor mudança real só com 5 pares ou mais', () => {
    const e = etm(Array.from({ length: 5 }, () => [10, 11] as [number, number]), 'dobra')
    expect(mudancaReal(e, 10)).toBeCloseTo(2.77 * 0.0674 * 10, 1)
    expect(mudancaReal(etm([[10, 11]], 'dobra'), 10)).toBeNull()
  })
  it('média das duas e pedido da 3ª medida', () => {
    expect(mediaDupla({ triceps: 10 }, { triceps: 11 })).toEqual({ triceps: 10.5 })
    expect(foraDaTolerancia({ triceps: 10 }, { triceps: 12 }, 'dobra')).toEqual([{ id: 'triceps', a: 10, b: 12, pct: 18 }])
  })
})
