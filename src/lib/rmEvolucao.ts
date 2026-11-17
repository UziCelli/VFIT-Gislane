// Painel do coach: 1RM estimado por exercício, tendência e esforço médio (repetições que sobraram). Funções puras.
// O 1RM é "por baixo": a série raramente vai à falha, então cada repetição guardada subestima uns 2,5%. Usa só séries comuns
// até 15 reps (tabela de Nuzzo, engine/rm.ts); ficam de fora isometria, 2 lados, peso do corpo e drops.
import { corrigirDigitacao, isometrico, prescreverSessao, repsEfetivas, rmEstimado, type Meso } from '../engine'
import { docsParaRegistros, docsParaRegistrosReps, docsParaRegistrosRir, lerPc, type RegistroDoc } from './conversores'
import { doisLados } from './lados'
import { corpoEhCarga } from './pesoCorporal'

export type PontoRmCoach = { mesoId: string; semana: number; treino: number; rm: number; rir: number | null }
type Reg = RegistroDoc & { mesoId: string }

// Um ponto por treino em que o exercício (pelo nome) teve alguma série válida: o maior 1RM implícito das séries (já sem erro
// de digitação óbvio) e a resposta de "quantas ainda faria" da última série normal. Ordem: meso (como veio), semana, treino.
export function pontosRm(mesos: { id: string; meso: Meso }[], registros: Reg[], nome: string): PontoRmCoach[] {
  const out: PontoRmCoach[] = []
  for (const { id, meso } of mesos) {
    const docs = registros.filter((r) => r.mesoId === id)
    if (!docs.length) continue
    const cargas = docsParaRegistros(docs, meso)
    const reps = docsParaRegistrosReps(docs)
    const rir = docsParaRegistrosRir(docs)
    const pcs = Object.fromEntries(docs.map((d) => [`${d.semana}-${d.treino}`, lerPc(d.pc)]))
    for (const d of [...docs].sort((a, b) => a.semana - b.semana || a.treino - b.treino)) {
      const chave = `${d.semana}-${d.treino}`
      for (const e of prescreverSessao(meso, d.semana, d.treino)?.exercicios ?? []) {
        if (e.slot.nome !== nome || doisLados(e.slot) || isometrico(e.slot) || corpoEhCarga(nome)) continue
        if ((pcs[chave]?.[e.slot.slotId] ?? 0) > 0) continue
        const kgs = (cargas[chave]?.[e.slot.slotId] ?? []).slice(0, e.n)
        const feitas = repsEfetivas(e.reps, reps[chave]?.[e.slot.slotId]).slice(0, e.n)
        const limpo = corrigirDigitacao(kgs, feitas).series
        const rms = limpo.flatMap((kg, k) => {
          const r = kg == null ? null : rmEstimado(kg, feitas[k])
          return r == null ? [] : [r]
        })
        if (!rms.length) continue
        out.push({ mesoId: id, semana: d.semana, treino: d.treino, rm: Math.max(...rms), rir: rir[chave]?.[e.slot.slotId]?.[e.n - 1] ?? null })
      }
    }
  }
  return out
}

export const TOLERANCIA_TENDENCIA = 0.02 // até ±2% é "estável": ruído do dia
const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length

// Tendência do 1RM: média dos 2 últimos treinos contra a dos até 4 anteriores. Com menos de 3 treinos, não opina (null).
export function tendenciaRm(rms: number[]): { sentido: 'subindo' | 'estavel' | 'caindo'; pct: number } | null {
  const v = rms.slice(-6)
  if (v.length < 3) return null
  const pct = media(v.slice(-2)) / media(v.slice(0, -2)) - 1
  return { sentido: pct > TOLERANCIA_TENDENCIA ? 'subindo' : pct < -TOLERANCIA_TENDENCIA ? 'caindo' : 'estavel', pct }
}

// Esforço médio: repetições que sobraram, nas últimas 5 respostas. null sem resposta.
export function rirMedio(pontos: PontoRmCoach[]): { media: number; respostas: number } | null {
  const v = pontos.flatMap((p) => (p.rir == null ? [] : [p.rir])).slice(-5)
  return v.length ? { media: media(v), respostas: v.length } : null
}
