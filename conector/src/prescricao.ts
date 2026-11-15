// Prescrições: apenas mesociclos, nunca registros ou sessões presenciais.
import { z } from 'zod'
import catalogo from '../../src/data/exercicios.json'
import { emGrupo, totalCerto, type Meso } from '../../src/engine'
import { mesoParaDoc, docParaMeso, type MesoSalvo } from '../../src/lib/conversores'
import { fimISO } from '../../src/lib/relatorio'
import { proximoMesoId } from '../../src/lib/proximoMesoId'
import { somarDias } from '../../src/lib/avaliacao'
import { dataSP, mesoAtual, proximoMeso } from '../../src/features/aluno/mesoAtual'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { removerExercicio } from '../../src/features/coach/meso/util'
import { ErroConector, ErroPrescricaoRecusada, type Firestore } from './firestore'

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const nome = z.string().trim().min(1).max(120)
const inteiro = (min: number, max: number) => z.number().int().min(min).max(max)
const slot = z.object({ slotId: id, nome, pausaS: inteiro(0, 3600).optional(), doisLados: z.boolean().optional() }).strict()
const linha = z.array(z.array(inteiro(1, 600).nullable()).max(6)).min(1).max(12)
const metodo = z.object({ ativo: z.boolean(), semana: inteiro(1, 12), treino: inteiro(1, 7), exercicio: inteiro(1, 10), metodo: z.enum(['Dropset', 'Biset', 'Triset', 'Superset', 'Circuito', 'Rest-pause', 'Clusterset']), escopo: z.enum(['Todas as séries', 'Série específica', 'Primeiras 2 séries', 'Últimas 2 séries', 'Primeiras 3 séries', 'Últimas 3 séries', 'Primeiras 4 séries', 'Últimas 4 séries']), serie: inteiro(1, 6).optional(), grupo: inteiro(1, Number.MAX_SAFE_INTEGER).optional(), reducaoCarga: z.number().min(0).max(100).optional(), pausaInternaS: inteiro(0, 3600).optional(), blocos: inteiro(1, 20).optional(), repsPorBloco: inteiro(1, 600).optional(), adicional: inteiro(0, 600).optional(), etapas: inteiro(1, 6).optional(), cargaEtapa: z.array(z.number().min(0).max(10000).nullable()).max(6).optional(), repsPadrao: inteiro(1, 600).optional(), repsEtapa: z.array(inteiro(1, 600).nullable()).max(6).optional() }).strict()
const mesoSchema = z.object({ frequencia: inteiro(1, 7), semanas: inteiro(1, 12), inicio: z.iso.date(), pausaS: inteiro(0, 3600), pausaPrincipaisS: inteiro(0, 3600).optional(), divisao: z.array(z.array(slot).max(10)).min(1).max(7), trocas: z.record(z.string().regex(/^\d+-\d+-\d+$/), slot).optional(), adicoes: z.record(z.string().regex(/^\d+-\d+$/), z.array(slot).max(10)).optional(), progressao: z.object({ principais: linha, auxiliares: linha, padrao: linha.optional() }).strict(), metodos: z.array(metodo).max(840), progressaoPct: z.number().min(0).max(100).optional(), limiteReps: inteiro(1, 600).optional(), tempoLimiteMin: inteiro(1, 600).optional(), dias: z.array(inteiro(0, 6)).max(7).optional(), progressaoExercicio: z.record(id, linha).optional() }).strict().superRefine((m, ctx) => {
  const erro = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (m.divisao.length !== m.frequencia) erro('A divisão deve ter um treino por dia.')
  if ([m.progressao.principais, m.progressao.auxiliares, m.progressao.padrao, ...Object.values(m.progressaoExercicio ?? {})].some((l) => l && l.length !== m.semanas)) erro('A progressão deve ter uma linha por semana.')
  if (m.dias && (m.dias.length !== m.frequencia || m.dias.some((d, i) => i > 0 && d <= m.dias![i - 1]))) erro('Dias devem estar ordenados e corresponder à frequência.')
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
  for (const [chave, lista] of Object.entries(m.adicoes ?? {})) { const [, t] = chave.split('-'); lista.forEach((s, p) => vincular(s.slotId, `a${t}p${p + 1}`)) }
  const slotsEfetivos = (w: number, t: number) => [...(m.divisao[t - 1] ?? []).map((s, p) => m.trocas?.[`${w}-${t}-${p + 1}`] ?? s), ...(m.adicoes?.[`${w}-${t}`] ?? [])]
  for (let w = 1; w <= m.semanas; w++) for (let t = 1; t <= m.frequencia; t++) {
    const efetivos = slotsEfetivos(w, t).map((s) => s.slotId)
    if (new Set(efetivos).size !== efetivos.length) erro('Exercícios da mesma sessão não podem compartilhar slotId.')
  }
  if (m.metodos.some((x) => x.semana > m.semanas || x.treino > m.frequencia || x.exercicio > slotsEfetivos(x.semana, x.treino).length)) erro('Método fora do mesociclo.')
  for (const k of Object.keys(m.trocas ?? {})) { const [s,t,p] = k.split('-').map(Number); if (s < 1 || s > m.semanas || t < 1 || t > m.frequencia || p < 1 || p > (m.divisao[t-1]?.length ?? 0)) erro('Troca fora do mesociclo.') }
  for (const k of Object.keys(m.adicoes ?? {})) { const [s,t] = k.split('-').map(Number); if (s < 1 || s > m.semanas || t < 1 || t > m.frequencia || (m.divisao[t-1]?.length ?? 0) + (m.adicoes?.[k]?.length ?? 0) > 10) erro('Adição fora do mesociclo.') }
})
export const entradaPrescricaoSchema = z.object({ acao: z.enum(['criar', 'proximo', 'editar']), alunoId: id, mesoId: id.optional(), nome: nome.optional(), meso: mesoSchema.optional(), removerSlotIds: z.array(id).min(1).max(70).optional().describe('Somente para acao editar com mesoId: use os slotId de ver_mesos.divisaoPlanejada e omita meso. Remove da divisão preservando registros e sessões.') }).strict().superRefine((v, c) => { if (v.removerSlotIds && (v.acao !== 'editar' || !v.mesoId || v.meso || new Set(v.removerSlotIds).size !== v.removerSlotIds.length)) c.addIssue({ code: 'custom', message: 'Para remover exercícios informe IDs distintos, em edição, sem enviar outro mesociclo.' }); if (v.acao === 'editar' && !v.mesoId) c.addIssue({ code: 'custom', message: 'Informe mesoId para editar.' }); if (v.acao !== 'editar' && v.mesoId) c.addIssue({ code: 'custom', message: 'mesoId só pode ser usado para editar.' }); if (v.meso && v.acao !== 'editar') { const nomes = new Set(catalogo.flatMap((g) => g.exercicios.map((e) => e.nome))); const slots = [...v.meso.divisao.flat(), ...Object.values(v.meso.trocas ?? {}), ...Object.values(v.meso.adicoes ?? {}).flat()]; if (slots.some((s) => !nomes.has(s.nome))) c.addIssue({ code: 'custom', message: 'Use exercícios do catálogo.' }) } })
export type EntradaPrescricao = z.infer<typeof entradaPrescricaoSchema>
export type PropostaPrescricao = { acao: EntradaPrescricao['acao']; alunoId: string; alunoNome: string; mesoId?: string; nome: string; resumo: string; dados: Record<string, unknown>; antes?: Record<string, unknown>; previaDados?: Record<string, unknown>; remocoes?: { slotId: string; nome: string; treino: number; posicao: number }[]; avisos?: string[]; esperado?: string; origem?: { id: string; updateTime: string }; criadaEm: number }

export async function prepararPrescricao(fs: Firestore, entrada: EntradaPrescricao, agoraMs: number): Promise<PropostaPrescricao> {
  const e = entradaPrescricaoSchema.parse(entrada)
  const aluno = await fs.doc(`usuarios/${e.alunoId}`)
  if (!aluno || aluno.dados.papel !== 'aluno') throw new ErroConector('Aluno não encontrado.')
  const docs = await fs.consulta('mesos', 'alunoId', e.alunoId)
  const hoje = dataSP(new Date(agoraMs))
  let base: Meso, titulo: string, esperado: string | undefined, sessoes: unknown, origem: PropostaPrescricao['origem']
  if (e.acao === 'editar') {
    const d = await fs.doc(`mesos/${e.mesoId}`)
    if (!d || d.dados.alunoId !== e.alunoId || !d.updateTime) throw new ErroConector('Mesociclo não encontrado ou sem versão.')
    sessoes = d.dados.sessoes
    base = docParaMeso(d.dados as unknown as MesoSalvo); titulo = String(d.dados.nome); esperado = d.updateTime
  } else if (e.acao === 'proximo') {
    const mesos = docs.map((d) => ({ ...d.dados, id: d.id }) as unknown as MesoSalvo & { id: string })
    if (proximoMeso(mesos, new Date(agoraMs))) throw new ErroConector('Este aluno já tem um próximo mesociclo.')
    const atual = mesoAtual(mesos.filter((d) => d.inicio.slice(0, 10) <= hoje), new Date(agoraMs))
    if (!atual) throw new ErroConector('Não há mesociclo atual para copiar.')
    const original = docs.find((d) => d.id === atual.doc.id)
    if (!original?.updateTime) throw new ErroConector('Não foi possível verificar a versão do mesociclo atual.')
    origem = { id: original.id, updateTime: original.updateTime }
    const depois = somarDias(fimISO(atual.meso), 1)
    base = { ...atual.meso, inicio: depois > hoje ? depois : hoje }; titulo = `Mesociclo ${docs.length + 1}`
  } else { base = { ...mesoPadrao(), inicio: hoje }; titulo = `Mesociclo ${docs.length + 1}` }
  let escolhido: Meso = e.acao === 'proximo' ? { ...(e.meso ?? base), inicio: base.inicio } : e.meso ?? base
  const remocoes: NonNullable<PropostaPrescricao['remocoes']> = []
  if (e.removerSlotIds) {
    for (const slotId of e.removerSlotIds) {
      const treino = base.divisao.findIndex((slots) => slots.some((s) => s.slotId === slotId))
      const posicao = treino < 0 ? -1 : base.divisao[treino].findIndex((s) => s.slotId === slotId)
      if (treino < 0 || posicao < 0) throw new ErroConector('Exercício não encontrado na divisão atual. Consulte o mesociclo novamente.')
      remocoes.push({ slotId, nome: base.divisao[treino][posicao].nome, treino: treino + 1, posicao: posicao + 1 })
    }
    for (const { slotId, treino } of remocoes) {
      const posicao = escolhido.divisao[treino - 1].findIndex((s) => s.slotId === slotId)
      escolhido = { ...escolhido, ...removerExercicio(escolhido, treino, posicao + 1) }
    }
  }
  if (e.meso && e.acao !== 'editar') {
    const grupos = new Map<string, typeof e.meso.metodos>()
    for (const m of e.meso.metodos) {
      if ((m.escopo === 'Série específica') !== (m.serie !== undefined)) throw new ErroConector('Informe a série somente no escopo de série específica.')
      if (emGrupo(m.metodo)) {
        if (!m.grupo) throw new ErroConector('Métodos em grupo exigem um grupo completo.')
        const k = `${m.semana}-${m.treino}-${m.metodo}-${m.grupo}`
        grupos.set(k, [...(grupos.get(k) ?? []), m])
      } else if (m.grupo !== undefined) throw new ErroConector('Grupo informado para método individual.')
    }
    for (const membros of grupos.values()) if (new Set(membros.map((m) => m.exercicio)).size !== membros.length || !totalCerto(membros[0].metodo, membros.length)) throw new ErroConector('O grupo do método está incompleto ou repetido.')
  }
  if (e.acao === 'editar' && !e.removerSlotIds && (escolhido.frequencia !== base.frequencia || escolhido.semanas !== base.semanas || escolhido.inicio !== base.inicio || JSON.stringify(escolhido.divisao) !== JSON.stringify(base.divisao) || JSON.stringify(escolhido.trocas ?? {}) !== JSON.stringify(base.trocas ?? {}) || JSON.stringify(escolhido.adicoes ?? {}) !== JSON.stringify(base.adicoes ?? {}))) throw new ErroConector('Para proteger o histórico, altere divisão, datas e duração pelo app.')
  if (e.acao === 'editar' && !e.removerSlotIds) {
    // Repetições podem mudar, mas não a quantidade de séries ou métodos: ambos podem ocultar cargas já lançadas.
    const mascara = (v: unknown): unknown => Array.isArray(v) ? v.map(mascara) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, mascara(x)])) : v == null ? null : true
    if (JSON.stringify(mascara(escolhido.progressao)) !== JSON.stringify(mascara(base.progressao)) || JSON.stringify(mascara(escolhido.progressaoExercicio ?? {})) !== JSON.stringify(mascara(base.progressaoExercicio ?? {})) || JSON.stringify(escolhido.metodos) !== JSON.stringify(base.metodos)) throw new ErroConector('Para proteger as cargas, não altere séries ou métodos pelo assistente.')
  }
  // Para cópias de dados antigos, validação também ocorre antes da gravação.
  const { sessoes: _sessoes, ...semSessoes } = escolhido
  const analise = mesoSchema.safeParse(semSessoes)
  if (!analise.success) {
    // Nunca devolver caminhos dinâmicos ou valores dos dados do aluno.
    const regioes: Record<string, string> = { metodos: 'métodos', progressao: 'progressão', progressaoExercicio: 'progressão', divisao: 'divisão', trocas: 'divisão', adicoes: 'divisão', inicio: 'data de início' }
    const campo = analise.error.issues[0]?.path[0]
    const regiao = typeof campo === 'string' ? regioes[campo] ?? 'configuração geral' : 'configuração geral'
    throw new ErroConector(`Não foi possível preparar: confira ${regiao} do mesociclo no app.`)
  }
  const validado = analise.data
  const n = e.nome ?? titulo
  return { acao: e.acao, alunoId: e.alunoId, alunoNome: typeof aluno.dados.nome === 'string' ? aluno.dados.nome : 'Aluno', mesoId: e.mesoId, nome: n, resumo: `${n}: ${validado.frequencia} treinos por semana, ${validado.semanas} semanas, início ${validado.inicio}.${remocoes.length ? ` Remover: ${remocoes.map((r) => `${r.nome} (treino ${r.treino})`).join('; ')}.` : ''}`, dados: { nome: n, ...mesoParaDoc(validado) }, ...(e.acao === 'editar' ? { antes: { nome: titulo, ...mesoParaDoc(base), ...(sessoes ? { sessoes } : {}) }, previaDados: { nome: n, ...mesoParaDoc(validado), ...(sessoes ? { sessoes } : {}) } } : {}), ...(remocoes.length ? { remocoes, avisos: ['As cargas registradas continuam guardadas.', 'Os exercícios removidos deixam de aparecer no treino planejado.', 'As sessões presenciais já ajustadas permanecem como estão.'] } : {}), esperado, origem, criadaEm: agoraMs }
}

export async function salvarPrescricao(fs: Firestore, proposta: PropostaPrescricao, idOperacao: string, _agoraMs: number): Promise<{ mesoId: string }> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(idOperacao)) throw new ErroConector('Operação inválida.')
  const mesoId = proposta.mesoId ?? (proposta.acao === 'proximo' && proposta.origem ? await proximoMesoId(proposta.origem.id) : `mcp_${idOperacao}`)
  const existente = await fs.doc(`mesos/${mesoId}`)
  if (existente?.dados.mcpOperacao === idOperacao) return { mesoId }
  if (proposta.acao === 'proximo') {
    const mesos = (await fs.consulta('mesos', 'alunoId', proposta.alunoId)).map((d) => ({ ...d.dados, id: d.id }) as unknown as MesoSalvo & { id: string })
    if (proximoMeso(mesos, new Date(_agoraMs))) throw new ErroPrescricaoRecusada('Este aluno já tem um próximo mesociclo. Prepare e confirme novamente.')
  }
  await fs.gravarMeso(mesoId, { ...proposta.dados, ...(proposta.esperado ? {} : { alunoId: proposta.alunoId }), mcpOperacao: idOperacao }, proposta.esperado ?? null, proposta.origem)
  return { mesoId }
}
