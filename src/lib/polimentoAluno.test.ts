import { describe, expect, it } from 'vitest'
import { prescreverSessao, type Meso } from '../engine'
import { escopoPolimento, mudancasPolimento, resumoPolimento, semanaDePolimento } from './polimentoAluno'

const l = [10, 10, 10, 10]
const base: Meso = {
  semanas: 4, inicio: '2026-10-01', frequencia: 2, pausaS: 90, metodos: [],
  divisao: [
    [{ slotId: 'sup', nome: 'Supino Reto Barra' }, { slotId: 'rem', nome: 'Remada Baixa' }],
    [{ slotId: 'agach', nome: 'Agachamento Livre' }],
  ],
  progressao: { principais: [l, l, l, l], auxiliares: [l, l, l, l] },
}
const comPol = (polimentos: Meso['polimentos']): Meso => ({ ...base, polimentos })

describe('polimento na tela do aluno', () => {
  it('diz em poucas palavras o que muda no exercício, comparando com a prescrição normal', () => {
    const meso = comPol({ '4-1': { sup: { nome: 'Supino Reto Barra', reps: [8, 8, 8], degraus: 1, folga: 2 } } })
    const s = prescreverSessao(meso, 4, 1)!
    const n = prescreverSessao(base, 4, 1)!
    expect(mudancasPolimento(s.exercicios[0], n.exercicios[0])).toEqual(['3 séries (eram 4)', 'carga mais leve', 'pare com 2 repetições de sobra'])
    expect(mudancasPolimento(s.exercicios[1], n.exercicios[1])).toBeNull()
    // Sem a prescrição normal (ex.: cópia registrada diferente), não inventa a contagem de séries.
    expect(mudancasPolimento(s.exercicios[0])).toEqual(['carga mais leve', 'pare com 2 repetições de sobra'])
  })

  it('mesmas séries com menos reps viram "menos repetições"', () => {
    const meso = comPol({ '4-1': { sup: { nome: 'Supino Reto Barra', reps: [8, 8, 8, 8], degraus: 0 } } })
    const s = prescreverSessao(meso, 4, 1)!
    expect(mudancasPolimento(s.exercicios[0], prescreverSessao(base, 4, 1)!.exercicios[0])).toEqual(['menos repetições'])
  })

  it('aviso no topo só quando metade ou mais do treino está em polimento; semana quando todos os treinos estão', () => {
    const um = comPol({ '4-1': { sup: { nome: 'Supino Reto Barra', reps: [8, 8, 8], degraus: 0 } } })
    expect(escopoPolimento(prescreverSessao(um, 4, 1))).toBe('dia')
    expect(escopoPolimento(prescreverSessao(um, 4, 2))).toBeNull()
    expect(semanaDePolimento(um, 4)).toBe(false)
    const todos = comPol({
      '4-1': { sup: { nome: 'Supino Reto Barra', reps: [8, 8, 8], degraus: 1 } },
      '4-2': { agach: { nome: 'Agachamento Livre', reps: [8, 8, 8], degraus: 0 } },
    })
    expect(semanaDePolimento(todos, 4)).toBe(true)
    expect(resumoPolimento(prescreverSessao(todos, 4, 1)!)).toBe('menos volume · carga mais leve')
    const tres: Meso = { ...um, divisao: [[...base.divisao[0], { slotId: 'tri', nome: 'Tríceps Corda' }], base.divisao[1]] }
    expect(escopoPolimento(prescreverSessao(tres, 4, 1))).toBe('exercicio')
  })
})
