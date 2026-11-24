import { describe, expect, it } from 'vitest'
import { areaMuscularBraco, areaMuscularCoxa, massaMuscularLee, perimetroCorrigido } from './areaMuscular'

describe('área muscular (antropometria)', () => {
  it('perímetro corrigido tira π × dobra (mm → cm)', () => {
    expect(perimetroCorrigido(32, 10)).toBeCloseTo(32 - Math.PI, 6)
  })
  it('braço (Heymsfield 1982): desconta o osso por sexo', () => {
    const pc = 32 - Math.PI
    expect(areaMuscularBraco(32, 10, 'M')).toBeCloseTo((pc * pc) / (4 * Math.PI) - 10, 1)
    expect(areaMuscularBraco(32, 10, 'F')).toBeCloseTo((pc * pc) / (4 * Math.PI) - 6.5, 1)
    expect(areaMuscularBraco(5, 30, 'M')).toBeNull()
  })
  it('coxa: círculo do perímetro corrigido', () => {
    expect(areaMuscularCoxa(56, 15)).toBeCloseTo(209.4, 0)
  })
  it('massa muscular (Lee 2000): valor plausível e só com IMC abaixo de 30', () => {
    const base = { alturaCm: 180, pesoKg: 80, sexo: 'M' as const, idade: 30, braco: 32, coxa: 56, panturrilha: 38, triceps: 10, coxaDobra: 15, panturrilhaDobra: 10 }
    expect(massaMuscularLee(base)).toBeCloseTo(33.7, 0)
    expect(massaMuscularLee({ ...base, pesoKg: 100 })).toBeNull()
  })
})

describe('massa muscular entre avaliações', () => {
  it('usa só os lados medidos nas duas: acrescentar o braço esquerdo não muda a estimativa', async () => {
    const { musculoEstimado } = await import('./avaliacao')
    const base = { alunoId: 'u', pesoKg: 80, alturaCm: 180, sexo: 'M' as const, idade: 30, bio: {}, comentario: '', liberado: false, dobras: { triceps: 10, coxa: 15, panturrilha: 10 } }
    const ant = { ...base, id: 'a', data: '2026-01-01', perimetros: { bracoD: 32, coxaD: 56, panturrilhaD: 38 } }
    const atual = { ...base, id: 'b', data: '2026-02-01', perimetros: { bracoD: 32, bracoE: 36, coxaD: 56, panturrilhaD: 38 } }
    const l = musculoEstimado(atual, ant).find((x) => x.rotulo === 'Massa muscular do corpo')!
    expect(l.delta).toBe(0)
  })
})
