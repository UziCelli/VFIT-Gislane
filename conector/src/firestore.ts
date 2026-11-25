// Firestore REST como o próprio coach (Bearer do idToken dele): o firestore.rules decide tudo. Nunca loga token nem dado.
import { docDeRest, idDeRest, paraRest } from './rest'

export type Buscar = typeof fetch
export type Doc = { id: string; dados: Record<string, unknown>; updateTime?: string }

// Mensagens seguras para o assistente repetir ao coach.
export class ErroConector extends Error {
  constructor(mensagem: string, readonly codigo = 'CONECTOR', readonly etapa = 'firestore', readonly podeTentarNovamente = true) { super(mensagem) }
}
// Resposta explícita do servidor confirma que o commit não aconteceu.
export class ErroPrescricaoRecusada extends ErroConector {
  constructor(mensagem: string, codigo = 'GRAVACAO_RECUSADA') { super(mensagem, codigo, 'confirmacao', false) }
}
// updateTime = exatamente esta versão; existe = só precisa existir; nenhum dos dois = precisa não existir.
export type Condicao = { caminho: string; updateTime?: string; existe?: true }
export const RECONECTAR = 'Sem permissão. Peça ao coach para desconectar e conectar o assistente de novo (precisa do login com o código de 6 dígitos).'
export class ErroRenovacaoRecusada extends ErroConector {}
export class ErroCommitDesconhecido extends ErroConector {}

// A chave web de cada projeto só aceita pedidos com o domínio do app da própria marca.
const REFERERS: Record<string, string> = {
  'forca--app': 'https://app.vfitcoachapp.com/',
  'gislane-personal-trainer': 'https://app.gislanepersonaltrainer.com/',
}
export const refererDoProjeto = (projeto?: string) => REFERERS[projeto ?? ''] ?? REFERERS['forca--app']

export async function trocarToken(refreshToken: string, apiKey: string, buscar: Buscar = fetch, referer = refererDoProjeto()): Promise<string> {
  let r: Response
  try {
    r = await buscar(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      // A chave web do Firebase é restrita ao domínio do app. O pedido do Worker
      // precisa identificar essa origem para que o Google aceite a chave pública.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: referer },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ErroConector('Não deu para falar com o Firebase. Tente de novo.')
  }
  if (!r.ok) {
    // Apenas códigos conhecidos significam que a credencial foi recusada. Nunca exponha o corpo.
    const corpo = await r.json().catch(() => null) as { error?: { message?: unknown } } | null
    const codigo = corpo?.error?.message
    if (r.status === 400 && typeof codigo === 'string' && ['TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'USER_DISABLED', 'USER_NOT_FOUND'].includes(codigo)) {
      throw new ErroRenovacaoRecusada(RECONECTAR)
    }
    throw new ErroConector('Não consegui renovar seu login no Firebase. Tente de novo.')
  }
  const corpo = await r.json().catch(() => null) as { id_token?: unknown } | null
  const idToken = corpo?.id_token
  if (typeof idToken !== 'string' || !idToken) throw new ErroConector('Não consegui renovar seu login no Firebase. Tente de novo.')
  return idToken
}

export class Firestore {
  constructor(private projeto: string, private token: string, private buscar: Buscar = fetch, private appCheck?: string) {}

  private base = () => `https://firestore.googleapis.com/v1/projects/${this.projeto}/databases/(default)/documents`

  private async chamar(url: string, corpo?: unknown, commit = false): Promise<Response> {
    let r: Response
    try {
      // No Cloudflare, fetch rejeita receber o Firestore como `this`.
      const buscar = this.buscar
      r = await buscar(url, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${this.token}`, ...(this.appCheck && { 'X-Firebase-AppCheck': this.appCheck }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      if (commit) throw new ErroCommitDesconhecido('A resposta da gravação não chegou. Consulte o resultado antes de tentar novamente.', 'RESULTADO_DESCONHECIDO', 'confirmacao', false)
      throw new ErroConector('Não deu para falar com o Firestore. Tente de novo.')
    }
    if (commit && !r.ok && r.status < 500 && r.status !== 408) {
      await r.body?.cancel()
      throw new ErroPrescricaoRecusada(r.status === 401 || r.status === 403 ? 'O Firebase recusou a gravação. Confira login, App Check e regras antes de preparar novamente.' : r.status === 429 ? 'Limite do Firebase atingido. Aguarde e prepare novamente.' : 'O mesociclo mudou ou a gravação foi recusada. Prepare e confirme novamente.', `FIRESTORE_${r.status}`)
    }
    if (r.status === 401 || r.status === 403) { await r.body?.cancel(); throw new ErroConector(RECONECTAR, `FIRESTORE_${r.status}`, 'firestore', false) }
    return r
  }

  async lote(caminhos: string[]): Promise<{ caminho: string; doc: Doc | null }[]> {
    const prefixo = `projects/${this.projeto}/databases/(default)/documents/`
    const r = await this.chamar(`${this.base()}:batchGet`, { documents: caminhos.map((c) => prefixo + c) })
    if (!r.ok) throw new ErroConector('Não foi possível conferir os registros do treino.')
    const linhas = await r.json() as { found?: { name: string; fields?: Record<string, unknown>; updateTime: string }; missing?: string }[]
    const resultado = linhas.map((l) => ({ caminho: (l.found?.name ?? l.missing ?? '').replace(prefixo, ''), doc: l.found ? { id: idDeRest(l.found.name), dados: docDeRest(l.found.fields), updateTime: l.found.updateTime } : null }))
    if (resultado.length !== caminhos.length || new Set(resultado.map((x) => x.caminho)).size !== caminhos.length || resultado.some((x) => !caminhos.includes(x.caminho))) throw new ErroConector('Resposta incompleta ao conferir os registros.')
    return resultado
  }

  // null = não existe.
  async doc(caminho: string): Promise<Doc | null> {
    const r = await this.chamar(`${this.base()}/${caminho.split('/').map(encodeURIComponent).join('/')}`)
    if (r.status === 404) return null
    if (!r.ok) throw new ErroConector('O Firestore não respondeu direito. Tente de novo.')
    const d = (await r.json()) as { name: string; fields?: Record<string, unknown>; updateTime?: string }
    return { id: idDeRest(d.name), dados: docDeRest(d.fields), updateTime: d.updateTime }
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
    const linhas = (await r.json()) as { document?: { name: string; fields?: Record<string, unknown>; updateTime?: string } }[]
    if (linhas.filter((l) => l.document).length >= 5000) throw new ErroConector('A consulta excedeu o limite seguro. Consulte um mesociclo específico.', 'LIMITE_CONSULTA', 'firestore', false)
    return linhas.flatMap((l) => (l.document ? [{ id: idDeRest(l.document.name), dados: docDeRest(l.document.fields), updateTime: l.document.updateTime }] : []))
  }
  // Um único commit, com pré-condição do documento e carimbo do servidor.
  async gravarMeso(id: string, dados: Record<string, unknown>, esperado: string | null, origem?: { id: string; updateTime: string }, protecao?: { condicoes: Condicao[]; operacao: string; uid: string }): Promise<void> {
    const nome = `projects/${this.projeto}/databases/(default)/documents/mesos/${id}`
    const campos = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, paraRest(v)]))
    const r = await this.chamar(`${this.base()}:commit`, { writes: [{
      update: { name: nome, fields: campos },
      ...(esperado ? { updateMask: { fieldPaths: [...new Set([...Object.keys(campos), 'pausaPrincipaisS', 'progressaoPct', 'limiteReps', 'tempoLimiteMin'])] } } : {}),
      currentDocument: esperado ? { updateTime: esperado } : { exists: false },
      updateTransforms: [{ fieldPath: 'atualizadoEm', setToServerValue: 'REQUEST_TIME' }, ...(esperado ? [] : [{ fieldPath: 'criadoEm', setToServerValue: 'REQUEST_TIME' }])],
    }, ...(origem ? [{ verify: `projects/${this.projeto}/databases/(default)/documents/mesos/${origem.id}`, currentDocument: { updateTime: origem.updateTime } }] : []), ...(protecao ? [
      ...protecao.condicoes.map((c) => ({ verify: `projects/${this.projeto}/databases/(default)/documents/${c.caminho}`, currentDocument: c.updateTime ? { updateTime: c.updateTime } : c.existe ? { exists: true } : { exists: false } })),
      { update: { name: `projects/${this.projeto}/databases/(default)/documents/mcpOperacoes/${protecao.operacao}`, fields: { uid: paraRest(protecao.uid), mesoId: paraRest(id) } }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'em', setToServerValue: 'REQUEST_TIME' }] },
    ] : [])] }, true)
    await r.body?.cancel()
    if (!r.ok) throw new ErroCommitDesconhecido('Não foi possível confirmar o resultado da gravação.', 'RESULTADO_DESCONHECIDO', 'confirmacao', false)
  }

}
