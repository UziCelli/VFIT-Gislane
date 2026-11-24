import { describe, expect, it } from 'vitest'
import type { Meso, Slot } from '../engine'
import { chaveModelo, modelosPorExercicio } from './rmPessoal'
import { cargaAnterior } from './treino'

const slot = (slotId: string, nome: string, extra: Partial<Slot> = {}): Slot => ({ slotId, nome, ...extra })
const meso = (slots: Slot[], reps: number[][] = [[10, 10, 10], [10, 10, 10], [8, 8, 8]], semanas = 3): Meso => ({
  frequencia: 1, semanas, inicio: '2026-01-05', pausaS: 60,
  divisao: [slots],
  progressao: { principais: reps, auxiliares: reps },
  metodos: [],
})
const fonte = (m: Meso, registros: Record<string, Record<string, (number | null)[]>>, reps = {}) => ({ meso: m, registros, reps })

describe('modelosPorExercicio', () => {
  it('um modelo por exercício com séries válidas; só o que veio antes de hoje', () => {
    const m = meso([slot('a', 'Supino')])
    const mods = modelosPorExercicio(fonte(m, { '1-1': { a: [60, 60, 60] }, '2-1': { a: [62, 62, 62] }, '3-1': { a: [200, 200, 200] } }), { semana: 3, treino: 1 })
    expect(mods.size).toBe(1)
    expect(mods.has(chaveModelo('supino', false, false))).toBe(true)
    // semana 3 (hoje) ficou de fora: o modelo não enxerga o 200
    const m2 = modelosPorExercicio(fonte(m, { '1-1': { a: [60, 60, 60] }, '2-1': { a: [62, 62, 62] }, '3-1': { a: [200, 200, 200] } }), { semana: 3, treino: 1 })
    expect(m2.get(chaveModelo('Supino', false, false))!.sessoes).toBe(2)
  })
  it('2 lados entra pela média por lado (só célula nova), com chave própria', () => {
    const m = meso([slot('a', 'Rosca', { doisLados: true })])
    const f = { ...fonte(m, { '1-1': { a: [20, 20, 20] }, '2-1': { a: [22, 22, 22] } }), lados: { '1-1': { a: [10, 10, 10] } } }
    const mods = modelosPorExercicio(f, { semana: 3, treino: 1 })
    expect(mods.get(chaveModelo('Rosca', true, false))!.sessoes).toBe(1) // a semana 2 é antiga (sem lados): fica de fora
    expect(mods.has(chaveModelo('Rosca', false, false))).toBe(false)
  })
  it('2 lados com célula antiga no registro: o modelo não preenche essa série', () => {
    const m = meso([slot('a', 'Rosca', { doisLados: true })], [[10, 10, 10], [10, 10, 10], [8, 8, 8]])
    const regs = { '1-1': { a: [40, 40, 40] }, '2-1': { a: [40, 80, 40] } }
    const lados = { '1-1': { a: [20, 20, 20] }, '2-1': { a: [20, null, 20] } }
    const mods = modelosPorExercicio({ ...fonte(m, regs), lados }, { semana: 3, treino: 1 })
    const r = cargaAnterior(m, regs, 3, 1, 1, undefined, lados, {}, { modelos: mods })
    expect(r!.series[1]).toBeNull()
    expect(r!.dir!.series[1]).toBeNull()
    expect(r!.series[0]).not.toBeNull()
  })
  it('fora do modelo: 2 lados antigo, isometria, peso do corpo (pc) e série sem carga', () => {
    const m = meso([slot('a', 'Rosca', { doisLados: true }), slot('b', 'Dead Bug Isométrico'), slot('c', 'Supino')])
    const mods = modelosPorExercicio({ ...fonte(m, { '1-1': { a: [10, 10, 10], b: [30, 30, 30], c: [null, null, null] } }), pcs: {} }, { semana: 2, treino: 1 })
    expect(mods.size).toBe(0)
    const comPc = modelosPorExercicio({ ...fonte(meso([slot('c', 'Supino')]), { '1-1': { c: [60, 60, 60] } }), pcs: { '1-1': { c: 70 } } }, { semana: 2, treino: 1 })
    expect(comPc.size).toBe(0)
  })
  it('usa o meso anterior (pelo nome) deslocado no tempo', () => {
    const atual = meso([slot('a', 'Supino')])
    const ant = fonte({ ...meso([slot('x', 'supino')]), inicio: '2025-11-03' }, { '1-1': { x: [50, 50, 50] }, '2-1': { x: [52, 52, 52] } })
    const mods = modelosPorExercicio(fonte(atual, {}), { semana: 1, treino: 1 }, ant)
    expect(mods.get(chaveModelo('Supino', false, false))!.sessoes).toBe(2)
  })
})

describe('cargaAnterior com o modelo pessoal', () => {
  const m = meso([slot('a', 'Supino')], [[10, 10, 10], [10, 10, 10], [8, 8, 8]])
  const regs = { '1-1': { a: [60, 60, 60] }, '2-1': { a: [60, 60, 60] } }
  const modelos = modelosPorExercicio(fonte(m, regs), { semana: 3, treino: 1 })

  it('reps de hoje diferentes: usa o modelo e marca como estimada', () => {
    const r = cargaAnterior(m, regs, 3, 1, 1, undefined, undefined, {}, { modelos })
    expect(r).toMatchObject({ estimada: true })
    expect(r!.series.every((x) => x != null && x > 60 && x < 70)).toBe(true) // 8 reps pedem mais que 10 reps (~63)
  })
  it('reps iguais ficam como foram anotadas, mesmo com modelo', () => {
    const r = cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, {}, { modelos: modelosPorExercicio(fonte(m, regs), { semana: 2, treino: 1 }) })
    expect(r).toMatchObject({ series: [60, 60, 60], estimada: false })
  })
  it('sem modelo para o exercício, cai na tabela (comportamento anterior)', () => {
    const a = cargaAnterior(m, regs, 3, 1, 1, undefined, undefined, {}, { modelos: new Map() })
    const b = cargaAnterior(m, regs, 3, 1, 1, undefined, undefined, {})
    expect(a).toEqual(b)
  })
  it('série que o aluno não anotou recebe sugestão do modelo', () => {
    const reg2 = { '1-1': { a: [60, null, null] }, '2-1': { a: [60, 60, 60] } }
    const mods = modelosPorExercicio(fonte(m, reg2), { semana: 3, treino: 1 })
    const r = cargaAnterior(m, reg2, 3, 1, 1, undefined, undefined, {}, { modelos: mods })
    expect(r!.series.every((x) => x != null)).toBe(true)
  })
  it('chave desligada (sem repsFeitas): o modelo é ignorado', () => {
    expect(cargaAnterior(m, regs, 3, 1, 1, undefined, undefined, undefined, { modelos })).toMatchObject({ series: [60, 60, 60], estimada: false })
  })
  it('registro de origem com mais de 15 reps: mantém a carga anotada, mesmo com modelo de dados antigos', () => {
    const m3 = meso([slot('a', 'Supino')], [[10, 10, 10], [10, 10, 10], [8, 8, 8]])
    const r3 = { '1-1': { a: [60, 60, 60] }, '2-1': { a: [30, 30, 30] } }
    const reps3 = { '2-1': { a: [20, 20, 20] } }
    const mods = modelosPorExercicio({ ...fonte(m3, r3, reps3) }, { semana: 3, treino: 1 })
    const r = cargaAnterior(m3, r3, 3, 1, 1, undefined, undefined, reps3, { modelos: mods })
    expect(r).toMatchObject({ series: [30, 30, 30] })
  })
  it('registro de origem com 0 repetições: mantém a carga anotada, mesmo com modelo', () => {
    const m3 = meso([slot('a', 'Supino')], [[10, 10, 10], [10, 10, 10], [8, 8, 8]])
    const r3 = { '1-1': { a: [60, 60, 60] }, '2-1': { a: [30, 30, 30] } }
    const reps3 = { '2-1': { a: [0, 0, 0] } }
    const mods = modelosPorExercicio({ ...fonte(m3, r3, reps3) }, { semana: 3, treino: 1 })
    const r = cargaAnterior(m3, r3, 3, 1, 1, undefined, undefined, reps3, { modelos: mods })
    expect(r).toMatchObject({ series: [30, 30, 30] })
  })
})
