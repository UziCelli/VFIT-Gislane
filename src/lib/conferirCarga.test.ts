import { describe, expect, it } from 'vitest'
import { cargaSuspeita } from './conferirCarga'

describe('cargaSuspeita', () => {
  it('600 no lugar de 60 e 6 no lugar de 60 são suspeitos', () => {
    expect(cargaSuspeita(600, 60)).toBe(true)
    expect(cargaSuspeita(6, 60)).toBe(true)
  })
  it('variação normal de treino não pergunta', () => {
    expect(cargaSuspeita(62.5, 60)).toBe(false)
    expect(cargaSuspeita(70, 60)).toBe(false)
    expect(cargaSuspeita(45, 60)).toBe(false) // 0,75
  })
  it('limites: 1,5× e 0,67×', () => {
    expect(cargaSuspeita(90, 60)).toBe(true)
    expect(cargaSuspeita(40, 60)).toBe(true) // 0,667
    expect(cargaSuspeita(89, 60)).toBe(false)
  })
  it('carga leve: proporção grande mas diferença pequena não pergunta', () => {
    expect(cargaSuspeita(3, 2)).toBe(false)
    expect(cargaSuspeita(2, 4)).toBe(false)
    expect(cargaSuspeita(12, 6)).toBe(true) // 2× e 6 kg de diferença
  })
  it('sem referência, vazio ou zero: não pergunta', () => {
    expect(cargaSuspeita(100, null)).toBe(false)
    expect(cargaSuspeita(100, undefined)).toBe(false)
    expect(cargaSuspeita(100, 0)).toBe(false)
    expect(cargaSuspeita(0, 60)).toBe(false)
  })
})
