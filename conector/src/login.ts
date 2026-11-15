// Login do conector: o pedido (guardado no KV) liga o /authorize do claude.ai à aprovação do coach no app.
// Sem Cloudflare aqui: o KV e o OAuth chegam por parâmetro, então tudo roda no Vitest.
import { b64u } from '../../push/src/b64'
import { verificarIdToken } from '../../push/src/jwt'
import { tokenAppCheck } from './appcheck'
import { ErroConector, ErroRenovacaoRecusada, Firestore, RECONECTAR, trocarToken, type Buscar } from './firestore'

export const VALIDADE_PEDIDO_MS = 10 * 60_000
const CHAVE = 'conector:pedido:'
const FORMATO_PEDIDO = /^[A-Za-z0-9_-]{43}$/

export type KV = {
  get(k: string): Promise<string | null>
  put(k: string, v: string, o?: { expirationTtl: number }): Promise<void>
  delete(k: string): Promise<void>
  consume(k: string): Promise<string | null>
}
// `req` é o AuthRequest do OAuth (o Worker o devolve ao completar). Nome e host aparecem na tela do app.
export type Pedido = { req: unknown; criadoEm: number; cliente: string; host: string; versaoConsentimento?: number }

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
  appId?: string
  debugToken?: string
  buscar: Buscar
  obterChave: (kid: string) => Promise<CryptoKey | null>
  // Conclui o OAuth e devolve a URL de volta ao claude.ai.
  completar: (req: unknown, uid: string, refreshToken: string, versaoConsentimento: number | undefined) => Promise<string>
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
  if (!pedido) return nega(400, 'Este pedido venceu ou já foi usado. Volte ao assistente e conecte de novo.')
  if (pedido.versaoConsentimento === 2 && c.versaoConsentimento !== 2) return nega(400, 'Esta página está desatualizada. Atualize o app e reabra o pedido original de conexão para conferir as novas permissões.')
  const agoraS = Math.floor(d.agora / 1000)
  const quem = await verificarIdToken(idToken, d.obterChave, agoraS, true)
  if (!quem || quem.projeto !== d.projeto) return nega(403, 'Entre com e-mail, senha e o código de 6 dígitos para conectar.')
  try {
    const appCheck = await tokenAppCheck({ projeto: d.projeto, appId: d.appId, apiKey: d.apiKey, debugToken: d.debugToken, buscar: d.buscar, agora: d.agora })
    const perfil = await new Firestore(d.projeto, idToken, d.buscar, appCheck).doc(`usuarios/${quem.uid}`)
    if (perfil?.dados.papel !== 'coach') return nega(403, 'Só o coach pode conectar o assistente.')
  } catch (e) {
    return e instanceof ErroConector && e.message === RECONECTAR
      ? nega(403, 'O app recusou a consulta ao seu perfil. Verifique as permissões do Firestore e tente de novo.')
      : nega(503, 'Não consegui consultar seu perfil no app. Tente de novo.')
  }
  try {
    // A renovação precisa manter o 2º fator, o projeto e a mesma pessoa.
    const tokenRenovado = await trocarToken(refreshToken, d.apiKey, d.buscar)
    const novo = await verificarIdToken(tokenRenovado, d.obterChave, agoraS, false)
    if (!novo) return nega(403, 'Não foi possível validar o login renovado. Saia do app e entre novamente para conectar.')
    if (novo.uid !== quem.uid || novo.projeto !== quem.projeto) return nega(403, 'O login renovado não corresponde à conta ou ao projeto da sessão. Saia do app e entre novamente para conectar.')
    if (!(await verificarIdToken(tokenRenovado, d.obterChave, agoraS, true))) return nega(403, 'Não foi possível confirmar a verificação em 2 etapas no login renovado. Saia do app e entre novamente com o código de 6 dígitos.')
  } catch (e) {
    return e instanceof ErroRenovacaoRecusada
      ? nega(403, 'O Firebase recusou a renovação do login. Saia do app e entre novamente para conectar.')
      : nega(503, 'Não consegui renovar seu login no Firebase. Tente de novo.')
  }
  // O armazenamento deve consumir de forma atômica, inclusive entre requisições simultâneas.
  if (!(await d.kv.consume(CHAVE + (c.pedido as string)))) return nega(400, 'Este pedido venceu ou já foi usado. Volte e conecte de novo.')
  return { status: 200, redirectTo: await d.completar(pedido.req, quem.uid, refreshToken, c.versaoConsentimento === pedido.versaoConsentimento ? pedido.versaoConsentimento : undefined) }
}
