// Envio de vídeo privado (#253) para o Worker, em partes de 1 MiB, com progresso, cancelamento e retomada.
// O arquivo fica guardado no aparelho (IndexedDB) até o Worker confirmar: fechar o app ou cair a internet no meio não
// perde o vídeo; ao voltar, "Retomar" manda só as partes que faltam. Contrato: docs/plano-videos.md.
import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
import { auth, db } from './firebase'
import { PARTE, type Mime, type Sessao, type TipoMidia } from './midias'
import { cabecalhosPush, juntarUrl } from './push'

const BASE = import.meta.env.VITE_PUSH_URL as string | undefined

export type PedidoEnvio = {
  tipo: TipoMidia
  alunoId: string
  exercicioId: string
  exercicio: string
  sessao: Sessao
  mime: Mime
  duracaoS: number
  respondeA?: string
}
type Guardado = PedidoEnvio & { id: string; autor: string; arquivo: Blob; criadoEm: number }
export type EstadoEnvio = { id: string; exercicioId: string; alunoId: string; tipo: TipoMidia; progresso: number; fase: 'enviando' | 'parado' | 'pronto'; erro?: string }

// ---- Estado em memória (vários cartões olham o mesmo envio) ----
let estados = new Map<string, EstadoEnvio>()
const ouvintes = new Set<() => void>()
const publicar = (e: EstadoEnvio | { id: string; remover: true }) => {
  estados = new Map(estados)
  if ('remover' in e) estados.delete(e.id)
  else estados.set(e.id, e)
  ouvintes.forEach((f) => f())
}
export const useEnvios = () =>
  useSyncExternalStore(
    (f) => (ouvintes.add(f), () => ouvintes.delete(f)),
    () => estados,
  )
const controles = new Map<string, AbortController>()

// ---- IndexedDB (só o necessário) ----
const BANCO = 'forca-videos'
function banco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('envios', { keyPath: 'id' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => falha(r.error)
  })
}
async function idb<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const b = await banco()
  return new Promise((ok, falha) => {
    const t = b.transaction('envios', modo)
    const r = f(t.objectStore('envios'))
    t.oncomplete = () => (b.close(), ok(r.result as T))
    t.onerror = () => (b.close(), falha(t.error))
  })
}
const guardar = (g: Guardado) => idb<void>('readwrite', (s) => s.put(g)).catch(() => {}) // sem IndexedDB: segue sem retomada
const tirar = (id: string) => idb<void>('readwrite', (s) => s.delete(id)).catch(() => {})
const ler = (id: string) => idb<Guardado | undefined>('readonly', (s) => s.get(id)).catch(() => undefined)
const todos = () => idb<Guardado[]>('readonly', (s) => s.getAll()).catch(() => [] as Guardado[])

// ---- Worker ----
async function token() {
  const t = await auth.currentUser?.getIdToken()
  if (!t) throw new Error('Entre de novo para enviar.')
  return t
}
// O Firestore está com App Check "Aplicado": o Worker lê/grava midias/{id} com o token de quem chama e repassa
// este cabeçalho (sem ele, 403). Mesmo esquema de lib/push.ts.
async function tokenAppCheck(): Promise<string | undefined> {
  const { appCheck } = await import('./firebase')
  if (!appCheck) return undefined
  try {
    const { getToken } = await import('firebase/app-check')
    return (await getToken(appCheck, false)).token
  } catch {
    return undefined
  }
}
async function chamar(caminho: string, init: RequestInit & { json?: object }, sinal?: AbortSignal): Promise<Response> {
  if (!BASE) throw new Error('Vídeos indisponíveis.')
  const h = cabecalhosPush(await token(), init.method === 'PUT' ? undefined : await tokenAppCheck())
  const { json, ...resto } = init
  if (!json) delete h['Content-Type']
  return fetch(juntarUrl(BASE, caminho), { method: 'POST', ...resto, headers: h, body: json ? JSON.stringify(json) : resto.body, signal: sinal })
}
const erroDe = async (r: Response) => {
  if (r.status === 507) return 'Espaço de vídeos cheio. Avise o coach.'
  if (r.status === 429) return 'Muitos envios seguidos. Tente daqui a pouco.'
  if (r.status === 403 || r.status === 401) return 'Sem permissão para enviar.'
  return 'Não deu para enviar. Tente de novo.'
}
const esperar = (ms: number, sinal: AbortSignal) =>
  new Promise<void>((ok, falha) => {
    const t = setTimeout(ok, ms)
    sinal.addEventListener('abort', () => (clearTimeout(t), falha(new DOMException('cancelado', 'AbortError'))), { once: true })
  })

// Manda o que falta e conclui. Cada parte tenta 3 vezes (rede instável); depois para e deixa "Retomar".
async function subir(g: Guardado) {
  const c = new AbortController()
  controles.set(g.id, c)
  const base: EstadoEnvio = { id: g.id, exercicioId: g.exercicioId, alunoId: g.alunoId, tipo: g.tipo, progresso: 0, fase: 'enviando' }
  publicar(base)
  try {
    const r = await chamar('/midia/iniciar', { json: { id: g.id, bytes: g.arquivo.size, mime: g.mime } }, c.signal)
    if (!r.ok) throw new Error(await erroDe(r))
    const { faltam } = (await r.json()) as { faltam: number[] }
    const total = Math.ceil(g.arquivo.size / PARTE)
    let feitas = total - faltam.length
    publicar({ ...base, progresso: feitas / total })
    for (const n of faltam) {
      const corpo = g.arquivo.slice(n * PARTE, (n + 1) * PARTE)
      for (let tentativa = 0; ; tentativa++) {
        let p: Response | null = null
        try {
          p = await chamar(`/midia/parte?id=${g.id}&n=${n}`, { method: 'PUT', body: corpo }, c.signal)
        } catch (e) {
          if (c.signal.aborted) throw e // cancelado; erro de rede tenta de novo
        }
        if (p?.ok) break
        if (p && p.status < 500 && p.status !== 429) throw new Error(await erroDe(p))
        if (tentativa >= 2) throw new Error('Conexão caiu. Toque em Retomar.')
        await esperar(1500 * (tentativa + 1), c.signal)
      }
      feitas++
      publicar({ ...base, progresso: feitas / total })
    }
    const f = await chamar('/midia/concluir', { json: { id: g.id } }, c.signal)
    if (!f.ok) throw new Error(await erroDe(f))
    // Respondeu a um envio do aluno: tira da fila do coach.
    if (g.tipo === 'orientacao' && g.respondeA)
      await updateDoc(doc(db, 'midias', g.respondeA), { respondida: true, respondidaEm: serverTimestamp() }).catch(() => {})
    await tirar(g.id)
    publicar({ ...base, progresso: 1, fase: 'pronto' })
    setTimeout(() => publicar({ id: g.id, remover: true }), 4000)
  } catch (e) {
    if (c.signal.aborted) return
    publicar({ ...base, progresso: estados.get(g.id)?.progresso ?? 0, fase: 'parado', erro: e instanceof Error && e.message ? e.message : 'Não deu para enviar.' })
  } finally {
    controles.delete(g.id)
  }
}

// Cria o registro (o Firestore precisa estar online: sem ele o Worker não aceita) e começa o envio.
export async function enviarVideo(p: PedidoEnvio, arquivo: Blob): Promise<string> {
  const autor = auth.currentUser?.uid
  if (!autor) throw new Error('Entre de novo para enviar.')
  const ref = doc(collection(db, 'midias'))
  if (!navigator.onLine) throw new Error('Sem internet. Envie quando a conexão voltar.')
  await setDoc(ref, {
    alunoId: p.alunoId, autor, tipo: p.tipo, exercicioId: p.exercicioId, exercicio: p.exercicio.slice(0, 80), sessao: p.sessao,
    status: 'enviando', bytes: arquivo.size, mime: p.mime, duracaoS: Math.round(p.duracaoS * 10) / 10, em: serverTimestamp(),
    ...(p.tipo === 'execucao' ? { respondida: false } : {}),
    ...(p.respondeA ? { respondeA: p.respondeA } : {}),
  })
  const g: Guardado = { ...p, id: ref.id, autor, arquivo, criadoEm: Date.now() }
  await guardar(g)
  void subir(g)
  return ref.id
}

export async function retomarEnvio(id: string) {
  if (controles.has(id)) return
  const g = await ler(id)
  if (!g) return publicar({ ...(estados.get(id) ?? { id, exercicioId: '', alunoId: '', tipo: 'execucao', progresso: 0 }), fase: 'parado', erro: 'O vídeo não está mais no aparelho. Grave de novo.' })
  await subir(g)
}

// Cancela: para o envio, apaga o arquivo no Worker e o registro (as regras só deixam enquanto 'enviando').
export async function cancelarEnvio(id: string) {
  controles.get(id)?.abort()
  publicar({ id, remover: true })
  await tirar(id)
  await chamar('/midia/apagar', { json: { id } }).catch(() => {})
  await deleteDoc(doc(db, 'midias', id)).catch(() => {})
}

// Ao abrir o app: mostra como "parado" os envios desta conta que ficaram no aparelho (o aluno escolhe retomar).
let conferido = false
export async function envioPendentes(uid: string) {
  if (conferido) return
  conferido = true
  for (const g of await todos()) {
    if (g.autor !== uid) continue
    // Mais de 23 h: o Worker já apagou as partes (órfão). Recomeça do zero com o mesmo registro não dá: descarta.
    if (Date.now() - g.criadoEm > 23 * 3600_000) {
      await tirar(g.id)
      await deleteDoc(doc(db, 'midias', g.id)).catch(() => {})
      continue
    }
    if (!estados.has(g.id)) publicar({ id: g.id, exercicioId: g.exercicioId, alunoId: g.alunoId, tipo: g.tipo, progresso: 0, fase: 'parado', erro: 'Envio interrompido.' })
  }
}

// Link curto para tocar um vídeo privado (o Worker confere, pelo Firestore, se quem pede pode ver).
export async function linkVideo(id: string): Promise<string> {
  const r = await chamar('/midia/link', { json: { id } })
  if (r.status === 404) throw new Error('Vídeo indisponível (expirou ou ainda está chegando).')
  if (!r.ok) throw new Error(r.status === 403 ? 'Sem permissão para ver.' : 'Não deu para abrir o vídeo.')
  return ((await r.json()) as { url: string }).url
}

// Saída segura da conta: vídeo privado não fica no aparelho de quem saiu (aparelho compartilhado).
// Quantos envios ainda não terminaram neste aparelho (para a pessoa decidir antes de sair).
export async function enviosNoAparelho(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0
  return new Set([...(await todos()).map((g) => g.id), ...controles.keys()]).size
}

// Cancela tudo (ainda com o login válido: apaga arquivo no Worker e registro) e apaga o banco local inteiro.
export async function descartarEnviosAoSair() {
  if (typeof indexedDB === 'undefined') return
  const ids = new Set([...(await todos()).map((g) => g.id), ...controles.keys()])
  await Promise.all([...ids].map((id) => Promise.race([cancelarEnvio(id), new Promise((r) => setTimeout(r, 3000))])))
  await new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase(BANCO)
    r.onsuccess = r.onerror = r.onblocked = () => ok()
  })
}
