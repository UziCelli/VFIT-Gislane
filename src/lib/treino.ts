// Ajudas da tela do aluno. Funções puras.
import { prescreverSessao, type Meso, type Registros } from '../engine'
import { diaSP } from './acesso'
import { doisLados, lerCelula } from './lados'

// Semana w cobre os dias [inicio + 7(w−1), inicio + 7w), contados no calendário de São Paulo.
export function semanaAtual(meso: Meso, hoje: Date) {
  const d = diaSP(hoje.getTime()) - diaSP(Date.parse(`${meso.inicio.slice(0, 10)}T00:00-03:00`))
  if (d < 0) return { estado: 'antes' as const, semana: 1, diasParaComecar: -d }
  const semana = Math.floor(d / 7) + 1
  if (semana > meso.semanas) return { estado: 'depois' as const, semana: meso.semanas }
  return { estado: 'durante' as const, semana }
}

// Cargas da última vez em que o aluno anotou o mesmo exercício (pelo nome, já com trocas e sessões editadas).
// 1º, o mesmo treino da semana anterior mais recente (mesma prescrição; de preferência na mesma posição).
// Sem isso (o exercício é novo neste treino), qualquer outro treino: primeiro os anteriores da MESMA semana (do mais
// perto para o 1º), depois os das semanas anteriores (do último treino para o 1º). Lida pelo slotId daquele registro.
// `origem` (semana e treino de onde saiu) deixa a tela avisar quando não é o mesmo treino.
// Devolve `series` (S1..Sn daquele registro) e `drops` separados: o n muda entre registros. `drops[j]` segue os drops
// de hoje: a mesma etapa da mesma série naquele registro, senão a mesma etapa de outra série (o drop mudou de série).
// Sem `pcs`, devolve o total gravado. Com `pcs` (`${semana}-${treino}` -> { slotId: kg do corpo }),
// devolve só o extra: total menos o corpo DAQUELE registro (o de hoje pode ser outro), nunca negativo.
export function cargaAnterior(
  meso: Meso,
  registros: Registros,
  semana: number,
  treino: number,
  pos: number,
  pcs?: Record<string, Record<string, number> | undefined>,
  lados?: Registros, // lado esquerdo por série (docsParaLados); só usado em exercício de 2 lados
) {
  const hoje = prescreverSessao(meso, semana, treino)?.exercicios[pos - 1]
  const alvo = hoje?.slot
  if (!hoje || !alvo) return null
  const dois = doisLados(alvo)
  const tentar = (w: number, t: number) => {
    const chave = `${w}-${t}`
    const reg = registros[chave]
    if (!reg) return null // sem registro: nem monta a sessão daquele dia
    const exs = prescreverSessao(meso, w, t)?.exercicios ?? []
    // 2 lados: só vale célula no formato novo (a antiga não diz se o número era por lado ou total).
    const comCarga = (e: (typeof exs)[number]) => {
      const cs = reg[e.slot.slotId]
      const ls = lados?.[chave]?.[e.slot.slotId]
      return e.slot.nome === alvo.nome && !!cs?.some((c, i) => c != null && (!dois || ls?.[i] != null))
    }
    const e = (t === treino ? [exs[pos - 1], ...exs] : exs).find((x) => x && comCarga(x))
    if (!e) return null
    const cargas = reg[e.slot.slotId]
    const corpo = pcs?.[chave]?.[e.slot.slotId] ?? 0
    const cels = dois ? cargas.map((c, i) => lerCelula(c, lados?.[chave]?.[e.slot.slotId]?.[i], corpo)) : null
    const extra = cels ? cels.map((c) => c.esq) : corpo > 0 ? cargas.map((c) => (c == null ? null : Math.max(0, Math.round((c - corpo) * 100) / 100))) : cargas
    const fatiar = (v: (number | null | undefined)[]) => ({
      series: v.slice(0, e.n).map((x) => x ?? null),
      drops: hoje.drops.map(({ serie, etapa }) => {
        const j = e.drops.findIndex((d) => d.serie === serie && d.etapa === etapa)
        const k = j >= 0 ? j : e.drops.findIndex((d) => d.etapa === etapa)
        return k >= 0 ? (v[e.n + k] ?? null) : null
      }),
    })
    // `dir`: lado direito (só em 2 lados); `series`/`drops` ficam com o esquerdo.
    return { ...fatiar(extra), ...(cels && { dir: fatiar(cels.map((c) => c.dir)) }), origem: { semana: w, treino: t } }
  }
  for (let w = semana - 1; w >= 1; w--) {
    const r = tentar(w, treino)
    if (r) return r
  }
  // Exercício novo neste treino: a carga mais recente em outro treino (hoje a semana atual já pode ter sido feita antes).
  for (let w = semana; w >= 1; w--) {
    for (let t = w === semana ? treino - 1 : meso.frequencia; t >= 1; t--) {
      const r = t === treino ? null : tentar(w, t)
      if (r) return r
    }
  }
  return null
}
