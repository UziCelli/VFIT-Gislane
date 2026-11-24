// Monta os pontos (carga x reps por série) de cada exercício a partir dos registros e ajusta o modelo pessoal (engine/rmPessoal.ts).
// Fora do modelo: peso do corpo, isometria e drops (ver docs/estimativa-rm.md). 2 lados entra pela MÉDIA por lado
// ((esq + dir) / 2), só célula no formato novo (a antiga não diz se era por lado ou total). Exercício casa pelo nome
// normalizado + 2 lados + isometria, a mesma regra de `cargaAnterior` para o meso anterior (modelo de 2 lados é outro).
import { ajustarRm, isometrico, prescreverSessao, repsEfetivas, type ModeloRm, type PontoRm } from '../engine'
import { normalizar } from './iaTreino'
import { doisLados, lerCelula } from './lados'
import { corpoEhCarga } from './pesoCorporal'
import type { Fonte } from './treino'

export const chaveModelo = (nome: string, dois: boolean, iso: boolean) => `${normalizar(nome)}|${dois ? 2 : 1}|${iso ? 'i' : 'd'}`

// `antes`: só entra o que foi feito antes deste (semana, treino) (o treino de hoje e os posteriores ficam de fora).
// `deslocamento`: semanas somadas ao tempo (o meso anterior termina logo antes da semana 1 do atual).
function pontosDe(f: Fonte, deslocamento: number, antes: { semana: number; treino: number } | null, out: Map<string, PontoRm[]>) {
  for (const chave of Object.keys(f.registros)) {
    const [w, t] = chave.split('-').map(Number)
    if (!(w >= 1 && t >= 1)) continue
    if (antes && (w > antes.semana || (w === antes.semana && t >= antes.treino))) continue
    const reg = f.registros[chave]
    for (const e of prescreverSessao(f.meso, w, t)?.exercicios ?? []) {
      const dois = doisLados(e.slot)
      const iso = isometrico(e.slot)
      if (iso || corpoEhCarga(e.slot.nome) || (f.pcs?.[chave]?.[e.slot.slotId] ?? 0) > 0) continue
      const cargas = reg[e.slot.slotId]
      if (!cargas) continue
      const feitas = repsEfetivas(e.reps, f.reps?.[chave]?.[e.slot.slotId])
      const tempo = w + (t - 1) / Math.max(1, f.meso.frequencia) + deslocamento
      const k = chaveModelo(e.slot.nome, dois, iso)
      for (let s = 0; s < e.n; s++) {
        const cel = dois ? lerCelula(cargas[s], f.lados?.[chave]?.[e.slot.slotId]?.[s]) : null
        const kg = cel ? (cel.esq != null && cel.dir != null ? (cel.esq + cel.dir) / 2 : null) : cargas[s]
        if (kg == null || !(kg > 0)) continue
        out.set(k, [...(out.get(k) ?? []), { t: tempo, sessao: `${deslocamento}|${chave}`, kg, reps: feitas[s], serie: s }])
      }
    }
  }
}

// Um modelo por exercício que tenha ao menos um ponto válido (reps 1..15). `anterior` (meso anterior) entra com o tempo deslocado.
export function modelosPorExercicio(atual: Fonte, antes: { semana: number; treino: number }, anterior?: Fonte | null): Map<string, ModeloRm> {
  const pontos = new Map<string, PontoRm[]>()
  if (anterior) pontosDe(anterior, -anterior.meso.semanas, null, pontos)
  pontosDe(atual, 0, antes, pontos)
  const out = new Map<string, ModeloRm>()
  for (const [k, ps] of pontos) {
    const m = ajustarRm(ps)
    if (m) out.set(k, m)
  }
  return out
}
