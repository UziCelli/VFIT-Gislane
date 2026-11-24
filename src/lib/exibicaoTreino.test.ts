import { describe, expect, it } from 'vitest'
import { prescreverSessao, type Meso } from '../engine'
import { ordemExibicao } from './exibicaoTreino'

const meso = (metodos: Meso['metodos']): Meso => ({
  frequencia: 1, semanas: 1, inicio: '2026-11-02', pausaS: 60,
  divisao: [['A', 'B', 'C', 'D'].map((n) => ({ slotId: n, nome: n }))],
  progressao: { principais: [[10, 10, 10]], auxiliares: [[12, 12]] },
  metodos,
})
const biset = (exercicio: number) => ({ ativo: true, semana: 1, treino: 1, exercicio, metodo: 'Biset' as const, escopo: 'Todas as séries' as const, pausaInternaS: 15, blocos: 1, grupo: 1 })
const ver = (m: Meso) => ordemExibicao(m, 1, 1, prescreverSessao(m, 1, 1)!)

describe('ordemExibicao (prévia do aluno)', () => {
  it('sem método mantém a ordem da divisão', () => {
    expect(ver(meso([])).map((i) => [i.e.slot.nome, i.grupo])).toEqual([['A', null], ['B', null], ['C', null], ['D', null]])
  })
  it('junta o biset e numera A1/A2', () => {
    const r = ver(meso([biset(1), biset(3)]))
    expect(r.map((i) => i.e.slot.nome)).toEqual(['A', 'C', 'B', 'D'])
    expect(r.slice(0, 2).map((i) => [i.letra, i.ordem, i.tamanho])).toEqual([['A', 0, 2], ['A', 1, 2]])
  })
  it('grupo de um exercício só não é grupo', () => {
    expect(ver(meso([biset(2)])).every((i) => i.grupo == null)).toBe(true)
  })
})
