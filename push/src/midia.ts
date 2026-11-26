// Vídeos privados do treino (#253): execução do aluno e orientação falada do coach. Funções puras + leituras do
// Firestore com o token de quem chama (as regras de `midias/{id}` decidem quem vê; nenhum segredo novo).
// O arquivo fica em partes de 1 MiB numa instância `Midia` por vídeo (Durable Object SQLite, plano grátis).
// Contrato e custos: docs/plano-videos.md.
import { b64u, deb64u } from './b64'
import { appCheckOk } from './acesso'
import { PROJETOS, type Projeto } from './jwt'
import { uidOk } from './validar'

export const PARTE = 1024 * 1024
// Teto por arquivo: 90 s de orientação gravada no app (~1,2 Mbit/s) dá ~14 MB; vídeo da galeria do aluno até 50 MB.
export const MAX_BYTES = 50 * 1024 * 1024
export const MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const
export type Mime = (typeof MIMES)[number]
// Upload que não terminou em 24 h é apagado (órfão). Vídeo pronto fica RETENCAO_DIAS e depois é apagado; o histórico
// (documento no Firestore, texto e marcações) continua.
export const ORFAO_MS = 24 * 3600_000
export const RETENCAO_DIAS = 60
// Link assinado para o <video>: curto, só para tocar agora.
export const LINK_MS = 10 * 60_000
// Teto global de bytes guardados (a conta grátis tem 5 GB; sobra folga para o resto do Worker).
export const TETO_TOTAL = 4 * 1024 * 1024 * 1024

export type TipoMidia = 'execucao' | 'orientacao'
export type Meta = {
  projeto: Projeto
  id: string
  autor: string
  alunoId: string
  tipo: TipoMidia
  bytes: number
  mime: Mime
  partes: number
  recebidas: number[] // índices já gravados (retomar envio)
  criadoEm: number
  completo: boolean
  avisado: boolean
}

// Id do documento midias/{id}: o app gera com doc(collection(...)).id (20 letras/números).
export const idOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9]{20}$/.test(v)
export const nomeMidia = (projeto: Projeto, id: string) => `midia:${projeto}:${id}`
export const partesDe = (bytes: number) => Math.ceil(bytes / PARTE)
// Tamanho esperado da parte n (a última pode ser menor).
export const tamanhoParte = (bytes: number, n: number) => Math.min(PARTE, bytes - n * PARTE)

export function validarInicio(c: unknown): { id: string; bytes: number; mime: Mime } | null {
  const o = c as { id?: unknown; bytes?: unknown; mime?: unknown } | null
  const mime = MIMES.find((m) => m === o?.mime)
  if (!o || !idOk(o.id) || !mime || !Number.isInteger(o.bytes) || (o.bytes as number) < 1 || (o.bytes as number) > MAX_BYTES) return null
  return { id: o.id, bytes: o.bytes as number, mime }
}

// Range "bytes=a-b" | "bytes=a-" | "bytes=-n". null = sem Range (arquivo inteiro); 'invalida' = 416.
export function faixa(range: string | null, total: number): { inicio: number; fim: number } | null | 'invalida' {
  if (!range) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!m || (!m[1] && !m[2])) return 'invalida'
  let inicio: number
  let fim: number
  if (!m[1]) {
    const n = Number(m[2])
    if (n === 0) return 'invalida'
    inicio = Math.max(0, total - n)
    fim = total - 1
  } else {
    inicio = Number(m[1])
    fim = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1
  }
  if (inicio > fim || inicio >= total) return 'invalida'
  return { inicio, fim }
}

// Até 8 MiB por resposta: o <video> pede o resto em seguida (cabe na memória do Worker).
export const MAX_RESPOSTA = 8 * PARTE
export const limitarFaixa = (f: { inicio: number; fim: number }) => ({ inicio: f.inicio, fim: Math.min(f.fim, f.inicio + MAX_RESPOSTA - 1) })

// ---- Link assinado (HMAC-SHA256 com chave guardada no Worker; nunca sai dele) ----
const te = new TextEncoder()
const texto = (projeto: string, id: string, exp: number) => `${projeto}|${id}|${exp}`

export async function assinar(chave: CryptoKey, projeto: Projeto, id: string, exp: number): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', chave, te.encode(texto(projeto, id, exp)))))
}

export async function conferir(chave: CryptoKey, p: unknown, id: unknown, exp: unknown, sig: unknown, agora: number): Promise<Projeto | null> {
  const projeto = PROJETOS.find((x) => x === p)
  const e = Number(exp)
  if (!projeto || !idOk(id) || typeof sig !== 'string' || !Number.isInteger(e) || e < agora || e > agora + LINK_MS) return null
  try {
    return (await crypto.subtle.verify('HMAC', chave, deb64u(sig), te.encode(texto(projeto, id, e)))) ? projeto : null
  } catch {
    return null
  }
}

// ---- Firestore (REST) com o token de quem chama ----
type Valor = { stringValue?: string; integerValue?: string; timestampValue?: string }
export type CamposMidia = { alunoId?: Valor; autor?: Valor; tipo?: Valor; status?: Valor; bytes?: Valor }
export type DocMidia = { alunoId: string; autor: string; tipo: TipoMidia; status: string; bytes: number }

const base = (projeto: Projeto) => `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents`
const cabecalhos = (token: string, appCheck?: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(appCheckOk(appCheck) ? { 'X-Firebase-AppCheck': appCheck! } : {}),
})

export function lerCampos(c: CamposMidia | undefined): DocMidia | false {
  const tipo = c?.tipo?.stringValue
  const alunoId = c?.alunoId?.stringValue
  const autor = c?.autor?.stringValue
  const bytes = Number(c?.bytes?.integerValue)
  if ((tipo !== 'execucao' && tipo !== 'orientacao') || !uidOk(alunoId) || !uidOk(autor) || !Number.isInteger(bytes)) return false
  return { tipo, alunoId, autor, status: c?.status?.stringValue ?? '', bytes }
}

// Documento = quem chama pode ler (aluno dono ou coach da marca); false = negado/inexistente/malformado; null = sem resposta.
export async function lerMidia(projeto: Projeto, id: string, token: string, buscar: typeof fetch = fetch, appCheck?: string): Promise<DocMidia | false | null> {
  try {
    const r = await buscar(`${base(projeto)}/midias/${id}`, { headers: cabecalhos(token, appCheck) })
    if (r.status === 401 || r.status === 403 || r.status === 404) return false
    if (!r.ok) return null
    return lerCampos(((await r.json()) as { fields?: CamposMidia }).fields)
  } catch {
    return null
  }
}

// Marca "pronto" com o token do autor (as regras só deixam o autor passar de 'enviando' para 'pronto', com a hora do
// servidor). Feito pelo Worker depois de conferir todas as partes: o aviso só sai com o vídeo de fato completo.
export async function marcarPronto(projeto: Projeto, id: string, token: string, buscar: typeof fetch = fetch, appCheck?: string): Promise<boolean> {
  const nome = `projects/${projeto}/databases/(default)/documents/midias/${id}`
  try {
    const r = await buscar(`${base(projeto)}:commit`, {
      method: 'POST',
      headers: { ...cabecalhos(token, appCheck), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          update: { name: nome, fields: { status: { stringValue: 'pronto' } } },
          updateMask: { fieldPaths: ['status'] },
          updateTransforms: [{ fieldPath: 'prontoEm', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: true },
        }],
      }),
    })
    return r.ok
  } catch {
    return false
  }
}

// Partes que faltam (retomar envio).
export const faltando = (m: Pick<Meta, 'partes' | 'recebidas'>) => {
  const tem = new Set(m.recebidas)
  return Array.from({ length: m.partes }, (_, n) => n).filter((n) => !tem.has(n))
}

// "iniciar" de novo no mesmo id: o mesmo arquivo do mesmo autor retoma (completo = faltam [], o app só repete a
// confirmação, sem reenviar); qualquer diferença é outro arquivo e é recusada.
export function retomar(atual: Meta, m: Pick<Meta, 'autor' | 'bytes' | 'mime'>): { faltam: number[] } | 'conflito' {
  return atual.autor !== m.autor || atual.bytes !== m.bytes || atual.mime !== m.mime ? 'conflito' : { faltam: faltando(atual) }
}

// Quem apaga o arquivo: o autor só enquanto o envio não foi confirmado (se 'pronto' já foi gravado e a resposta se
// perdeu, "Cancelar" não pode deixar o registro sem vídeo); um coach da marca apaga envio de outra pessoa.
export function podeApagar(d: Pick<DocMidia, 'autor' | 'status'>, uid: string, coach: boolean): 200 | 403 | 409 {
  if (d.autor === uid) return d.status === 'pronto' ? 409 : 200
  return coach ? 200 : 403
}
