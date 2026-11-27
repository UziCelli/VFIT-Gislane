import type { AplicacaoMetodo, Meso, Sessao } from '../engine/tipos'
import { z } from 'zod'
import { copiaVazia, prescreverSessao } from '../engine/sessao'
import { maquinaSlotSchema, metodoSchema } from './prescricaoSchema'

const numero = z.number().finite()
const snapshotSchema = z.object({
  versao: z.literal(1), referenciaHistorica: z.boolean().optional(),
  sessao: z.object({ semana: z.number().int().min(1).max(12), treino: z.number().int().min(1).max(7), inicioSemana: z.iso.date(), pausaS: numero.min(0).max(3600), series: z.number().int().min(0).max(6), tempoMin: numero.min(0), exercicios: z.array(z.object({ pos: z.number().int().min(1).max(10), slot: z.object({ slotId: z.string().min(1).max(128), nome: z.string().min(1).max(120), pausaS: numero.min(0).max(3600).optional(), doisLados: z.boolean().optional(), maquina: maquinaSlotSchema.optional() }), n: z.number().int().min(0).max(6), polimento: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(), folgaPolimento: z.number().int().min(1).max(5).optional(), reps: z.array(numero).max(42), repsBase: z.array(numero.min(0).max(600)).max(6).optional(), rotulo: z.string().max(2000), cargaSugerida: z.array(numero.nullable()).max(42), pausaS: numero.min(0).max(3600), drops: z.array(z.object({ serie: z.number().int().min(1).max(6), etapa: z.number().int().min(1).max(6) })).max(36) })).max(10) }),
  metodos: z.array(metodoSchema).max(120),
}).superRefine((p, c) => { if (p.sessao.exercicios.some((e) => e.repsBase && e.repsBase.length !== e.n)) c.addIssue({ code: 'custom', message: 'Séries-base incompatíveis.' }); if (p.metodos.some((m) => m.semana !== p.sessao.semana || m.treino !== p.sessao.treino || m.exercicio > p.sessao.exercicios.length)) c.addIssue({ code: 'custom', message: 'Método fora da sessão.' }) })

export type PrescricaoRegistrada = { versao: 1; referenciaHistorica?: boolean; sessao: Sessao; metodos: AplicacaoMetodo[] }

// Campo privado do registro: não é uma fonte de autorização nem altera o plano do coach.
export function lerPrescricaoRegistrada(texto: unknown): PrescricaoRegistrada | null {
  if (typeof texto !== 'string' || texto.length > 60_000) return null
  try {
    const r = snapshotSchema.safeParse(JSON.parse(texto))
    return r.success && !copiaVazia(r.data) ? r.data : null // cópia sem nenhuma série é defeito: o plano vale
  } catch { return null }
}

export function comPrescricoesRegistradas(meso: Meso, registros: { semana: number; treino: number; prescricaoRegistrada?: string; cargas?: Record<string, unknown>; reps?: Record<string, unknown> }[]): Meso {
  const preservadas = Object.fromEntries(Object.entries(meso.prescricoesRegistradas ?? {}).filter(([, p]) => !copiaVazia(p))) as NonNullable<Meso['prescricoesRegistradas']>
  const historicoIncerto = [...(meso.historicoIncerto ?? [])]
  for (const r of registros) {
    const p = lerPrescricaoRegistrada(r.prescricaoRegistrada)
    const chave = `${r.semana}-${r.treino}`
    if (!(chave in preservadas) && p && p.sessao.semana === r.semana && p.sessao.treino === r.treino) preservadas[chave] = p
    if (!(chave in preservadas) && !p) {
      const ids = [...new Set([...Object.keys(r.cargas ?? {}), ...Object.keys(r.reps ?? {})])]
      // Cliente antigo não informa versão: a cópia é uma referência explícita, nunca uma certeza.
      const anteriores = meso.prescricoesAnteriores?.[chave]?.filter((a) => !copiaVazia(a))
      const referencia = anteriores?.find((a) => ids.length > 0 && ids.every((id) => a.sessao.exercicios.some((e) => e.slot.slotId === id))) ?? anteriores?.find((a) => ids.some((id) => a.sessao.exercicios.some((e) => e.slot.slotId === id)))
      if (referencia) {
        const atual = prescreverSessao(meso, r.semana, r.treino)
        const exercicios = [...referencia.sessao.exercicios]
        for (const ex of [...(atual?.exercicios ?? []), ...(anteriores ?? []).flatMap((a) => a.sessao.exercicios)]) {
          if (ids.includes(ex.slot.slotId) && !exercicios.some((e) => e.slot.slotId === ex.slot.slotId)) exercicios.push({ ...ex, pos: exercicios.length + 1 })
        }
        preservadas[chave] = { ...referencia, referenciaHistorica: true, sessao: { ...referencia.sessao, exercicios } }
        historicoIncerto.push(chave)
      }
    }
  }
  for (const [chave, p] of Object.entries(preservadas)) if (p?.referenciaHistorica) historicoIncerto.push(chave)
  return { ...meso, prescricoesRegistradas: preservadas, historicoIncerto: [...new Set(historicoIncerto)] }
}
