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
  // "No ar" aparece no cartão do aluno: só o player do YouTube abre dentro do app (CSP: frame-src youtube-nocookie).
  if (status === 'no-ar' && !fonteDemo(l)) return { erro: 'Para o aluno ver no app, use um link do YouTube.' } as const
  return { dados: { status, por: por.trim().slice(0, 80) || 'Coach', ...(l ? { link: l } : {}), ...(n ? { nota: n } : {}) } } as const
}

// ---- Demonstração no cartão do exercício (#253, etapa 1) ----
// O aluno só vê o que está "No ar" com link do YouTube: o player é o embed sem cookies, mudo e em loop, criado só
// quando ele toca "Ver demonstração" (nada é baixado com o cartão fechado).

const idPorNome = new Map(catalogo.flatMap((g) => g.exercicios.map((e) => [norm(e.nome.trim()), e.id] as const)))

// Id do catálogo pelo nome do exercício no treino; fora do catálogo = undefined (sem demonstração).
export const idDoCatalogo = (nome: string) => idPorNome.get(norm(nome.trim()))

// youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID (com ou sem www./m.).
const RE_YT = /^https:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/][^\s]*)?$/

export type FonteDemo = { src: string; vertical: boolean }

// Endereço do player embutido; link que não é do YouTube = null (o cartão não mostra o botão).
export function fonteDemo(link: string | undefined): FonteDemo | null {
  const m = link?.trim().match(RE_YT)
  if (!m) return null
  const id = m[1]
  // autoplay só depois do toque (o iframe nasce no toque); mute porque a demonstração é sem áudio.
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1`
  return { src, vertical: /\/shorts\//.test(link!) }
}
