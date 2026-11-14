import { describe, expect, it } from 'vitest'
import { iniciarEdicao, prescreverSessao, trocarExercicio, type Meso } from '../../../engine'
import { docParaMeso, mesoParaDoc } from '../../../lib/conversores'
import { moverExercicio, removerExercicio } from './util'

const base = (): Meso => ({
  frequencia: 1, semanas: 2, inicio: '2026-11-01', pausaS: 60,
  divisao: [[{ slotId: 'A', nome: 'A' }, { slotId: 'B', nome: 'B' }, { slotId: 'C', nome: 'C' }]],
  progressao: { principais: [[10, 10], [9, 9]], auxiliares: [[12], [11]] },
  progressaoExercicio: { '1-2': [[8, 8, 8], [7, 7, 7]] },
  metodos: [],
})
const reps = (m: Meso, w = 1) => prescreverSessao(m, w, 1)!.exercicios.map((e) => e.reps)

describe('ordem da divisão e sessões presenciais', () => {
  it.each([1, 2, 3])('excluir posição %i mantém a prescrição das sessões legadas e não as grava', (p) => {
    const m = base()
    m.sessoes = { '1-1': { semana: 1, treino: 1, exercicios: m.divisao[0].map((s, i) => ({ ...s, de: i + 1 })), metodos: [] } }
    const antes = reps(m)
    const patch = removerExercicio(m, 1, p)
    expect(patch).not.toHaveProperty('sessoes')
    expect(m.divisao[0]).toHaveLength(3)
    const depois = { ...m, ...patch }
    expect(depois.sessoes).toBe(m.sessoes)
    expect(reps(depois)).toEqual(antes)
    const doc = mesoParaDoc(depois)
    expect(doc).not.toHaveProperty('sessoes')
    expect(reps(docParaMeso({ ...doc, sessoes: m.sessoes }))).toEqual(antes)
  })

  it('troca presencial nova segue sua origem após mover e depois excluir, mesmo chegando depois do save do editor', () => {
    const m = base()
    const s = trocarExercicio(iniciarEdicao(m, 2, 1), 2, 'Presencial', 'novo')
    expect(s.exercicios[1]).toMatchObject({ origemSlotId: 'B' })
    let plano = { ...m, ...moverExercicio(m, 1, 2, 3) }
    expect(reps({ ...plano, sessoes: { '2-1': s } }, 2)[1]).toEqual([7, 7, 7])
    plano = { ...plano, ...removerExercicio(plano, 1, 3) }
    expect(reps({ ...plano, sessoes: { '2-1': s } }, 2)[1]).toEqual([7, 7, 7])
  })

  it('preserva troca semanal e troca presencial legada conhecida ao excluir sua origem', () => {
    const m = base()
    m.trocas = { '1-1-2': { slotId: 'troca', nome: 'Troca' } }
    m.sessoes = {
      '1-1': { semana: 1, treino: 1, exercicios: [{ ...m.trocas['1-1-2'], de: 2 }], metodos: [] },
      '2-1': { semana: 2, treino: 1, exercicios: [{ slotId: 'antigo', nome: 'Antigo', de: 2 }], metodos: [] },
    }
    const novo = { ...m, ...removerExercicio(m, 1, 2) }
    expect(reps(novo)).toEqual([[8, 8, 8]])
    expect(reps(novo, 2)).toEqual([[7, 7, 7]])
  })

  it('origem presente continua acompanhando ajustes de volume; adições não ganham origem', () => {
    const m = base()
    m.adicoes = { '1-1': [{ slotId: 'add', nome: 'Novo' }] }
    const s = iniciarEdicao(m, 1, 1)
    expect(s.exercicios.at(-1)).not.toHaveProperty('origemSlotId')
    const novo = { ...m, progressaoExercicio: { B: [[5]] }, sessoes: { '1-1': s } }
    expect(reps(novo)[1]).toEqual([5])
  })

  it.each([
    ['Prancha Frontal Isométrica (cotovelos)', 'Dinâmico', [12]],
    ['Dinâmico', 'Prancha Frontal Isométrica (cotovelos)', [30, 30, 30]],
  ])('troca %s → %s mantém a unidade após exclusão concorrente', (origem, destino, esperado) => {
    const m = base()
    m.divisao[0][1] = { slotId: 'B', nome: origem }
    m.progressaoExercicio = { B: [[40, 40], [35, 35]] }
    const s = trocarExercicio(iniciarEdicao(m, 1, 1), 2, destino, 'novo')
    const depois = { ...m, ...removerExercicio(m, 1, 2), sessoes: { '1-1': s } }
    expect(reps(depois)[1]).toEqual(esperado)
  })

  it('troca semanal isométrica arquivada não herda repetições dinâmicas', () => {
    const m = base()
    m.trocas = { '1-1-2': { slotId: 'iso', nome: 'Prancha Frontal Isométrica (cotovelos)' } }
    m.sessoes = { '1-1': { semana: 1, treino: 1, exercicios: [{ ...m.trocas['1-1-2'], de: 2 }], metodos: [] } }
    const antes = reps(m)
    const depois = { ...m, ...removerExercicio(m, 1, 2) }
    expect(reps(depois)).toEqual(antes)
    expect(reps(depois)).toEqual([[30, 30, 30]])
  })

  it('não sobrescreve a progressão de slot legado já encontrado em outra posição', () => {
    const m = base()
    m.progressaoExercicio = { B: [[8]], C: [[6]] }
    m.sessoes = { '1-1': { semana: 1, treino: 1, exercicios: [{ slotId: 'C', nome: 'C', de: 2 }], metodos: [] } }
    const depois = { ...m, ...removerExercicio(m, 1, 2) }
    expect(reps(depois)).toEqual([[6]])
  })


  it('excluir outra origem depois não reatribui um alias presencial legado já arquivado', () => {
    const m = base()
    m.sessoes = { '1-1': { semana: 1, treino: 1, exercicios: [{ slotId: 'antigo', nome: 'Antigo', de: 2 }], metodos: [] } }
    const primeira = { ...m, ...removerExercicio(m, 1, 2) }
    const segunda = { ...primeira, ...removerExercicio(primeira, 1, 2) }
    expect(reps(segunda)).toEqual([[8, 8, 8]])
  })

})
