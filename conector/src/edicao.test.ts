import { describe, expect, it } from 'vitest'
import { entradaPrescricaoSchema } from './prescricao'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { aplicarAdicao, removerGrupo } from '../../src/features/coach/meso/util'
import { aplicarAlteracoes } from './edicao'
import { linhaPrescrita, prescreverSessao } from '../../src/engine/sessao'

describe('edição completa pelo MCP', () => {
  it('preserva contagens do método numa troca semanal cujo exercício não foi substituído', () => {
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []], trocas: { '1-1-1': { slotId: 'rem', nome: 'Remada Curvada com Barra' } }, metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Clusterset' as const, escopo: 'Todas as séries' as const, repsPorBloco: 4 }] }
    const r = aplicarAlteracoes(base, [{ tipo: 'substituir', slotId: 'sup', nome: 'Prancha Frontal Isométrica (cotovelos)' }])
    expect(r.metodos).toEqual(base.metodos)
    expect(prescreverSessao(r, 1, 1)!.exercicios[0]).toMatchObject({ slot: { slotId: 'rem' }, reps: [4, 4, 4] })
  })
  it.each([
    ['Supino Reto Barra', 'Prancha Frontal Isométrica (cotovelos)'],
    ['Prancha Frontal Isométrica (cotovelos)', 'Supino Reto Barra'],
  ])('reinicia também contagens dos métodos ao mudar de %s para %s', (de, para) => {
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'a', nome: de }], [], []], metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Clusterset' as const, escopo: 'Todas as séries' as const, repsPorBloco: 4, repsPadrao: 4, repsEtapa: [4], adicional: 4, pausaInternaS: 20, blocos: 3 }] }
    const r = aplicarAlteracoes(base, [{ tipo: 'substituir', slotId: 'a', nome: para }])
    const ex = prescreverSessao(r, 1, 1)!.exercicios[0]
    expect(ex.reps).toEqual(ex.repsBase)
    expect(r.metodos[0]).toEqual({ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Clusterset', escopo: 'Todas as séries', pausaInternaS: 20, blocos: 3 })
  })
  it('substituir tira a máquina do exercício antigo; prescrição mantém', () => {
    const maquina = { ref: 'mq-aaaaaaaaaaaaaaaaaaa1', nome: 'Extensora', tipo: 'maquina' as const, unidade: 'nivel' as const, niveis: 12, porLado: false }
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'ext', nome: 'Cadeira Extensora Tradicional', maquina }], [], []] }
    expect(aplicarAlteracoes(base, [{ tipo: 'prescricao', slotId: 'ext', semanas: [1], reps: [12, 12] }]).divisao[0][0].maquina).toEqual(maquina)
    const r = aplicarAlteracoes(base, [{ tipo: 'substituir', slotId: 'ext', nome: 'Leg Press 45' }])
    expect(r.divisao[0][0]).toMatchObject({ nome: 'Leg Press 45' })
    expect(r.divisao[0][0]).not.toHaveProperty('maquina')
  })
  it('mantém referências no lote após substituir repetidamente um exercício', () => {
    const r = aplicarAlteracoes(mesoPadrao(), [
      { tipo: 'adicionar', treino: 1, nome: 'Supino Reto Barra', referencia: 'novo' },
      { tipo: 'substituir', slotId: 'novo', nome: 'Supino Reto Halter' },
      { tipo: 'substituir', slotId: 'novo', nome: 'Remada Curvada com Barra' },
      { tipo: 'prescricao', slotId: 'novo', semanas: [1], reps: [12, 10], pausaS: 90 },
      { tipo: 'metodo', slotIds: ['novo'], semanas: [1], metodo: 'Rest-pause' },
    ])
    expect(r.divisao[0][0]).toMatchObject({ nome: 'Remada Curvada com Barra', pausaS: 90 })
    expect(linhaPrescrita(r, 1, 1, 1)).toEqual([12, 10])
    expect(r.metodos[0].metodo).toBe('Rest-pause')
  })
  it('não converte segundos em repetições ao substituir e aceita o ID original nas operações seguintes', () => {
    const iso = { ...mesoPadrao(), divisao: [[{ slotId: 'iso', nome: 'Prancha Frontal Isométrica (cotovelos)' }], [], []], progressaoExercicio: { iso: Array.from({ length: 4 }, () => [45, 45, 45]) } }
    const dinamico = aplicarAlteracoes(iso, [{ tipo: 'substituir', slotId: 'iso', nome: 'Supino Reto Barra' }])
    expect(linhaPrescrita(dinamico, 1, 1, 1)).toEqual(iso.progressao.principais[0])
    const r = aplicarAlteracoes(iso, [{ tipo: 'substituir', slotId: 'iso', nome: 'Supino Reto Barra' }, { tipo: 'prescricao', slotId: 'iso', semanas: [1], reps: [12, 12] }])
    expect(linhaPrescrita(r, 1, 1, 1)).toEqual([12, 12])
  })
  it('inicializa segundos ao substituir um dinâmico e ao estender a duração', () => {
    const base = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []], progressaoExercicio: { sup: Array.from({ length: 4 }, () => [12, 12]) } }
    const r = aplicarAlteracoes(base, [{ tipo: 'substituir', slotId: 'sup', nome: 'Prancha Frontal Isométrica (cotovelos)' }, { tipo: 'configurar', semanas: 5 }])
    expect(linhaPrescrita(r, 1, 1, 1)).toEqual([30, 30, 30, null, null, null])
    expect(linhaPrescrita(r, 5, 1, 1)).toEqual([30, 30, 30, null, null, null])
  })
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
