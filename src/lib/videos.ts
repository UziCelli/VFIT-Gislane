// Vídeos de demonstração do catálogo (aba Vídeos do coach): o que falta gravar, o que já foi gravado e o que já está no ar.
// Firestore: videos/{exercicioId} = { status, link?, nota?, por, em }. Sem documento = "A gravar".
// O vídeo fica fora do app (YouTube "não listado", sem custo): o app guarda só o link. Funções puras.
import catalogo from '../data/exercicios.json'
import { norm } from './busca'

export type StatusVideo = 'gravar' | 'gravado' | 'no-ar'
export const STATUS_VIDEO: { id: StatusVideo; rotulo: string }[] = [
  { id: 'gravar', rotulo: 'A gravar' },
  { id: 'gravado', rotulo: 'Gravado' },
  { id: 'no-ar', rotulo: 'No ar' },
]
export const rotuloStatus = (s: StatusVideo) => STATUS_VIDEO.find((x) => x.id === s)!.rotulo

// Mesmos limites de firestore.rules (match /videos).
export const MAX_LINK = 300
export const MAX_NOTA = 140

export type DocVideo = { id: string; status?: unknown; link?: unknown; nota?: unknown; por?: unknown }
export type LinhaVideo = { id: string; nome: string; grupo: string; status: StatusVideo; link?: string; nota?: string; por?: string }

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export const linkValido = (t: string) => t.length <= MAX_LINK && /^https:\/\/[^\s]+$/.test(t.trim())

type Catalogo = { grupo: string; exercicios: { id: string; nome: string }[] }[]

// Uma linha por exercício do catálogo, na ordem do catálogo. Documento de exercício que saiu do catálogo é ignorado.
// Status desconhecido (gravação de versão futura) conta como "A gravar", mas mantém link e nota.
export function linhasVideos(docs: DocVideo[], cat: Catalogo = catalogo): LinhaVideo[] {
  const porId = new Map(docs.map((d) => [d.id, d]))
  return cat.flatMap((g) =>
    g.exercicios.map((e) => {
      const d = porId.get(e.id)
      const status: StatusVideo = d?.status === 'gravado' || d?.status === 'no-ar' ? d.status : 'gravar'
      return { id: e.id, nome: e.nome, grupo: g.grupo, status, link: texto(d?.link), nota: texto(d?.nota), por: texto(d?.por) }
    }),
  )
}

export function contarVideos(linhas: LinhaVideo[]) {
  const n = (s: StatusVideo) => linhas.filter((l) => l.status === s).length
  return { total: linhas.length, gravar: n('gravar'), gravado: n('gravado'), noAr: n('no-ar') }
}

// Filtro por status + busca por nome ou grupo (sem acento, todas as palavras).
export function filtrarVideos(linhas: LinhaVideo[], status: StatusVideo, busca: string): LinhaVideo[] {
  const termos = norm(busca).trim().split(/\s+/).filter(Boolean)
  return linhas.filter((l) => l.status === status && termos.every((t) => norm(`${l.nome} ${l.grupo}`).includes(t)))
}

// O que gravar: null = voltar para "A gravar" (apaga o documento). "No ar" exige link válido.
export function dadosVideo(status: StatusVideo, link: string, nota: string, por: string) {
  if (status === 'gravar') return null
  const l = link.trim()
  const n = nota.trim().slice(0, MAX_NOTA)
  if (l && !linkValido(l)) return { erro: 'Link precisa começar com https://' } as const
  if (status === 'no-ar' && !l) return { erro: 'Cole o link do vídeo para marcar "No ar".' } as const
  return { dados: { status, por: por.trim().slice(0, 80) || 'Coach', ...(l ? { link: l } : {}), ...(n ? { nota: n } : {}) } } as const
}
