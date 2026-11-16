import { expect, it } from 'vitest'
import { mesoPadrao } from '../features/coach/meso/mesoPadrao'
import { prescreverSessao, metodosDaSessao } from '../engine/sessao'
import { mesoParaDoc, docParaMeso } from './conversores'
import { comPrescricoesRegistradas, lerPrescricaoRegistrada } from './prescricaoRegistrada'
import { iniciarEdicao, adicionarMetodo } from '../engine/editarSessao'

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
