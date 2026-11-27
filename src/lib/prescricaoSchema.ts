// Contrato comum ao editor e ao conector: não inclui registros ou sessões presenciais.
import { z } from 'zod'
import { problemasAparelho, type MaquinaTreino } from '../engine/aparelho'
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
export const nomeSchema = z.string().trim().min(1).max(120)
const inteiro = (min: number, max: number) => z.number().int().min(min).max(max)
// Projeção da máquina no exercício (#261): só escala + rótulo do aluno + identidade opaca. Estrito: local, obs,
// fabricante/modelo e o id do catálogo não entram (nem no plano, nem na cópia do registro). Mesmos limites das regras.
const kg = z.number().positive().max(500)
export const REF_MAQUINA = /^mq-[a-z0-9]{20}$/
export const maquinaSlotSchema = z.object({
  ref: z.string().regex(REF_MAQUINA), nome: z.string().min(1).max(60),
  tipo: z.enum(['maquina', 'articulada', 'polia', 'duasPolias']),
  unidade: z.enum(['kg', 'nivel']), incremento: z.number().positive().max(50).optional(), minimo: kg.optional(), maximo: kg.optional(),
  complementos: z.array(kg).max(4).optional(), niveis: z.number().int().min(1).max(40).optional(), kgNivel: z.array(kg.nullable()).max(40).optional(),
  polia: z.enum(['1:1', '2:1']).optional(), porLado: z.boolean().optional(),
}).strict().refine((m) => problemasAparelho({ ...m, id: m.ref, local: '-' }).length === 0, 'Máquina inválida.').transform((m) => m as MaquinaTreino)
const slot = z.object({ slotId: idSchema, nome: nomeSchema, pausaS: z.number().min(0).max(3600).optional(), doisLados: z.boolean().optional(), maquina: maquinaSlotSchema.optional() }).strict()
export const repsSchema = z.array(inteiro(1, 600).nullable()).max(6).superRefine((l, c) => { const vazio = l.indexOf(null); if (vazio >= 0 && l.slice(vazio).some((v) => v !== null)) c.addIssue({ code: 'custom', message: 'Séries vazias devem ficar no fim da linha.' }) })
const linha = z.array(repsSchema).min(1).max(12)
export const metodoSchema = z.object({ ativo: z.boolean(), semana: inteiro(1, 12), treino: inteiro(1, 7), exercicio: inteiro(1, 10), metodo: z.enum(['Dropset', 'Biset', 'Triset', 'Superset', 'Circuito', 'Rest-pause', 'Clusterset']), escopo: z.enum(['Todas as séries', 'Série específica', 'Primeiras 2 séries', 'Últimas 2 séries', 'Primeiras 3 séries', 'Últimas 3 séries', 'Primeiras 4 séries', 'Últimas 4 séries']), serie: inteiro(1, 6).optional(), grupo: inteiro(1, Number.MAX_SAFE_INTEGER).optional(), reducaoCarga: z.number().min(0).max(100).optional(), pausaInternaS: z.number().min(0).max(3600).optional(), blocos: inteiro(1, 20).optional(), repsPorBloco: inteiro(1, 600).optional(), adicional: inteiro(0, 600).optional(), etapas: inteiro(1, 6).optional(), cargaEtapa: z.array(z.number().min(0).max(10000).nullable()).max(6).optional(), repsPadrao: inteiro(1, 600).optional(), repsEtapa: z.array(inteiro(1, 600).nullable()).max(6).optional() }).strict()
export const mesoSchema = z.object({ frequencia: inteiro(1, 7), semanas: inteiro(1, 12), inicio: z.iso.date(), pausaS: z.number().min(0).max(3600), pausaPrincipaisS: z.number().min(0).max(3600).optional(), divisao: z.array(z.array(slot).max(10)).min(1).max(7), trocas: z.record(z.string().regex(/^\d+-\d+-\d+$/), slot).optional(), adicoes: z.record(z.string().regex(/^\d+-\d+$/), z.array(slot).max(10)).optional(), progressao: z.object({ principais: linha, auxiliares: linha, padrao: linha.optional() }).strict(), metodos: z.array(metodoSchema).max(5040), progressaoPct: z.number().min(0).max(100).optional(), limiteReps: inteiro(1, 600).optional(), tempoLimiteMin: inteiro(1, 600).optional(), dias: z.array(inteiro(0, 6)).max(7).optional(), polimentos: z.record(z.string().regex(/^\d+-\d+$/), z.record(idSchema, z.object({ nome: z.string().min(1).max(120), reps: z.array(inteiro(1, 600)).min(1).max(6), degraus: z.union([z.literal(0), z.literal(1), z.literal(2)]), folga: inteiro(1, 5).optional() }).strict())).optional(), progressaoExercicio: z.record(idSchema, linha).optional() }).strict().superRefine((m, ctx) => {
  const erro = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (m.divisao.length !== m.frequencia) erro('A divisão deve ter um treino por dia.')
  if ([m.progressao.principais, m.progressao.auxiliares, m.progressao.padrao, ...Object.values(m.progressaoExercicio ?? {})].some((l) => l && l.length !== m.semanas)) erro('A progressão deve ter uma linha por semana.')
  if (m.dias?.length && (m.dias.length !== m.frequencia || m.dias.some((d, i) => i > 0 && d <= m.dias![i - 1]))) erro('Dias devem estar ordenados e corresponder à frequência.')
  const ids = m.divisao.flat().map((s) => s.slotId)
  if (new Set(ids).size !== ids.length) erro('Cada exercício da divisão deve ter um slotId único.')
  const identidades = new Map<string, string>()
  for (const s of [...m.divisao.flat(), ...Object.values(m.trocas ?? {}), ...Object.values(m.adicoes ?? {}).flat()]) {
    const existente = identidades.get(s.slotId)
    if (existente !== undefined && existente !== s.nome) erro('Um slotId não pode identificar exercícios diferentes.')
    identidades.set(s.slotId, s.nome)
  }
  const origens = new Map<string, string>()
  const vincular = (id: string, origem: string) => {
    const anterior = origens.get(id)
    if (anterior !== undefined && anterior !== origem) erro('Um slotId não pode ser usado em exercícios distintos.')
    origens.set(id, origem)
  }
  m.divisao.forEach((treino, t) => treino.forEach((s, p) => vincular(s.slotId, `t${t + 1}p${p + 1}`)))
  for (const [chave, s] of Object.entries(m.trocas ?? {})) { const [, t, p] = chave.split('-'); vincular(s.slotId, `t${t}p${p}`) }
  for (const [chave, lista] of Object.entries(m.adicoes ?? {})) { const [, t] = chave.split('-'); lista.forEach((s) => vincular(s.slotId, `a${t}`)) }
  const slotsEfetivos = (w: number, t: number) => [...(m.divisao[t - 1] ?? []).map((s, p) => m.trocas?.[`${w}-${t}-${p + 1}`] ?? s), ...(m.adicoes?.[`${w}-${t}`] ?? [])]
  for (let w = 1; w <= m.semanas; w++) for (let t = 1; t <= m.frequencia; t++) {
    const efetivos = slotsEfetivos(w, t).map((s) => s.slotId)
    if (new Set(efetivos).size !== efetivos.length) erro('Exercícios da mesma sessão não podem compartilhar slotId.')
  }
  for (const [k, exercicios] of Object.entries(m.polimentos ?? {})) {
    const [w, t] = k.split('-').map(Number)
    if (w < 2 || w > m.semanas || t < 1 || t > m.frequencia || k !== `${w}-${t}` || Object.keys(exercicios).length > 10) erro('Polimento fora do mesociclo.')
  }
  if (m.metodos.some((x) => x.semana > m.semanas || x.treino > m.frequencia || x.exercicio > slotsEfetivos(x.semana, x.treino).length)) erro('Método fora do mesociclo.')
  for (const k of Object.keys(m.trocas ?? {})) { const [s,t,p] = k.split('-').map(Number); if (s < 1 || s > m.semanas || t < 1 || t > m.frequencia || p < 1 || p > (m.divisao[t-1]?.length ?? 0)) erro('Troca fora do mesociclo.') }
  for (const k of Object.keys(m.adicoes ?? {})) { const [s,t] = k.split('-').map(Number); if (s < 1 || s > m.semanas || t < 1 || t > m.frequencia || (m.divisao[t-1]?.length ?? 0) + (m.adicoes?.[k]?.length ?? 0) > 10) erro('Adição fora do mesociclo.') }
})
