// Executado somente com o emulador e regras reais: npm run test:rules.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, type Firestore as SDK } from 'firebase/firestore'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { Firestore } from '../conector/src/firestore'
import { prepararPrescricao, salvarPrescricao } from '../conector/src/prescricao'
import { mesoParaDoc } from '../src/lib/conversores'
import { proximoMesoId } from '../src/lib/proximoMesoId'
import { mesoPadrao } from '../src/features/coach/meso/mesoPadrao'
import { docParaMeso, type MesoDoc } from '../src/lib/conversores'
import { prescreverSessao } from '../src/engine/sessao'

let env: RulesTestEnvironment
const token = (factor: boolean) => {
  const b64 = (x: object) => Buffer.from(JSON.stringify(x)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'https://securetoken.google.com/demo-forca', aud: 'demo-forca', sub: 'coach', user_id: 'coach', iat: now, exp: now + 3600, firebase: { sign_in_provider: 'password', ...(factor ? { sign_in_second_factor: 'totp' } : {}) } })}.`
}
const buscar = ((input: RequestInfo | URL, init?: RequestInit) => fetch(String(input).replace('https://firestore.googleapis.com', 'http://127.0.0.1:8080'), init)) as typeof fetch
const firestore = (factor = true) => new Firestore('demo-forca', token(factor), buscar)
const agora = Date.parse('2026-11-15T15:00:00Z')

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-forca', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as SDK
    await Promise.all([
      setDoc(doc(db, 'usuarios', 'coach'), { papel: 'coach', status: 'ativo', nome: 'Victor' }),
      setDoc(doc(db, 'usuarios', 'aluno'), { papel: 'aluno', status: 'ativo', nome: 'Ana' }),
      setDoc(doc(db, 'mesos', 'origem'), { alunoId: 'aluno', nome: 'Atual', ...mesoParaDoc({ ...mesoPadrao(), inicio: '2026-11-01' }), sessoes: { '1-1': { semana: 1, treino: 1, exercicios: [], metodos: [] } } }),
      setDoc(doc(db, 'registros', 'origem_s01_t1'), { alunoId: 'aluno', mesoId: 'origem', semana: 1, treino: 1, cargas: { sup: { s1: 40 } } }),
    ])
  })
}, 60000)
afterAll(async () => { if (env) await env.cleanup() })

describe('gravação REST com regras reais', () => {
  it('exige MFA, preserva sessão e carga, e recusa versão antiga e duplicação', async () => {
    const fs = firestore()
    await expect(firestore(false).doc('mesos/origem')).rejects.toThrow()
    const proposta = await prepararPrescricao(fs, { acao: 'editar', alunoId: 'aluno', mesoId: 'origem', nome: 'Atualizado' }, agora)
    expect(proposta.alunoNome).toBe('Ana')
    const antiga = await prepararPrescricao(fs, { acao: 'editar', alunoId: 'aluno', mesoId: 'origem', nome: 'Antigo' }, agora)
    await salvarPrescricao(fs, proposta, 'edicao1', agora, 'coach')
    await expect(salvarPrescricao(fs, antiga, 'edicao2', agora)).rejects.toThrow('mudou')
    const modificado = await fs.doc('mesos/origem')
    expect(modificado?.dados.nome).toBe('Atualizado')
    expect(modificado?.dados.sessoes).toEqual({ '1-1': { semana: 1, treino: 1, exercicios: [], metodos: [] } })
    expect(modificado?.dados.atualizadoEm).toHaveProperty('ms')
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore() as unknown as SDK, 'registros', 'origem_s01_t1'))
      expect(snap.data()?.cargas).toEqual({ sup: { s1: 40 } })
    })
    const primeiro = await prepararPrescricao(fs, { acao: 'proximo', alunoId: 'aluno' }, agora)
    const segundo = await prepararPrescricao(fs, { acao: 'proximo', alunoId: 'aluno' }, agora)
    const proximoId = await proximoMesoId('origem')
    expect(await salvarPrescricao(fs, primeiro, 'prox1', agora)).toEqual({ mesoId: proximoId })
    await expect(salvarPrescricao(fs, segundo, 'prox2', agora)).rejects.toThrow()
    expect((await fs.doc(`mesos/${proximoId}`))?.dados.mcpOperacao).toBe('prox1')
  }, 60000)
  it('remove exercícios de dois treinos sem alterar cargas ou sessões, e rejeita versão anterior', async () => {
    const meso = { ...mesoPadrao(), inicio: '2026-11-01', frequencia: 5, divisao: [
      [{ slotId: 'face1', nome: 'Facepull' }, { slotId: 'sup', nome: 'Supino Reto Barra' }], [], [], [],
      [{ slotId: 'face5', nome: 'Facepull' }, { slotId: 'perna', nome: 'Agachamento Livre' }],
    ] }
    const sessoes = { '1-1': { semana: 1, treino: 1, exercicios: [{ slotId: 'face1', nome: 'Facepull', origemSlotId: 'face1' }], metodos: [] } }
    const cargas = { face1: { s1: 20 }, sup: { s1: 40 } }
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as SDK
      await Promise.all([
        setDoc(doc(db, 'mesos', 'remocao'), { alunoId: 'aluno', nome: 'Remoção', ...mesoParaDoc(meso), sessoes }),
        setDoc(doc(db, 'registros', 'remocao_s01_t1'), { alunoId: 'aluno', mesoId: 'remocao', semana: 1, treino: 1, cargas }),
      ])
    })
    const fs = firestore()
    const entrada = { acao: 'editar' as const, alunoId: 'aluno', mesoId: 'remocao', removerSlotIds: ['face1', 'face5'] }
    const p = await prepararPrescricao(fs, entrada, agora)
    const antiga = await prepararPrescricao(fs, entrada, agora)
    expect(p.previaDados?.sessoes).toEqual(sessoes)
    await salvarPrescricao(fs, p, 'remover1', agora)
    await expect(salvarPrescricao(fs, antiga, 'remover2', agora)).rejects.toThrow('mudou')
    const salvo = await fs.doc('mesos/remocao')
    expect(salvo?.dados.sessoes).toEqual(sessoes)
    expect(salvo?.dados.divisao).toMatchObject({ t1: [{ slotId: 'sup' }], t5: [{ slotId: 'perna' }] })
    expect(salvo?.dados.progressaoExercicio).toHaveProperty('face1.w1')
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore() as unknown as SDK, 'registros', 'remocao_s01_t1'))
      expect(snap.data()?.cargas).toEqual(cargas)
    })
  }, 60000)

  it('preserva sessão parcial, bloqueia registro que chega após prévia e grava recibo atômico', async () => {
    const fs = firestore()
    const m = { ...mesoPadrao(), inicio: '2026-11-01', divisao: [[{ slotId: 'face', nome: 'Facepull' }, { slotId: 'sup', nome: 'Supino Reto Barra' }], [], []] }
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as SDK
      await setDoc(doc(db, 'mesos', 'historico'), { alunoId: 'aluno', nome: 'Histórico', ...mesoParaDoc(m) })
      await setDoc(doc(db, 'registros', 'historico_s01_t1'), { alunoId: 'aluno', mesoId: 'historico', semana: 1, treino: 1, cargas: { face: { s1: 0 } }, reps: { face: { s1: 12 } } })
    })
    const entrada = { acao: 'editar' as const, alunoId: 'aluno', mesoId: 'historico', alteracoes: [{ tipo: 'remover' as const, slotId: 'face' }] }
    const p = await prepararPrescricao(fs, entrada, agora)
    expect(prescreverSessao(docParaMeso(p.dados as MesoDoc), 1, 1)).toEqual(prescreverSessao(m, 1, 1))
    expect(prescreverSessao(docParaMeso(p.dados as MesoDoc), 2, 1)?.exercicios.map((x) => x.slot.slotId)).toEqual(['sup'])
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as SDK, 'registros', 'historico_s02_t1'), { alunoId: 'aluno', mesoId: 'historico', semana: 2, treino: 1, cargas: {} })
    })
    await expect(salvarPrescricao(fs, p, 'conflito_registro', agora, 'coach')).rejects.toThrow()
    expect(await fs.doc('mcpOperacoes/conflito_registro')).toBeNull()
    const nova = await prepararPrescricao(fs, entrada, agora)
    await salvarPrescricao(fs, nova, 'historico_ok', agora, 'coach')
    expect((await fs.doc('mcpOperacoes/historico_ok'))?.dados).toMatchObject({ uid: 'coach', mesoId: 'historico' })
    const dados = (await fs.doc('mesos/historico'))!.dados
    expect(dados.prescricoesRegistradas).toHaveProperty('2-1')
    await expect(prepararPrescricao(fs, { ...entrada, alteracoes: [{ tipo: 'configurar', semanas: 1 }] }, agora)).rejects.toThrow('offline')
  }, 60000)

  it('isola recibos e torna a cópia do registro imutável sem bloquear novas cargas', async () => {
    const coach = env.authenticatedContext('coach', { mfaDispensado: true }).firestore() as unknown as SDK
    const outro = env.authenticatedContext('outro', { mfaDispensado: true }).firestore() as unknown as SDK
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as SDK
      await setDoc(doc(db, 'usuarios', 'outro'), { papel: 'coach' })
      await setDoc(doc(db, 'usuarios', 'aluno'), { papel: 'aluno', status: 'ativo', pagoAte: new Date(Date.now() + 86400000) })
    })
    await assertSucceeds(setDoc(doc(coach, 'mcpOperacoes', 'privada'), { uid: 'coach', mesoId: 'origem', em: serverTimestamp() }))
    await assertFails(getDoc(doc(outro, 'mcpOperacoes', 'privada')))
    await assertFails(updateDoc(doc(coach, 'mcpOperacoes', 'privada'), { mesoId: 'outro' }))
    const aluno = env.authenticatedContext('aluno').firestore() as unknown as SDK
    const ref = doc(aluno, 'registros', 'origem_s03_t1')
    await assertSucceeds(setDoc(ref, { alunoId: 'aluno', mesoId: 'origem', semana: 3, treino: 1, prescricaoRegistrada: '{}', atualizadoEm: serverTimestamp() }))
    await assertFails(updateDoc(ref, { prescricaoRegistrada: 'alterada', atualizadoEm: serverTimestamp() }))
    await assertSucceeds(updateDoc(ref, { 'cargas.sup.s1': 0, atualizadoEm: serverTimestamp() }))
  }, 60000)

})
