import { describe, expect, it } from 'vitest'
import { esqueletoTreino } from './esqueletoTreino'

describe('esqueletoTreino', () => {
  it('sem dias por semana: sem sugestão', () => expect(esqueletoTreino({})).toBeNull())
  it('iniciante 3 dias: corpo inteiro, piso do volume, longe da falha', () => {
    const e = esqueletoTreino({ diasSemana: 3, experiencia: 'nunca', minutos: 'mais60' })!
    expect(e.divisao).toMatch(/Corpo inteiro/)
    expect(e.dias).toHaveLength(3)
    expect(e.seriesSemana.peito).toBe(6)
    expect(e.rir).toMatch(/3 a 4/)
  })
  it('avançado 6 dias: PPL e prioridade no topo da faixa', () => {
    const e = esqueletoTreino({ diasSemana: 6, experiencia: 'mais2a', tempoParado: 'treinando', prioridades: ['gluteos'], minutos: 'mais60' })!
    expect(e.divisao).toMatch(/Empurrar/)
    expect(e.seriesSemana.gluteos).toBeGreaterThan(e.seriesSemana.peito)
  })
  it('cabe no tempo do treino', () => {
    const e = esqueletoTreino({ diasSemana: 2, experiencia: 'mais2a', minutos: 'ate30' })!
    for (const d of e.dias) expect(d.grupos.reduce((s, x) => s + x.series, 0)).toBeLessThanOrEqual(10)
  })
  it('sinais ao esforço e dor viram cuidados', () => {
    const e = esqueletoTreino({ diasSemana: 3, sintomasEsforco: ['faltaAr'], dores: ['ombro'], dorPiora: ['acimaCabeca'] })!
    expect(e.cuidados[0]).toMatch(/liberação médica/)
    expect(e.cuidados.join(' ')).toMatch(/acima da cabeça/)
  })
})
