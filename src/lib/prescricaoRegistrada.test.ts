import { describe, expect, it } from 'vitest'
import { mesoPadrao } from '../features/coach/meso/mesoPadrao'
import { prescreverSessao, metodosDaSessao } from '../engine/sessao'
import { mesoParaDoc, docParaMeso } from './conversores'
import { comPrescricoesRegistradas, lerPrescricaoRegistrada } from './prescricaoRegistrada'
import { iniciarEdicao, adicionarMetodo, removerMetodo } from '../engine/editarSessao'

it('valida o número de séries-base e continua lendo cópias antigas sem esse campo', () => {
  const m = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []] }
  const sessao = prescreverSessao(m, 1, 1)!
  const copia = { versao: 1, sessao, metodos: [] }
  const { repsBase: _base, ...antigo } = sessao.exercicios[0]
  expect(lerPrescricaoRegistrada(JSON.stringify({ ...copia, sessao: { ...sessao, exercicios: [antigo] } }))).not.toBeNull()
  expect(lerPrescricaoRegistrada(JSON.stringify({ ...copia, sessao: { ...sessao, exercicios: [{ ...antigo, repsBase: [10] }] } }))).toBeNull()
})

it('remover método no presencial restaura a base congelada, mesmo após mudança do plano', () => {
  const base = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []], progressaoExercicio: { sup: Array.from({ length: 4 }, () => [12, 12, 12]) }, metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Clusterset' as const, escopo: 'Todas as séries' as const, repsPorBloco: 4 }] }
  const sessao = prescreverSessao(base, 1, 1)!
  expect(sessao.exercicios[0].reps).toEqual([4, 4, 4])
  const texto = JSON.stringify({ versao: 1, sessao, metodos: base.metodos })
  const depois = comPrescricoesRegistradas({ ...base, progressaoExercicio: { sup: Array.from({ length: 4 }, () => [20]) } }, [{ semana: 1, treino: 1, prescricaoRegistrada: texto }])
  expect(depois.prescricoesRegistradas?.['1-1']?.sessao.exercicios[0].repsBase).toEqual([12, 12, 12])
  const editada = removerMetodo(iniciarEdicao(depois, 1, 1), 1, 'Clusterset')
  const r = prescreverSessao({ ...depois, sessoes: { '1-1': editada }, prescricoesRegistradas: { '1-1': null } }, 1, 1)!
  expect(r.exercicios[0].reps).toEqual([12, 12, 12])
})

it('mantém séries e exercícios de uma sessão que sincronizou depois da mudança do plano', () => {
  const antes = { ...mesoPadrao(), divisao: [[{ slotId: 'face', nome: 'Facepull' }], [], []] }
  const sessao = prescreverSessao(antes, 1, 1)!
  const prescricaoRegistrada = JSON.stringify({ versao: 1, sessao, metodos: metodosDaSessao(antes, 1, 1) })
  const depois = comPrescricoesRegistradas({ ...antes, divisao: [[], [], []] }, [{ semana: 1, treino: 1, prescricaoRegistrada }])
  expect(prescreverSessao(depois, 1, 1)).toEqual(sessao)
  expect(prescreverSessao(depois, 2, 1)?.exercicios).toHaveLength(0)
  expect(mesoParaDoc(depois)).not.toHaveProperty('prescricoesRegistradas')
  expect(docParaMeso({ ...mesoParaDoc(depois), prescricoesRegistradas: depois.prescricoesRegistradas }).prescricoesRegistradas).toEqual(depois.prescricoesRegistradas)
})

it.each(['{}', '{', 'x'.repeat(60001), JSON.stringify({ versao: 1, sessao: { exercicios: [{}] }, metodos: [] })])('ignora cópia malformada sem derrubar o treino', (valor) => {
  expect(lerPrescricaoRegistrada(valor)).toBeNull()
})

it('ajustar método no presencial mantém reps, quantidade e pausa da sessão congelada', () => {
  const base = { ...mesoPadrao(), pausaPrincipaisS: 180, divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []], progressaoExercicio: { sup: [[20, 18, 16], [20, 18, 16], [20, 18, 16], [20, 18, 16]] } }
  const sessao = prescreverSessao(base, 1, 1)!
  const congelado = { ...base, progressaoExercicio: { sup: [[5], [5], [5], [5]] }, prescricoesRegistradas: { '1-1': { versao: 1 as const, sessao, metodos: [] } } }
  const editada = adicionarMetodo(iniciarEdicao(congelado, 1, 1), 1, 'Rest-pause', 3)
  const resultado = prescreverSessao({ ...congelado, sessoes: { '1-1': editada }, prescricoesRegistradas: { '1-1': null } }, 1, 1)!
  expect(resultado.exercicios[0].reps).toEqual([20, 18, 16])
  expect(resultado.exercicios[0].pausaS).toBe(180)
})

it('mostra cargas de cliente antigo com referência anterior identificada como incerta', () => {
  const antes = { ...mesoPadrao(), divisao: [[{ slotId: 'face', nome: 'Facepull' }], [], []] }
  const copia = { versao: 1 as const, sessao: prescreverSessao(antes, 1, 1)!, metodos: [] }
  const depois = comPrescricoesRegistradas({ ...antes, divisao: [[], [], []], prescricoesAnteriores: { '1-1': [copia] } }, [{ semana: 1, treino: 1, cargas: { face: { s1: 20 } } }])
  expect(prescreverSessao(depois, 1, 1)?.exercicios[0].slot.nome).toBe('Facepull')
  expect(depois.historicoIncerto).toContain('1-1')
})

it('não restaura cópia antiga depois de ajuste presencial explícito', () => {
  const m = mesoPadrao(), sessao = prescreverSessao(m, 1, 1)!
  const r = comPrescricoesRegistradas({ ...m, prescricoesRegistradas: { '1-1': null } }, [{ semana: 1, treino: 1, prescricaoRegistrada: JSON.stringify({ versao: 1, sessao, metodos: [] }) }])
  expect(r.prescricoesRegistradas?.['1-1']).toBeNull()
})

it('recusa método malformado antes de renderizar a aprovação', () => {
  const m = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }], [], []] }
  const sessao = prescreverSessao(m, 1, 1)!
  const metodos = [{ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Dropset', escopo: 'Todas as séries', repsEtapa: 'texto' }]
  expect(lerPrescricaoRegistrada(JSON.stringify({ versao: 1, sessao, metodos }))).toBeNull()
})

// Caso real (Gislane, semana 9 / treino 1): a cópia congelada saiu com 0 série e escondia o plano certo.
describe('cópia congelada sem nenhuma série', () => {
  const plano = () => ({ ...mesoPadrao(), divisao: [[{ slotId: 'leg', nome: 'Leg Press 35' }, { slotId: 'stiff', nome: 'Stiff' }], [], []] })
  const vazia = (m: ReturnType<typeof plano>) => {
    const s = prescreverSessao(m, 1, 1)!
    return { versao: 1 as const, sessao: { ...s, series: 0, exercicios: s.exercicios.map((e) => ({ ...e, n: 0, reps: [], repsBase: [], cargaSugerida: [], drops: [] })) }, metodos: [] }
  }

  it('o motor ignora a cópia vazia e prescreve pelo plano', () => {
    const m = plano()
    const esperado = prescreverSessao(m, 1, 1)!
    expect(esperado.exercicios[0].n).toBeGreaterThan(0)
    const defeituoso = { ...m, prescricoesRegistradas: { '1-1': vazia(m) } }
    expect(prescreverSessao(defeituoso, 1, 1)).toEqual(esperado)
    expect(metodosDaSessao(defeituoso, 1, 1)).toEqual(metodosDaSessao(m, 1, 1))
    expect(iniciarEdicao(defeituoso, 1, 1).exercicios.map((e) => e.slotId)).toEqual(['leg', 'stiff'])
  })

  it('a cópia do registro vazia não é lida nem congela o treino', () => {
    const m = plano()
    const texto = JSON.stringify(vazia(m))
    expect(lerPrescricaoRegistrada(texto)).toBeNull()
    const depois = comPrescricoesRegistradas(m, [{ semana: 1, treino: 1, prescricaoRegistrada: texto }])
    expect(depois.prescricoesRegistradas?.['1-1']).toBeUndefined()
    expect(prescreverSessao(depois, 1, 1)).toEqual(prescreverSessao(m, 1, 1))
  })

  it('a cópia vazia que já está no documento do meso é descartada ao carregar', () => {
    const m = plano()
    const depois = comPrescricoesRegistradas({ ...m, prescricoesRegistradas: { '1-1': vazia(m) } }, [{ semana: 1, treino: 1 }])
    expect(depois.prescricoesRegistradas?.['1-1']).toBeUndefined()
    expect(prescreverSessao(depois, 1, 1)?.exercicios[0].n).toBeGreaterThan(0)
  })

  it('uma cópia válida continua valendo mesmo se o plano mudou depois', () => {
    const m = plano()
    const valida = { versao: 1 as const, sessao: prescreverSessao(m, 1, 1)!, metodos: [] }
    const depois = comPrescricoesRegistradas({ ...m, divisao: [[], [], []], prescricoesRegistradas: { '1-1': valida } }, [{ semana: 1, treino: 1 }])
    expect(prescreverSessao(depois, 1, 1)).toEqual(valida.sessao)
  })
})
