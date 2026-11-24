import { describe, expect, it } from 'vitest'
import { passoDoAparelho } from './passo'
import { arredondarKg } from './rm'

const arred = (kg: number, nome: string) => arredondarKg(kg, passoDoAparelho(nome))

describe('passoDoAparelho', () => {
  it('halter: 1 kg até 10, depois 2', () => {
    expect(arred(7.4, 'Rosca Direta Halter')).toBe(7)
    expect(arred(16.9, 'Rosca Direta Halter')).toBe(16)
  })
  it('barra 2 kg, máquina e polia 5 kg', () => {
    expect(arred(63, 'Supino Reto Barra')).toBe(64)
    expect(arred(63, 'Cadeira Extensora')).toBe(65)
    expect(arred(31, 'Tríceps Pulley Corda')).toBe(30)
    expect(arred(12, 'Crossover')).toBe(10)
  })
  it('não reconhecido segue em 0,5 kg', () => expect(arred(20.3, 'Flexão de Braço')).toBe(20.5))
})
