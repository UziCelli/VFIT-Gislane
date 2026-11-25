// App Check do Worker: sem navegador, ele troca um debug token (segredo da Cloudflare) por um token de App Check.
// Nunca expõe o debug token nem o corpo das respostas.
import { ErroConector, refererDoProjeto, type Buscar } from './firestore'

const MARGEM_MS = 5 * 60_000
const cache = new Map<string, { token: string; vence: number }>()

export type ConfigAppCheck = { projeto: string; appId?: string; apiKey: string; debugToken?: string; buscar?: Buscar; agora?: number }

// undefined = App Check não configurado (sem cabeçalho, como antes).
export async function tokenAppCheck(c: ConfigAppCheck): Promise<string | undefined> {
  if (!c.debugToken || !c.appId) return undefined
  const agora = c.agora ?? Date.now()
  const chave = `${c.projeto}|${c.appId}`
  const guardado = cache.get(chave)
  if (guardado && agora < guardado.vence) return guardado.token
  const falha = () => new ErroConector('Não consegui validar o app no Firebase. Tente de novo.', 'APPCHECK', 'app_check')
  const buscar = c.buscar ?? fetch
  let r: Response
  try {
    r = await buscar(
      `https://firebaseappcheck.googleapis.com/v1/projects/${c.projeto}/apps/${c.appId}:exchangeDebugToken?key=${encodeURIComponent(c.apiKey)}`,
      {
        method: 'POST',
        // A chave web é restrita ao domínio do app (igual a trocarToken).
        headers: { 'Content-Type': 'application/json', Referer: refererDoProjeto(c.projeto) },
        body: JSON.stringify({ debugToken: c.debugToken }),
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    throw falha()
  }
  if (!r.ok) throw falha()
  const corpo = await r.json().catch(() => null) as { token?: unknown; ttl?: unknown } | null
  const segundos = typeof corpo?.ttl === 'string' && /^\d+(?:\.\d+)?s$/.test(corpo.ttl) ? Number(corpo.ttl.slice(0, -1)) : NaN
  if (typeof corpo?.token !== 'string' || !corpo.token || !(Number.isFinite(segundos) && segundos > 0)) throw falha()
  cache.set(chave, { token: corpo.token, vence: agora + segundos * 1000 - MARGEM_MS })
  return corpo.token
}

export const limparCacheAppCheck = () => cache.clear()
