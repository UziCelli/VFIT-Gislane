// Firestore REST como o próprio coach (Bearer do idToken dele): o firestore.rules decide tudo. Nunca loga token nem dado.
import { docDeRest, idDeRest } from './rest'

export type Buscar = typeof fetch
export type Doc = { id: string; dados: Record<string, unknown> }

// Mensagem já pronta para o Claude repetir ao coach.
export class ErroConector extends Error {}
export const RECONECTAR = 'Sem permissão. Peça ao coach para desconectar e conectar o Claude de novo (precisa do login com o código de 6 dígitos).'

export async function trocarToken(refreshToken: string, apiKey: string, buscar: Buscar = fetch): Promise<string> {
  let r: Response
  try {
    r = await buscar(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      // A chave web do Firebase é restrita ao domínio do app. O pedido do Worker
      // precisa identificar essa origem para que o Google aceite a chave pública.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://app.vfitcoachapp.com/' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
  } catch {
    throw new ErroConector('Não deu para falar com o Firebase. Tente de novo.')
  }
  if (!r.ok) throw new ErroConector(RECONECTAR)
  const idToken = ((await r.json()) as { id_token?: unknown }).id_token
  if (typeof idToken !== 'string' || !idToken) throw new ErroConector(RECONECTAR)
  return idToken
}

export class Firestore {
  constructor(private projeto: string, private token: string, private buscar: Buscar = fetch) {}

  private base = () => `https://firestore.googleapis.com/v1/projects/${this.projeto}/databases/(default)/documents`

  private async chamar(url: string, corpo?: unknown): Promise<Response> {
    let r: Response
    try {
      // No Cloudflare, fetch rejeita receber o Firestore como `this`.
      const buscar = this.buscar
      r = await buscar(url, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${this.token}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      })
    } catch {
      throw new ErroConector('Não deu para falar com o Firestore. Tente de novo.')
    }
    if (r.status === 401 || r.status === 403) throw new ErroConector(RECONECTAR)
    return r
  }

  // null = não existe.
  async doc(caminho: string): Promise<Doc | null> {
    const r = await this.chamar(`${this.base()}/${caminho.split('/').map(encodeURIComponent).join('/')}`)
    if (r.status === 404) return null
    if (!r.ok) throw new ErroConector('O Firestore não respondeu direito. Tente de novo.')
    const d = (await r.json()) as { name: string; fields?: Record<string, unknown> }
    return { id: idDeRest(d.name), dados: docDeRest(d.fields) }
  }

  // Um filtro de igualdade só (não precisa de índice). Sem filtro = a coleção toda.
  async consulta(colecao: string, campo?: string, valor?: string): Promise<Doc[]> {
    const r = await this.chamar(`${this.base()}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: colecao }],
        ...(campo && { where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } } } }),
        limit: 5000,
      },
    })
    if (!r.ok) throw new ErroConector('O Firestore não respondeu direito. Tente de novo.')
    const linhas = (await r.json()) as { document?: { name: string; fields?: Record<string, unknown> } }[]
    return linhas.flatMap((l) => (l.document ? [{ id: idDeRest(l.document.name), dados: docDeRest(l.document.fields) }] : []))
  }
}
