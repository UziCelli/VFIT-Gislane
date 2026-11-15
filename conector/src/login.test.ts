import { beforeAll, describe, expect, it } from 'vitest'
import { b64u } from '../../push/src/b64'
import { criarPedido, concluirLogin, lerPedido, VALIDADE_PEDIDO_MS, type Deps, type KV } from './login'

const te = new TextEncoder()
const AGORA = 1_800_000_000_000
let par: CryptoKeyPair
beforeAll(async () => {
  par = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
})
async function jwt(extra: object = {}, mfa = true) {
  const h = b64u(te.encode(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })))
  const p = b64u(te.encode(JSON.stringify({ aud: 'forca--app', iss: 'https://securetoken.google.com/forca--app', sub: 'coach1', iat: AGORA / 1000 - 60, exp: AGORA / 1000 + 3000, ...(mfa && { firebase: { sign_in_second_factor: 'totp' } }), ...extra })))
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, te.encode(`${h}.${p}`))
  return `${h}.${p}.${b64u(new Uint8Array(s))}`
}
const memoria = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>()
  return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k), consume: async (k) => { const v = m.get(k) ?? null; m.delete(k); return v } }
}
const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status })

// Firestore devolve o perfil; securetoken devolve `idRenovado`.
function montar(papel: string, idRenovado: Promise<string>) {
  const kv = memoria()
  const chamadas: string[] = []
  const d: Deps = {
    kv, agora: AGORA, projeto: 'forca--app', apiKey: 'chave', obterChave: async (kid) => (kid === 'k1' ? par.publicKey : null),
    buscar: (async (url: string) => {
      chamadas.push(String(url))
      if (String(url).includes('securetoken')) return resposta({ id_token: await idRenovado })
      return resposta({ name: 'x/usuarios/coach1', fields: { papel: { stringValue: papel } } })
    }) as typeof fetch,
    completar: async (_req, uid) => `https://claude.ai/volta?uid=${uid}`,
  }
  return { kv, d, chamadas }
}
const corpo = async (pedido: string, extra: object = {}) => ({ pedido, idToken: await jwt(), refreshToken: 'r', ...extra })

describe('pedido', () => {
  it('vale 10 minutos', async () => {
    const kv = memoria()
    const id = await criarPedido(kv, { req: {}, cliente: 'Claude', host: 'claude.ai' }, AGORA)
    expect((await lerPedido(kv, id, AGORA + VALIDADE_PEDIDO_MS))?.host).toBe('claude.ai')
    expect(await lerPedido(kv, id, AGORA + VALIDADE_PEDIDO_MS + 1)).toBeNull()
    expect(kv.m.size).toBe(0) // vencido é apagado
  })
  it('id fora do formato nem consulta o KV', async () => {
    expect(await lerPedido(memoria(), '../x', AGORA)).toBeNull()
    expect(await lerPedido(memoria(), 42, AGORA)).toBeNull()
  })
})

describe('concluirLogin', () => {
  it('coach com 2º fator conecta e o refreshToken segue para o OAuth; o pedido some', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: { a: 1 }, cliente: 'Claude', host: 'claude.ai' }, AGORA)
    expect(await concluirLogin(t.d, await corpo(id))).toEqual({ status: 200, redirectTo: 'https://claude.ai/volta?uid=coach1' })
    expect(t.kv.m.size).toBe(0)
  })
  it('pedido reusado ou vencido = recusa', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    await concluirLogin(t.d, await corpo(id))
    expect((await concluirLogin(t.d, await corpo(id))).status).toBe(400)
    const velho = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA - VALIDADE_PEDIDO_MS - 1)
    expect((await concluirLogin(t.d, await corpo(velho))).status).toBe(400)
  })
  it('só uma de duas aprovações simultâneas usa o mesmo pedido', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    const c = await corpo(id)
    const resultados = await Promise.all([concluirLogin(t.d, c), concluirLogin(t.d, c)])
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 400])
  })
  it('sem pedido válido nem lê o Firestore', async () => {
    const t = montar('coach', jwt())
    expect((await concluirLogin(t.d, await corpo('a'.repeat(43)))).status).toBe(400)
    expect(t.chamadas).toEqual([])
  })
  it('sem 2º fator = recusa e mantém o pedido para tentar de novo', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    expect((await concluirLogin(t.d, { pedido: id, idToken: await jwt({}, false), refreshToken: 'r' })).status).toBe(403)
    expect(t.kv.m.size).toBe(1)
  })
  it('aluno (papel diferente de coach) = recusa', async () => {
    const t = montar('aluno', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    expect((await concluirLogin(t.d, await corpo(id))).status).toBe(403)
  })
  it('token renovado sem 2º fator ou de outra pessoa = recusa', async () => {
    for (const renovado of [jwt({}, false), jwt({ sub: 'outro' }), jwt({ aud: 'gislane-personal-trainer', iss: 'https://securetoken.google.com/gislane-personal-trainer' })]) {
      const t = montar('coach', renovado)
      const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
      expect((await concluirLogin(t.d, await corpo(id))).status).toBe(403)
    }
  })
  it('token de outro projeto (Gislane) = recusa; corpo incompleto = 400', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    const g = await jwt({ aud: 'gislane-personal-trainer', iss: 'https://securetoken.google.com/gislane-personal-trainer' })
    expect((await concluirLogin(t.d, { pedido: id, idToken: g, refreshToken: 'r' })).status).toBe(403)
    expect((await concluirLogin(t.d, { pedido: id })).status).toBe(400)
    expect((await concluirLogin(t.d, null)).status).toBe(400)
  })
})

describe('falhas na conferência', () => {
  it('distingue falha no perfil e falha na renovação sem mostrar detalhes internos', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    const c = await corpo(id)
    const original = t.d.buscar
    t.d.buscar = (async (url: string, init?: RequestInit) => {
      if (!String(url).includes('securetoken')) throw new Error('detalhe privado')
      return original(url, init)
    }) as typeof fetch
    expect(await concluirLogin(t.d, c)).toEqual({ status: 503, erro: 'Não consegui consultar seu perfil no app. Tente de novo.' })
    t.d.buscar = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('securetoken')) throw new Error('detalhe privado')
      return original(url, init)
    }) as typeof fetch
    expect(await concluirLogin(t.d, c)).toEqual({ status: 503, erro: 'Não consegui renovar seu login no Firebase. Tente de novo.' })
  })
})


describe('diagnóstico seguro do login', () => {
  it('distingue recusa do perfil, renovação recusada e token renovado inválido', async () => {
    const t = montar('coach', jwt({}, false))
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    const c = await corpo(id)
    const original = t.d.buscar
    for (const status of [401, 403]) {
      t.d.buscar = (async () => resposta({ segredo: 'privado' }, status)) as typeof fetch
      expect(await concluirLogin(t.d, c)).toEqual({ status: 403, erro: 'O app recusou a consulta ao seu perfil. Verifique as permissões do Firestore e tente de novo.' })
    }
    t.d.buscar = (async (url: string, init?: RequestInit) => String(url).includes('securetoken')
      ? resposta({ error: { message: 'INVALID_REFRESH_TOKEN', detalhe: 'privado' } }, 400) : original(url, init)) as typeof fetch
    expect(await concluirLogin(t.d, c)).toEqual({ status: 403, erro: 'O Firebase recusou a renovação do login. Saia do app e entre novamente para conectar.' })
    t.d.buscar = original
    expect(await concluirLogin(t.d, c)).toEqual({ status: 403, erro: 'O login renovado não passou na verificação de segurança. Saia do app e entre novamente com o código de 6 dígitos.' })
    expect(t.kv.m.size).toBe(1)
  })
  it('respostas desconhecidas ou malformadas do Firebase são falhas de serviço, sem expor detalhes', async () => {
    const t = montar('coach', jwt())
    const id = await criarPedido(t.kv, { req: {}, cliente: 'C', host: 'h' }, AGORA)
    const c = await corpo(id)
    const original = t.d.buscar
    for (const respostaFirebase of [resposta({ error: { message: 'segredo privado' } }, 400), resposta({ error: { message: 'INVALID_REFRESH_TOKEN' } }, 503), new Response('segredo privado', { status: 200 })]) {
      t.d.buscar = (async (url: string, init?: RequestInit) => String(url).includes('securetoken') ? respostaFirebase : original(url, init)) as typeof fetch
      expect(await concluirLogin(t.d, c)).toEqual({ status: 503, erro: 'Não consegui renovar seu login no Firebase. Tente de novo.' })
    }
  })
})
