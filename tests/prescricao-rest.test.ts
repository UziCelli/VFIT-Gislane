// Executado somente com o emulador e regras reais: npm run test:rules.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, type Firestore as SDK } from 'firebase/firestore'
import { Firestore } from '../conector/src/firestore'
import { prepararPrescricao, salvarPrescricao } from '../conector/src/prescricao'
import { mesoParaDoc } from '../src/lib/conversores'
import { proximoMesoId } from '../src/lib/proximoMesoId'
import { mesoPadrao } from '../src/features/coach/meso/mesoPadrao'

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
      setDoc(doc(db, 'mesos', 'origem'), { alunoId: 'aluno', nome: 'Atual', ...mesoParaDoc({ ...mesoPadrao(), inicio: '2026-11-01' }), sessoes: { '1-1': { observacao: 'preservar' } } }),
      setDoc(doc(db, 'registros', 'origem_s01_t1'), { alunoId: 'aluno', mesoId: 'origem', cargas: { sup: { s1: 40 } } }),
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
    await salvarPrescricao(fs, proposta, 'edicao1', agora)
    await expect(salvarPrescricao(fs, antiga, 'edicao2', agora)).rejects.toThrow('mudou')
    const modificado = await fs.doc('mesos/origem')
    expect(modificado?.dados.nome).toBe('Atualizado')
    expect(modificado?.dados.sessoes).toEqual({ '1-1': { observacao: 'preservar' } })
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
})
