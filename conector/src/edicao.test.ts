import { describe, expect, it } from 'vitest'
import { entradaPrescricaoSchema } from './prescricao'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { aplicarAdicao, removerGrupo } from '../../src/features/coach/meso/util'
import { aplicarAlteracoes } from './edicao'

describe('edição completa pelo MCP', () => {
  it('aceita adição do editor que muda de posição entre semanas', () => {
    let m = mesoPadrao()
    m.adicoes = aplicarAdicao(m, 1, 1, 2, { slotId: 'a', nome: 'Supino Reto Barra' })
    m.adicoes = aplicarAdicao(m, 1, 1, 2, { slotId: 'b', nome: 'Remada Curvada com Barra' })
    m = { ...m, ...removerGrupo(m, { tipo: 'adicao', t: 1, p: 0, slot: { slotId: 'a', nome: 'Supino Reto Barra' }, de: 2, ate: 2 }) }
    expect(entradaPrescricaoSchema.safeParse({ acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: m }).success).toBe(true)
  })
  it('adiciona com referências locais, prescreve e combina método no mesmo lote', () => {
    const r = aplicarAlteracoes(mesoPadrao(), [
      { tipo: 'adicionar', treino: 1, nome: 'Supino Reto Barra', referencia: 'novo1' },
      { tipo: 'adicionar', treino: 1, nome: 'Remada Curvada com Barra', referencia: 'novo2' },
      { tipo: 'prescricao', slotId: 'novo1', semanas: [1], reps: [12, 10] },
      { tipo: 'metodo', slotIds: ['novo1', 'novo2'], semanas: [1], metodo: 'Biset' },
    ])
    expect(r.divisao[0]).toHaveLength(2)
    expect(r.progressaoExercicio?.[r.divisao[0][0].slotId][0]).toEqual([12, 10])
    expect(r.metodos).toHaveLength(2)
    expect(r.metodos[0].grupo).toBe(r.metodos[1].grupo)
  })
  it('não modifica a entrada quando uma operação do lote falha', () => {
    const m = mesoPadrao(), antes = structuredClone(m)
    expect(() => aplicarAlteracoes(m, [{ tipo: 'adicionar', treino: 1, nome: 'Supino Reto Barra' }, { tipo: 'remover', slotId: 'inexistente' }])).toThrow()
    expect(m).toEqual(antes)
  })
  it('recusa séries vazias no meio da prescrição', () => {
    expect(entradaPrescricaoSchema.safeParse({ acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', alteracoes: [{ tipo: 'prescricao', slotId: 'sup', semanas: [1], reps: [10, null, 20] }] }).success).toBe(false)
  })
  it('reordena e substitui sem reaproveitar a identidade nem perder a progressão', () => {
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'a', nome: 'Supino Reto Barra' }, { slotId: 'b', nome: 'Remada Curvada com Barra' }], [], []], progressaoExercicio: { a: [[12], [12], [12], [12]] } }
    const r = aplicarAlteracoes(base, [{ tipo: 'mover', slotId: 'a' }, { tipo: 'substituir', slotId: 'a', nome: 'Supino Reto Halter' }])
    expect(r.divisao[0].map((s) => s.nome)).toEqual(['Remada Curvada com Barra', 'Supino Reto Halter'])
    expect(r.divisao[0][1].slotId).not.toBe('a')
    expect(r.progressaoExercicio?.[r.divisao[0][1].slotId]).toEqual([[12], [12], [12], [12]])
  })
  it('configura ciclo futuro e permite aplicar/remover Dropset em todas as séries', () => {
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'a', nome: 'Supino Reto Barra' }], [], []] }
    const r = aplicarAlteracoes(base, [{ tipo: 'configurar', semanas: 6, frequencia: 2, dias: [1, 4], inicio: '2027-01-04' }, { tipo: 'metodo', slotIds: ['a'], semanas: [1], metodo: 'Dropset', escopo: 'Todas as séries' }])
    expect(r.semanas).toBe(6)
    expect(r.progressao.auxiliares).toHaveLength(6)
    expect(r.metodos[0]).not.toHaveProperty('serie')
    expect(aplicarAlteracoes(r, [{ tipo: 'metodo', slotIds: ['a'], semanas: [1], metodo: 'Dropset', remover: true }]).metodos).toHaveLength(0)
  })
})
