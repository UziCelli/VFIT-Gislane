import { describe, expect, it } from 'vitest'
import { passoDoAparelho } from './passo'
import { arredondarKg } from './rm'

const arred = (kg: number, nome: string) => arredondarKg(kg, passoDoAparelho(nome))

describe('passoDoAparelho', () => {
  it('halter: 1 kg até 10, depois 2', () => {
    expect(arred(7.4, 'Rosca Direta Halter')).toBe(7)
    expect(arred(16.9, 'Rosca Direta Halter')).toBe(16)
  })
  it('barra, anilha, seletora e polia: 2,5 kg', () => {
    expect(arred(63, 'Supino Reto Barra')).toBe(62.5)
    expect(arred(101, 'Leg Press 45')).toBe(100)
    expect(arred(48.9, 'Remada Articulada')).toBe(50)
    expect(arred(63, 'Cadeira Extensora')).toBe(62.5)
    expect(arred(31, 'Tríceps Pulley Corda')).toBe(30)
    expect(arred(12, 'Crossover')).toBe(12.5)
  })
  it('não reconhecido segue em 0,5 kg', () => expect(arred(20.3, 'Flexão de Braço')).toBe(20.5))
})
