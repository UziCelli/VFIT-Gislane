import { z } from 'zod'
import { EXERCICIOS, nomesConhecidos } from '../../src/data/catalogo'
import { METODOS, emGrupo, isometrico, linhaIsometrica, linhaPrescrita, migrarProgressao, padraoMetodo, progressaoIsometrica, salvarLinha, totalCerto, type Meso } from '../../src/engine'
import { moverExercicio, removerExercicio, redimensionar } from '../../src/features/coach/meso/util'
import { idSchema as id, nomeSchema as nome, metodoSchema, repsSchema } from '../../src/lib/prescricaoSchema'
import { ErroConector } from './firestore'

const treino = z.number().int().min(1).max(7)
const semanas = z.array(z.number().int().min(1).max(12)).min(1).max(12)
const dadosMetodo = metodoSchema.omit({ ativo: true, semana: true, treino: true, exercicio: true, metodo: true, grupo: true, escopo: true }).partial()
export const alteracaoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('adicionar'), treino, nome, referencia: id.optional(), antesDeSlotId: id.optional() }).strict(),
  z.object({ tipo: z.literal('substituir'), slotId: id, nome }).strict(),
  z.object({ tipo: z.literal('remover'), slotId: id }).strict(),
  z.object({ tipo: z.literal('mover'), slotId: id, antesDeSlotId: id.optional() }).strict(),
  z.object({ tipo: z.literal('prescricao'), slotId: id, semanas, reps: repsSchema.min(1), pausaS: z.number().min(0).max(3600).optional(), doisLados: z.boolean().optional() }).strict(),
  z.object({ tipo: z.literal('metodo'), slotIds: z.array(id).min(1).max(10), semanas, metodo: z.enum(METODOS), remover: z.boolean().optional(), escopo: metodoSchema.shape.escopo.optional(), ajustes: dadosMetodo.optional() }).strict(),
  z.object({ tipo: z.literal('configurar'), inicio: z.iso.date().optional(), semanas: z.number().int().min(1).max(12).optional(), frequencia: treino.optional(), dias: z.array(z.number().int().min(0).max(6)).max(7).optional(), pausaS: z.number().min(0).max(3600).optional(), pausaPrincipaisS: z.number().min(0).max(3600).optional(), tempoLimiteMin: z.number().int().min(1).max(600).optional(), progressaoPct: z.number().min(0).max(100).optional() }).strict(),
])
export type Alteracao = z.infer<typeof alteracaoSchema>
// Aceita o nome atual, o novo (gerado) e os apelidos: o app já grava o nome novo (épico #255).
const nomes = new Set(EXERCICIOS.flatMap(nomesConhecidos))
const erro = (mensagem: string): never => { throw new ErroConector(mensagem, 'VALIDACAO', 'validacao', false) }

export function aplicarAlteracoes(base: Meso, alteracoes: Alteracao[]): Meso {
  let m = structuredClone(migrarProgressao(base))
  const referencias = new Map<string, string>()
  const resolver = (ref: string) => referencias.get(ref) ?? ref
  const localizar = (ref: string) => {
    const slotId = resolver(ref)
    const t = m.divisao.findIndex((slots) => slots.some((s) => s.slotId === slotId))
    const p = t < 0 ? -1 : m.divisao[t].findIndex((s) => s.slotId === slotId)
    if (t < 0 || p < 0) return erro('Exercício não encontrado na divisão. Consulte ver_mesos novamente.')
    return { t, p, slot: m.divisao[t][p] }
  }
  for (const a of alteracoes) {
    if ('semanas' in a && Array.isArray(a.semanas) && (new Set(a.semanas).size !== a.semanas.length || a.semanas.some((w) => w > m.semanas))) erro('Confira as semanas da alteração.')
    if (a.tipo === 'configurar') {
      const { tipo: _tipo, ...config } = a
      const n = a.semanas ?? m.semanas, f = a.frequencia ?? m.frequencia
      const linhas = (l: (number | null)[][], iso = false) => redimensionar(l, n, () => iso ? linhaIsometrica() : [8, 8, 8, null, null, null])
      m = { ...m, ...config, divisao: redimensionar(m.divisao, f, () => []), progressao: { principais: linhas(m.progressao.principais), auxiliares: linhas(m.progressao.auxiliares), ...(m.progressao.padrao && { padrao: linhas(m.progressao.padrao) }) }, progressaoExercicio: Object.fromEntries(Object.entries(m.progressaoExercicio ?? {}).map(([k, l]) => [k, linhas(l, m.divisao.flat().some((s) => s.slotId === k && isometrico(s)))])), metodos: m.metodos.filter((x) => x.semana <= n && x.treino <= f), trocas: Object.fromEntries(Object.entries(m.trocas ?? {}).filter(([k]) => { const [w, t] = k.split('-').map(Number); return w <= n && t <= f })), adicoes: Object.fromEntries(Object.entries(m.adicoes ?? {}).filter(([k]) => { const [w, t] = k.split('-').map(Number); return w <= n && t <= f })) }
      continue
    }
    if (a.tipo === 'adicionar') {
      if (!nomes.has(a.nome)) erro('Use um exercício do catálogo.')
      if (a.treino > m.frequencia || m.divisao[a.treino - 1].length >= 10) erro('Treino inválido ou com dez exercícios.')
      if (a.referencia && (referencias.has(a.referencia) || m.divisao.flat().some((s) => s.slotId === a.referencia))) erro('Referência local repetida.')
      const slotId = crypto.randomUUID()
      const posicaoNova = m.divisao[a.treino - 1].length + 1
      m.metodos = m.metodos.map((x) => x.treino === a.treino && x.exercicio >= posicaoNova ? { ...x, exercicio: x.exercicio + 1 } : x)
      m.divisao[a.treino - 1].push({ slotId, nome: a.nome })
      if (a.referencia) referencias.set(a.referencia, slotId)
      if (a.antesDeSlotId) {
        const destino = localizar(a.antesDeSlotId)
        if (destino.t !== a.treino - 1) erro('Reordene dentro do mesmo treino.')
        m = { ...m, ...moverExercicio(m, a.treino, m.divisao[a.treino - 1].length, destino.p + 1) }
      }
      continue
    }
    if (a.tipo === 'metodo') {
      const slots = a.slotIds.map(localizar), primeiro = slots[0]
      if (slots.some((x) => x.t !== primeiro.t) || new Set(slots.map((x) => x.slot.slotId)).size !== slots.length) erro('O método deve usar exercícios distintos do mesmo treino.')
      if (!a.remover && (emGrupo(a.metodo) ? !totalCerto(a.metodo, slots.length) : slots.length !== 1)) erro('Confira os participantes do método.')
      const n = linhaPrescrita(m, a.semanas[0], primeiro.t + 1, primeiro.p + 1).filter((x) => x != null).length
      const modelo = { ...padraoMetodo(a.metodo, a.semanas[0], primeiro.t + 1, primeiro.p + 1, n), ...a.ajustes, ...(a.escopo && { escopo: a.escopo }) }
      if (a.escopo && a.escopo !== 'Série específica') delete modelo.serie
      if ((modelo.escopo === 'Série específica') !== (modelo.serie !== undefined)) erro('Confira a série específica do método.')
      m.metodos = salvarLinha(m.metodos, { treino: primeiro.t + 1, pos: primeiro.p + 1, metodo: a.metodo, semanas: a.remover ? [] : a.semanas, modelo: [modelo], parceiros: slots.slice(1).map((x) => x.p + 1) }, a.semanas)
      continue
    }
    const { t, p, slot } = localizar(a.slotId)
    if (a.tipo === 'remover') m = { ...m, ...removerExercicio(m, t + 1, p + 1) }
    if (a.tipo === 'mover') {
      const destino = a.antesDeSlotId ? localizar(a.antesDeSlotId) : { t, p: m.divisao[t].length }
      if (destino.t !== t) erro('Reordene dentro do mesmo treino.')
      const pos = a.antesDeSlotId ? destino.p - (p < destino.p ? 1 : 0) : destino.p - 1
      m = { ...m, ...moverExercicio(m, t + 1, p + 1, pos + 1) }
    }
    if (a.tipo === 'substituir') {
      if (!nomes.has(a.nome)) erro('Use um exercício do catálogo.')
      // A máquina é do exercício antigo (#261): o substituto começa sem ela.
      const { maquina: _maquina, ...resto } = slot
      const novo = { ...resto, nome: a.nome, slotId: crypto.randomUUID() }
      m.divisao[t][p] = novo
      for (const [ref, atual] of referencias) if (atual === slot.slotId) referencias.set(ref, novo.slotId)
      referencias.set(slot.slotId, novo.slotId)
      if (isometrico(slot) === isometrico(novo)) {
        if (m.progressaoExercicio?.[slot.slotId]) m.progressaoExercicio[novo.slotId] = structuredClone(m.progressaoExercicio[slot.slotId])
      } else {
        if (isometrico(novo)) {
          m.progressaoExercicio ??= {}
          m.progressaoExercicio[novo.slotId] = progressaoIsometrica(m.semanas)
        }
        m.metodos = m.metodos.map((metodo) => {
          if (metodo.treino !== t + 1 || metodo.exercicio !== p + 1 || m.trocas?.[`${metodo.semana}-${t + 1}-${p + 1}`]) return metodo
          const { repsPadrao: _padrao, repsPorBloco: _bloco, repsEtapa: _etapa, adicional: _adicional, ...semContagens } = metodo
          return semContagens
        })
      }
    }
    if (a.tipo === 'prescricao') {
      m.progressaoExercicio ??= {}
      const linhas = Array.from({ length: m.semanas }, (_, w) => [...linhaPrescrita(m, w + 1, t + 1, p + 1)])
      for (const w of a.semanas) linhas[w - 1] = [...a.reps]
      m.progressaoExercicio[slot.slotId] = linhas
      if (a.pausaS !== undefined) slot.pausaS = a.pausaS
      if (a.doisLados !== undefined) slot.doisLados = a.doisLados
    }
  }
  return m
}
