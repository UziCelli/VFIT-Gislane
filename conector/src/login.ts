// Login do conector: o pedido (guardado no KV) liga o /authorize do claude.ai à aprovação do coach no app.
// Sem Cloudflare aqui: o KV e o OAuth chegam por parâmetro, então tudo roda no Vitest.
import { b64u } from '../../push/src/b64'
import { verificarIdToken } from '../../push/src/jwt'
import { ErroConector, Firestore, RECONECTAR, trocarToken, type Buscar } from './firestore'

export const VALIDADE_PEDIDO_MS = 10 * 60_000
const CHAVE = 'conector:pedido:'
const FORMATO_PEDIDO = /^[A-Za-z0-9_-]{43}$/

export type KV = {
  get(k: string): Promise<string | null>
  put(k: string, v: string, o?: { expirationTtl: number }): Promise<void>
  delete(k: string): Promise<void>
}
// `req` é o AuthRequest do OAuth (o Worker o devolve ao completar). Nome e host aparecem na tela do app.
export type Pedido = { req: unknown; criadoEm: number; cliente: string; host: string }

export async function criarPedido(kv: KV, dados: Omit<Pedido, 'criadoEm'>, agora: number): Promise<string> {
  const id = b64u(crypto.getRandomValues(new Uint8Array(32)))
  await kv.put(CHAVE + id, JSON.stringify({ ...dados, criadoEm: agora } satisfies Pedido), { expirationTtl: VALIDADE_PEDIDO_MS / 1000 })
  return id
}

// null = não existe, vencido ou já usado. O TTL do KV não é exato: o prazo é conferido aqui também.
export async function lerPedido(kv: KV, id: unknown, agora: number): Promise<Pedido | null> {
  if (typeof id !== 'string' || !FORMATO_PEDIDO.test(id)) return null
  const bruto = await kv.get(CHAVE + id)
  if (!bruto) return null
  const p = JSON.parse(bruto) as Pedido
  if (agora - p.criadoEm > VALIDADE_PEDIDO_MS || agora < p.criadoEm) {
    await kv.delete(CHAVE + id)
    return null
  }
  return p
}

export const apagarPedido = (kv: KV, id: string) => kv.delete(CHAVE + id)

export type Deps = {
  kv: KV
  agora: number // ms
  projeto: string
  apiKey: string
  buscar: Buscar
  obterChave: (kid: string) => Promise<CryptoKey | null>
  // Conclui o OAuth e devolve a URL de volta ao claude.ai.
  completar: (req: unknown, uid: string, refreshToken: string) => Promise<string>
}
export type Resultado = { status: 200; redirectTo: string } | { status: 400 | 403 | 503; erro: string }

const nega = (status: 400 | 403 | 503, erro: string): Resultado => ({ status, erro })
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)

// idToken + refreshToken do coach, vindos do app. Só conecta com 2º fator e papel coach.
export async function concluirLogin(d: Deps, corpo: unknown): Promise<Resultado> {
  const c = (corpo ?? {}) as Record<string, unknown>
  const idToken = texto(c.idToken, 4096)
  const refreshToken = texto(c.refreshToken, 2048)
  if (!idToken || !refreshToken) return nega(400, 'Pedido incompleto.')
  const pedido = await lerPedido(d.kv, c.pedido, d.agora)
  if (!pedido) return nega(400, 'Este pedido venceu ou já foi usado. Volte ao claude.ai e conecte de novo.')
  const agoraS = Math.floor(d.agora / 1000)
  const quem = await verificarIdToken(idToken, d.obterChave, agoraS, true)
  if (!quem || quem.projeto !== d.projeto) return nega(403, 'Entre com e-mail, senha e o código de 6 dígitos para conectar.')
  try {
    const perfil = await new Firestore(d.projeto, idToken, d.buscar).doc(`usuarios/${quem.uid}`)
    if (perfil?.dados.papel !== 'coach') return nega(403, 'Só o coach pode conectar o Claude.')
    // O token renovado tem que continuar com o 2º fator e ser da mesma pessoa; senão o conector não funcionaria depois.
    const novo = await verificarIdToken(await trocarToken(refreshToken, d.apiKey, d.buscar), d.obterChave, agoraS, true)
    if (novo?.uid !== quem.uid) return nega(403, 'Entre de novo com o código de 6 dígitos para conectar.')
  } catch (e) {
    return e instanceof ErroConector && e.message === RECONECTAR ? nega(403, 'Entre de novo com o código de 6 dígitos para conectar.') : nega(503, 'Não deu para conferir agora. Tente de novo.')
  }
  await apagarPedido(d.kv, c.pedido as string) // uso único (o KV não é atômico: vale por boa-fé do navegador que tem o id)
  return { status: 200, redirectTo: await d.completar(pedido.req, quem.uid, refreshToken) }
}
