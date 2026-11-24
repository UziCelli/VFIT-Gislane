import { cargaPolimento } from './degrauPolimento'
import { isometrico } from './isometria'
import { metodosDaSessao, prescreverSessao } from './sessao'
import type { AlvoVolume, ExercicioPrescrito, Meso, PolimentoExercicio, Registros } from './tipos'
import { fracaoPolimento, type TipoPolimento } from './volume'

type Historico = { meso: Meso; completos: ReadonlySet<string>; protegidos: ReadonlySet<string>; cargas: Registros; reps: Registros; semKgNoPlano?: (e: ExercicioPrescrito) => boolean; semKg?: (chave: string, e: ExercicioPrescrito) => boolean; lados?: Registros; doisLados?: (e: ExercicioPrescrito) => boolean }
type Opcoes = { pct: number; semanas: number[]; alvo: AlvoVolume; tipo: TipoPolimento; degraus: PolimentoExercicio['degraus']; folga?: number; historico: Historico; hoje: string }
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const chave = (w: number, t: number) => `${w}-${t}`
const movimentos = (e: ExercicioPrescrito) => e.reps.slice(0, e.n)
const valida = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
const qtdTreinos = (m: Meso) => Array.from({ length: m.frequencia }, (_, i) => i + 1)

// Remove séries inteiras, sem subir as reps de nenhuma série. Dentro desse limite, preenche
// até o alvo; quando nem uma repetição cabe, mantém uma e deixa a prévia sinalizar a diferença.
export function seriesPolimento(reps: number[], kg: number[], alvo: number): number[] {
  if (!reps.length) return []
  const total = (n: number) => soma(reps.slice(0, n).map((r, i) => r * kg[i]))
  let n = reps.length
  while (n > 1 && total(n - 1) >= alvo - 1e-8) n--
  // Se nenhuma série inteira puder sair, não force uma queda muito maior que a escolhida.
  const novas = reps.slice(0, n)
  let restante = total(n)
  while (restante > alvo + 1e-8) {
    let i = novas.length - 1
    for (let j = i - 1; j >= 0; j--) if (novas[j] > novas[i]) i = j
    if (novas[i] <= 1) break
    novas[i]--
    restante -= kg[i]
  }
  return novas
}

const selecionado = (m: Meso, a: AlvoVolume, t: number, e: ExercicioPrescrito) =>
  a.tipo === 'todos' || (a.tipo === 'treino' ? a.treino === t : a.tipo === 'exercicios' ? a.slotIds.includes(e.slot.slotId) : 'slotId' in a ? a.slotId === e.slot.slotId : m.divisao[a.treino - 1]?.[a.pos - 1]?.slotId === e.slot.slotId && a.treino === t)

const comparavel = (a: ExercicioPrescrito, b: ExercicioPrescrito) =>
  a.slot.slotId === b.slot.slotId && a.slot.nome === b.slot.nome && a.slot.doisLados === b.slot.doisLados

const comum = (e: ExercicioPrescrito) => e.n > 0 && !e.rotulo && !e.drops.length
const fimSemana = (inicio: string) => {
  const d = new Date(`${inicio}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

export function planejarPolimento(meso: Meso, { pct, semanas, alvo, tipo, degraus, folga, historico: h, hoje }: Opcoes) {
  const marcas = [...new Set(semanas)].filter(w => Number.isInteger(w) && w >= 2 && w <= meso.semanas).sort((a,b) => a-b)
  const polimentos = { ...meso.polimentos }
  const treinos = qtdTreinos(meso)
  const linhas: { semana: number; plano: number; aplicado: number; metaKg: number | null; previstoKg: number | null; base: number[]; ignorados: number; medidos: number; tempoAntes: number; tempoDepois: number }[] = []
  const normal = { ...meso, polimentos: {} }
  if (!marcas.length || !(pct >= 0 && pct <= 100) || (!pct && !folga && !degraus)) return { meso, linhas }
  for (const w of marcas) {
    let inicio = w
    while (marcas.includes(inicio - 1)) inicio--
    let fim = w
    while (marcas.includes(fim + 1)) fim++
    const fator = 1 - pct * fracaoPolimento(tipo, w - inicio + 1, fim - inicio + 1) / 100
    // Não confunda semanas já polidas com uma referência normal, inclusive ao reaplicar.
    let ref = inicio - 1
    while (ref > 1 && treinos.some(t => Object.keys(meso.polimentos?.[chave(ref,t)] ?? {}).length)) ref--
    const alvos = treinos.flatMap(t => {
      const k = chave(w,t)
      const s = prescreverSessao(normal,w,t)
      if (!s) return []
      const congelado = h.protegidos.has(k) || !!meso.prescricoesRegistradas?.[k] || fimSemana(s.inicioSemana) < hoje
      const refSessao = prescreverSessao(normal,ref,t)
      return s.exercicios.filter(e => selecionado(meso,alvo,t,e)).map(e => ({
        t,k,e, inc: comum(e) && !congelado && !meso.sessoes?.[k] && !metodosDaSessao(normal,w,t).some(m => m.ativo && m.exercicio === e.pos),
        ref: refSessao?.exercicios.find(x => comparavel(x,e) && comum(x)),
      }))
    })
    const trataveis = alvos.filter(a => a.inc)
    const candidatas = trataveis.filter(a => !isometrico(a.e.slot) && !h.semKgNoPlano?.(a.e))
    const base: { w: number; amostras: { kg: number[]; reps: number[] }[] }[] = []
    for (let b = ref; candidatas.length && b >= Math.max(1,ref-4) && base.length < 3; b--) {
      const sess = treinos.map(t => prescreverSessao(h.meso,b,t))
      if (marcas.includes(b) || treinos.some((t,i) => !sess[i] || fimSemana(sess[i]!.inicioSemana) >= hoje || (sess[i]!.series > 0 && !h.completos.has(chave(b,t))) || !!meso.polimentos?.[chave(b,t)])) continue
      const amostras = candidatas.map(a => {
        const k = chave(b,a.t)
        const e = sess[a.t-1]?.exercicios.find(x => comparavel(x,a.e) && comum(x) && !x.polimento)
        if (!e || e.n < a.e.n || h.meso.historicoIncerto?.includes(k) || h.semKg?.(k,e)) return null
        const kg = (h.cargas[k]?.[e.slot.slotId] ?? []).slice(0,e.n)
        const reps = (h.reps[k]?.[e.slot.slotId] ?? []).slice(0,e.n)
        return kg.length === e.n && reps.length === e.n && Array.from(kg).every(valida) && Array.from(reps).every(valida) ? { kg: kg as number[], reps: reps as number[] } : null
      })
      if (amostras.every(a => a !== null)) base.push({ w:b, amostras })
    }
    let plano = 0, aplicado = 0, metaKg = 0, previstoKg = 0
    for (const a of trataveis) {
      const atual = movimentos(a.e)
      const refReps = a.ref ? movimentos(a.ref) : atual
      const reps = atual.map((v,i) => Math.min(v, refReps[i] ?? v))
      const idx = candidatas.indexOf(a)
      const amostras = idx >= 0 ? base.map(b => b.amostras[idx]) : []
      const kg = reps.map((_,i) => amostras.length ? soma(amostras.map(x => x.kg[i])) / amostras.length : 1)
      const meta = (amostras.length ? soma(amostras.map(x => soma(x.kg.map((k,i) => k*x.reps[i])))) / amostras.length : soma(refReps)) * fator
      const leves = pct ? seriesPolimento(reps,kg,meta) : atual
      plano += atual.length
      aplicado += leves.length
      if (amostras.length) {
        metaKg += meta
        const dois = h.doisLados?.(a.e) ?? !!a.e.slot.doisLados
        const levesKg = leves.map((_,i) => soma(base.map((b,j) => {
          const total = amostras[j].kg[i]
          const dirigir = (v: number) => cargaPolimento(v, a.e.slot.nome, degraus, dois)
          const esq = h.lados?.[chave(b.w,a.t)]?.[a.e.slot.slotId]?.[i]
          return !degraus ? total : dois ? valida(esq) && total > esq ? dirigir(esq) + dirigir(total-esq) : total : dirigir(total)
        })) / amostras.length)
        previstoKg += soma(leves.map((r,i) => r*levesKg[i]))
      }
      const iso = isometrico(a.e.slot)
      const menor = !iso && !h.semKgNoPlano?.(a.e) ? degraus : 0
      if (!pct && !menor && (iso || !folga)) continue
      const entrada: PolimentoExercicio = { reps: leves, nome: a.e.slot.nome, degraus: menor, ...(!iso && folga && { folga }) }
      polimentos[a.k] = { ...polimentos[a.k], [a.e.slot.slotId]: entrada }
    }
    const somaTempo = (m: Meso) => soma(treinos.map(t => prescreverSessao(m,w,t)?.tempoMin ?? 0))
    linhas.push({ semana:w, plano, aplicado, metaKg:base.length ? metaKg : null, previstoKg:base.length ? previstoKg : null, base:base.map(b=>b.w), ignorados:alvos.length-trataveis.length, medidos:base.length ? candidatas.length : 0, tempoAntes:somaTempo(normal), tempoDepois:somaTempo({...meso,polimentos}) })
  }
  return { meso: Object.keys(polimentos).length ? { ...meso, polimentos } : meso, linhas }
}
