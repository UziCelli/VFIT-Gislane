// Vídeos privados do treino (#253): execução do aluno e orientação falada do coach. Funções puras.
// Firestore: midias/{id} (regras em firestore.rules). Arquivo no Worker push/ (rotas /midia/*). Plano: docs/plano-videos.md.
import { norm } from './busca'
import { idDoCatalogo } from './videos'

// Desligado até o Victor autorizar (custo e privacidade). Nos testes (emulador) fica ligado com o Worker simulado.
export const VIDEOS_PRIVADOS =
  !!import.meta.env.VITE_PUSH_URL && (import.meta.env.VITE_VIDEOS_PRIVADOS === '1' || import.meta.env.VITE_USE_EMULATOR === '1')

export const MAX_S_ALUNO = 60
export const MAX_S_COACH = 90
export const MAX_BYTES = 50 * 1024 * 1024 // mesmo teto de push/src/midia.ts e das regras
export const PARTE = 1024 * 1024
export const MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const
export type Mime = (typeof MIMES)[number]
export type TipoMidia = 'execucao' | 'orientacao'

// Marcação do coach num quadro do vídeo do aluno (etapa 3). t = segundo do vídeo; p = [x1, y1, x2, y2, ...] de 0 a 1
// (proporcional ao quadro: vale em qualquer tamanho de tela e rotação). k = traço da caneta ou ponto.
export type Marca = { t: number; k: 'caneta' | 'ponto'; p: number[] }

export type Sessao = { mesoId: string; semana: number; treino: number }
export type DocMidia = {
  id: string
  alunoId: string
  autor: string
  tipo: TipoMidia
  exercicioId: string
  exercicio: string
  sessao: Sessao
  status: 'enviando' | 'pronto'
  bytes: number
  mime: Mime
  duracaoS: number
  em?: { toMillis(): number } | null
  prontoEm?: { toMillis(): number } | null
  respondida?: boolean
  respondeA?: string
  marcas?: Marca[]
  vistoEm?: unknown
}

const ms = (t: { toMillis(): number } | null | undefined) => t?.toMillis?.() ?? 0

// Chave do exercício: id do catálogo; fora do catálogo, o nome normalizado (a orientação reaparece pelo nome).
export function chaveExercicio(nome: string): string {
  const cat = idDoCatalogo(nome)
  if (cat) return cat
  const slug = norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 88)
  return `x-${slug || 'exercicio'}`
}

// Tipo do arquivo: o que o navegador disser, desde que seja um dos aceitos ("video/mp4;codecs=..." vira "video/mp4").
export function mimeOk(tipo: string): Mime | null {
  const t = tipo.split(';')[0].trim().toLowerCase()
  return MIMES.find((m) => m === t) ?? null
}

// Confere o arquivo antes de enviar. Devolve a mensagem de erro (curta, para o aluno) ou null.
export function conferirArquivo(a: { bytes: number; tipo: string; duracaoS: number }, maxS: number): string | null {
  if (!mimeOk(a.tipo)) return 'Formato de vídeo não aceito.'
  if (!(a.duracaoS > 0)) return 'Não deu para ler o vídeo.'
  if (a.duracaoS > maxS + 0.5) return `Vídeo longo demais: até ${maxS} s.`
  if (a.bytes > MAX_BYTES) return 'Vídeo grande demais (até 50 MB). Grave pelo app.'
  return null
}

// Por exercício, do mesmo aluno: a orientação pronta mais recente (aparece nos próximos treinos que tiverem o exercício)
// e a última execução enviada (para "Aguardando análise"). O histórico inteiro continua no Firestore.
export type Resumo = { orientacao?: DocMidia; execucao?: DocMidia }
export function resumoPorExercicio(lista: DocMidia[]): Map<string, Resumo> {
  const m = new Map<string, Resumo>()
  for (const d of lista) {
    const r = m.get(d.exercicioId) ?? {}
    if (d.tipo === 'orientacao' && d.status === 'pronto') {
      if (!r.orientacao || ms(d.prontoEm) > ms(r.orientacao.prontoEm)) r.orientacao = d
    } else if (d.tipo === 'execucao') {
      if (!r.execucao || ms(d.em) > ms(r.execucao.em)) r.execucao = d
    }
    m.set(d.exercicioId, r)
  }
  return m
}

// Situação do envio do aluno, para o cartão.
export type Situacao = 'nada' | 'enviando' | 'aguardando' | 'respondida'
export function situacaoExecucao(r: Resumo | undefined): Situacao {
  const e = r?.execucao
  if (!e) return 'nada'
  if (e.status !== 'pronto') return 'enviando'
  if (e.respondida) return 'respondida'
  // Orientação mais nova que o envio também conta como resposta (coach respondeu pelo cartão).
  if (r?.orientacao && ms(r.orientacao.prontoEm) >= ms(e.prontoEm ?? e.em)) return 'respondida'
  return 'aguardando'
}

// Fila do coach: execuções prontas sem resposta, mais antigas primeiro (quem esperou mais).
export const filaDoCoach = (lista: DocMidia[]) =>
  lista.filter((d) => d.tipo === 'execucao' && d.status === 'pronto' && !d.respondida).sort((a, b) => ms(a.prontoEm ?? a.em) - ms(b.prontoEm ?? b.em))

// Marcações: só números de 0 a 1, tempo >= 0, até 300 itens e 400 pontos por traço (limites das regras/doc).
export const MAX_MARCAS = 300
export function limparMarcas(v: unknown): Marca[] {
  if (!Array.isArray(v)) return []
  const ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1
  return v
    .filter((m): m is Marca =>
      !!m && typeof m === 'object' && (m.k === 'caneta' || m.k === 'ponto') && typeof m.t === 'number' && m.t >= 0 && Array.isArray(m.p) && m.p.length >= 2 && m.p.length % 2 === 0 && m.p.length <= 800 && m.p.every(ok))
    .slice(0, MAX_MARCAS)
}

// Marcas visíveis num instante: as do quadro em que o coach pausou (±0,4 s) — no player elas aparecem nesse trecho.
export const JANELA_MARCA = 0.4
export const marcasNoTempo = (marcas: Marca[], t: number) => marcas.filter((m) => Math.abs(m.t - t) <= JANELA_MARCA)
// Momentos com marcação (para o aluno pular direto): tempos distintos, em ordem.
export const momentosMarcados = (marcas: Marca[]) => [...new Set(marcas.map((m) => Math.round(m.t * 10) / 10))].sort((a, b) => a - b)

// Reduz um traço da caneta: descarta ponto a menos de `min` (proporção) do anterior. Mantém o último.
export function simplificar(p: number[], min = 0.004): number[] {
  if (p.length <= 4) return p
  const out = [p[0], p[1]]
  for (let i = 2; i < p.length; i += 2) {
    const dx = p[i] - out[out.length - 2]
    const dy = p[i + 1] - out[out.length - 1]
    if (Math.hypot(dx, dy) >= min || i === p.length - 2) out.push(p[i], p[i + 1])
  }
  return out.slice(0, 800).map((x) => Math.round(x * 1000) / 1000)
}

// Borracha: apaga as marcas do instante atual que passam perto do toque (raio em proporção do quadro).
export function apagarPerto(marcas: Marca[], t: number, x: number, y: number, raio = 0.04): Marca[] {
  return marcas.filter((m) => {
    if (Math.abs(m.t - t) > JANELA_MARCA) return true
    for (let i = 0; i < m.p.length; i += 2) if (Math.hypot(m.p[i] - x, m.p[i + 1] - y) <= raio) return false
    return true
  })
}
