import { describe, expect, it } from 'vitest'
import type { Meso, Slot } from '../engine'
import { pontosRm, rirMedio, tendenciaRm } from './rmEvolucao'

const slot = (slotId: string, nome: string): Slot => ({ slotId, nome })
const meso = (slots: Slot[], semanas = 6): Meso => ({
  frequencia: 1, semanas, inicio: '2026-01-05', pausaS: 60,
  divisao: [slots],
  progressao: { principais: Array.from({ length: semanas }, () => [10, 10, 10]), auxiliares: Array.from({ length: semanas }, () => [10, 10, 10]) },
  metodos: [],
})
const reg = (semana: number, cargas: Record<string, Record<string, number | null>>, extra = {}) => ({ mesoId: 'm1', semana, treino: 1, cargas, ...extra })

describe('pontosRm', () => {
  const m = meso([slot('a', 'Supino')])
  it('um ponto por treino: o maior 1RM implícito das séries (10 reps: 60 kg ≈ 75,4 kg)', () => {
    const p = pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60, s2: 60, s3: 58 } })], 'Supino')
    expect(p).toHaveLength(1)
    expect(p[0].rm!).toBeCloseTo(75.4, 1)
  })
  it('600 no lugar de 60 não vira 1RM absurdo', () => {
    const p = pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60, s2: 60, s3: 600 } })], 'Supino')
    expect(p[0].rm!).toBeCloseTo(75.4, 1)
  })
  it('exercício diferente, sem carga, isometria ou peso do corpo: sem ponto', () => {
    expect(pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60 } })], 'Remada')).toEqual([])
    expect(pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: {} })], 'Supino')).toEqual([])
    const iso = meso([slot('b', 'Dead Bug Isométrico')])
    expect(pontosRm([{ id: 'm1', meso: iso }], [reg(1, { b: { s1: 30, s2: 30, s3: 30 } })], 'Dead Bug Isométrico')).toEqual([])
    expect(pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60 } }, { pc: { a: 70 } })], 'Supino')).toEqual([])
  })
  it('a resposta de esforço vale mesmo sem 1RM estimável (acima de 15 reps, peso do corpo)', () => {
    const m20 = meso([slot('a', 'Supino')])
    m20.progressao = { principais: Array.from({ length: 6 }, () => [20, 20, 20]), auxiliares: Array.from({ length: 6 }, () => [20, 20, 20]) }
    const alto = pontosRm([{ id: 'm1', meso: m20 }], [reg(1, { a: { s1: 30, s2: 30, s3: 30 } }, { rir: { a: { s3: 2 } } })], 'Supino')
    expect(alto).toEqual([{ mesoId: 'm1', semana: 1, treino: 1, rm: null, rir: 2 }])
    const comCorpo = pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60 } }, { pc: { a: 70 }, rir: { a: { s3: 1 } } })], 'Supino')
    expect(comCorpo).toEqual([{ mesoId: 'm1', semana: 1, treino: 1, rm: null, rir: 1 }])
  })
  it('esforço médio considera treinos sem 1RM', () => {
    const ps = [
      { mesoId: 'm', semana: 1, treino: 1, rm: 70, rir: 3 },
      { mesoId: 'm', semana: 2, treino: 1, rm: null, rir: 1 },
    ]
    expect(rirMedio(ps)).toEqual({ media: 2, respostas: 2 })
  })
  it('traz a resposta de "quantas ainda faria" da última série normal', () => {
    const p = pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60, s2: 60, s3: 60 } }, { rir: { a: { s1: 3, s3: 1 } } })], 'Supino')
    expect(p[0].rir).toBe(1)
    expect(pontosRm([{ id: 'm1', meso: m }], [reg(1, { a: { s1: 60 } })], 'Supino')[0].rir).toBeNull()
  })
  it('ordena por semana e junta mesos', () => {
    const p = pontosRm([{ id: 'm1', meso: m }], [reg(3, { a: { s1: 62 } }), reg(1, { a: { s1: 60 } })], 'Supino')
    expect(p.map((x) => x.semana)).toEqual([1, 3])
  })
})

describe('tendenciaRm', () => {
  it('menos de 3 treinos: não opina', () => {
    expect(tendenciaRm([70, 72])).toBeNull()
  })
  it('subindo, estável e caindo (tolerância de 2%)', () => {
    expect(tendenciaRm([70, 70, 70, 74, 75])!.sentido).toBe('subindo')
    expect(tendenciaRm([70, 70.5, 70, 70.4, 70.2])!.sentido).toBe('estavel')
    expect(tendenciaRm([75, 75, 74, 70, 69])!.sentido).toBe('caindo')
  })
  it('olha só os 6 últimos treinos', () => {
    expect(tendenciaRm([10, 10, 10, 70, 70, 70, 70, 70, 70])!.sentido).toBe('estavel')
  })
})

describe('rirMedio', () => {
  it('média das últimas 5 respostas; sem resposta, null', () => {
    expect(rirMedio([{ mesoId: 'm', semana: 1, treino: 1, rm: 70, rir: null }])).toBeNull()
    const ps = [0, 1, 2, 3, 3, 3].map((rir, i) => ({ mesoId: 'm', semana: i + 1, treino: 1, rm: 70, rir }))
    expect(rirMedio(ps)).toEqual({ media: 2.4, respostas: 5 })
  })
})
