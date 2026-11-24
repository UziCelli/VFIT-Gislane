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
import { copiaVazia, prescreverSessao, metodosDaSessao } from '../../src/engine/sessao'
import { lerPrescricaoRegistrada, comPrescricoesRegistradas } from '../../src/lib/prescricaoRegistrada'
import { diasDaSemana, DIAS_AUTO } from '../../src/lib/agenda'
import { registroId } from '../../src/lib/conversores'
import { removerExercicio } from '../../src/features/coach/meso/util'
import { ErroConector, ErroPrescricaoRecusada, type Firestore, type Condicao } from './firestore'

import { idSchema as id, nomeSchema as nome, mesoSchema } from '../../src/lib/prescricaoSchema'
import { alteracaoSchema, aplicarAlteracoes } from './edicao'
export const entradaPrescricaoSchema = z.object({ acao: z.enum(['criar', 'proximo', 'editar']), alunoId: id, mesoId: id.optional(), nome: nome.optional(), meso: mesoSchema.optional(), versao: z.string().max(100).optional(), alteracoes: z.array(alteracaoSchema).min(1).max(100).optional(), removerSlotIds: z.array(id).min(1).max(70).optional().describe('Somente para acao editar com mesoId: use os slotId de ver_mesos.divisaoPlanejada e omita meso. Remove da divisão preservando registros e sessões.') }).strict().superRefine((v, c) => { if (v.alteracoes && (v.meso || v.removerSlotIds)) c.addIssue({ code: 'custom', message: 'Envie alterações ou mesociclo completo, sem combiná-los.' }); if (v.removerSlotIds && (v.acao !== 'editar' || !v.mesoId || v.meso || new Set(v.removerSlotIds).size !== v.removerSlotIds.length)) c.addIssue({ code: 'custom', message: 'Para remover exercícios informe IDs distintos, em edição, sem enviar outro mesociclo.' }); if (v.acao === 'editar' && !v.mesoId) c.addIssue({ code: 'custom', message: 'Informe mesoId para editar.' }); if (v.acao !== 'editar' && v.mesoId) c.addIssue({ code: 'custom', message: 'mesoId só pode ser usado para editar.' }); if (v.meso && v.acao !== 'editar') { const nomes = new Set(catalogo.flatMap((g) => g.exercicios.map((e) => e.nome))); const slots = [...v.meso.divisao.flat(), ...Object.values(v.meso.trocas ?? {}), ...Object.values(v.meso.adicoes ?? {}).flat()]; if (slots.some((s) => !nomes.has(s.nome))) c.addIssue({ code: 'custom', message: 'Use exercícios do catálogo.' }) } })
export type EntradaPrescricao = z.infer<typeof entradaPrescricaoSchema>
export type PropostaPrescricao = { acao: EntradaPrescricao['acao']; alunoId: string; alunoNome: string; mesoId?: string; nome: string; resumo: string; dados: Record<string, unknown>; antes?: Record<string, unknown>; previaDados?: Record<string, unknown>; remocoes?: { slotId: string; nome: string; treino: number; posicao: number }[]; diferencas?: { tipo: 'retirado' | 'incluido'; nome: string; treino: number }[]; avisos?: string[]; esperado?: string; origem?: { id: string; updateTime: string }; criadaEm: number; condicoes?: Condicao[]; sessoesPreservadas?: string[] }

export async function prepararPrescricao(fs: Firestore, entrada: EntradaPrescricao, agoraMs: number): Promise<PropostaPrescricao> {
  const analiseEntrada = entradaPrescricaoSchema.safeParse(entrada)
  if (!analiseEntrada.success) throw new ErroConector('Pedido de prescrição inválido. Confira os parâmetros de preparar_treino.', 'VALIDACAO', 'validacao', false)
  const e = analiseEntrada.data
  const aluno = await fs.doc(`usuarios/${e.alunoId}`)
  if (!aluno || aluno.dados.papel !== 'aluno') throw new ErroConector('Aluno não encontrado.')
  const docs = e.acao === 'editar' ? [] : await fs.consulta('mesos', 'alunoId', e.alunoId)
  const hoje = dataSP(new Date(agoraMs))
  let base: Meso, titulo: string, esperado: string | undefined, sessoes: unknown, origem: PropostaPrescricao['origem']
  if (e.acao === 'editar') {
    const d = await fs.doc(`mesos/${e.mesoId}`)
    if (!d || d.dados.alunoId !== e.alunoId || !d.updateTime) throw new ErroConector('Mesociclo não encontrado ou sem versão.')
    if (e.versao && e.versao !== d.updateTime) throw new ErroConector('O mesociclo mudou. Consulte ver_mesos novamente.', 'VERSAO', 'validacao', false)
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
    base = { ...atual.meso, polimentos: {}, inicio: depois > hoje ? depois : hoje }; titulo = `Mesociclo ${docs.length + 1}`
  } else { base = { ...mesoPadrao(), inicio: hoje }; titulo = `Mesociclo ${docs.length + 1}` }
  let escolhido: Meso = e.acao === 'proximo' ? { ...(e.meso ?? base), inicio: base.inicio } : e.meso ?? base
  if (e.alteracoes) escolhido = aplicarAlteracoes(escolhido, e.alteracoes)
  if (e.acao === 'proximo' && escolhido.inicio < base.inicio) throw new ErroConector('O próximo ciclo deve começar após o ciclo atual. Confira a data de início.', 'CALENDARIO', 'validacao', false)
  if (e.acao === 'editar' && base.inicio <= hoje && (escolhido.inicio !== base.inicio || escolhido.semanas < base.semanas || escolhido.frequencia < base.frequencia)) throw new ErroConector('Em ciclo já iniciado, não reduza duração/frequência nem mude o início: pode haver registros offline. Prepare um próximo ciclo.', 'HISTORICO_OFFLINE', 'validacao', false)
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
  if (e.meso && (e.acao !== 'editar' || JSON.stringify(e.meso.metodos) !== JSON.stringify(base.metodos))) {
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
  // Identidade de um exercício não muda de significado: substituições recebem UUID novo.
  const antigos = new Map<string, string>()
  const identificar = (slots: { slotId: string; nome: string }[]) => {
    for (const slot of slots) {
      if (antigos.has(slot.slotId) && antigos.get(slot.slotId) !== slot.nome) throw new ErroConector('O histórico contém identidades incompatíveis. Confira o mesociclo no app.', 'IDENTIDADE', 'validacao', false)
      antigos.set(slot.slotId, slot.nome)
    }
  }
  identificar([...base.divisao.flat(), ...Object.values(base.trocas ?? {}), ...Object.values(base.adicoes ?? {}).flat(), ...Object.values(base.sessoes ?? {}).flatMap((s) => s.exercicios), ...Object.values(base.prescricoesRegistradas ?? {}).flatMap((p) => p?.sessao.exercicios.map((e) => e.slot) ?? []), ...Object.values(base.prescricoesAnteriores ?? {}).flatMap((ps) => ps.flatMap((p) => p.sessao.exercicios.map((e) => e.slot)))])
  const nomesCatalogo = new Set(catalogo.flatMap((g) => g.exercicios.map((x) => x.nome)))
  const validarIdentidades = () => {
    for (const s of [...escolhido.divisao.flat(), ...Object.values(escolhido.trocas ?? {}), ...Object.values(escolhido.adicoes ?? {}).flat()]) {
      if ((antigos.has(s.slotId) && antigos.get(s.slotId) !== s.nome) || (!antigos.has(s.slotId) && !nomesCatalogo.has(s.nome))) throw new ErroConector('Use o catálogo e uma identidade nova ao substituir um exercício.', 'VALIDACAO', 'validacao', false)
    }
  }
  validarIdentidades()
  // O perfil muda por ações do aluno (peso, aceite, pagamento): não exige a versão exata, mas o aluno precisa continuar existindo (exclusão LGPD não pode deixar mesociclo órfão).
  const condicoes: Condicao[] = [{ caminho: `usuarios/${e.alunoId}`, existe: true }]
  // Cópia congelada sem nenhuma série é defeito (a leitura já a ignora): não a carrega para a edição nem a recria.
  const preservadas = Object.fromEntries(Object.entries(base.prescricoesRegistradas ?? {}).filter(([, p]) => !copiaVazia(p))) as NonNullable<Meso['prescricoesRegistradas']>
  const anteriores = structuredClone(base.prescricoesAnteriores ?? {})
  if (e.acao === 'editar') {
    const caminhos = Array.from({ length: Math.max(base.semanas, escolhido.semanas) }, (_, w) => Array.from({ length: Math.max(base.frequencia, escolhido.frequencia) }, (_, t) => `registros/${registroId(e.mesoId!, w + 1, t + 1)}`)).flat()
    const registros = await fs.lote(caminhos)
    for (const r of registros) {
      condicoes.push({ caminho: r.caminho, ...(r.doc?.updateTime && { updateTime: r.doc.updateTime }) })
      if (!r.doc) continue
      if (!r.doc.updateTime || r.doc.dados.mesoId !== e.mesoId || r.doc.dados.alunoId !== e.alunoId) throw new ErroConector('Registro sem identidade ou versão válida. Confira no app.', 'HISTORICO', 'validacao', false)
      const w = Number(r.doc.dados.semana), t = Number(r.doc.dados.treino)
      if (r.caminho !== `registros/${registroId(e.mesoId!, w, t)}`) throw new ErroConector('Identidade do registro incompatível.', 'HISTORICO', 'validacao', false)
      if (w > escolhido.semanas || t > escolhido.frequencia || base.inicio !== escolhido.inicio) throw new ErroConector('Essa configuração retiraria ou deslocaria uma sessão registrada.', 'HISTORICO', 'validacao', false)
      const data = (m: Meso) => m.dias?.length ? diasDaSemana(m, w).find((d) => d.treino === t)?.data : somarDias(m.inicio, 7 * (w - 1) + DIAS_AUTO[m.frequencia - 1][t - 1])
      if (data(base) !== data(escolhido)) throw new ErroConector('Os dias propostos deslocariam uma sessão registrada.', 'HISTORICO', 'validacao', false)
      const chave = `${w}-${t}`
      // A cópia vem do aluno: se contradiz as identidades do plano ou do histórico, é ignorada (nunca trava a edição).
      let registrada = lerPrescricaoRegistrada(r.doc.dados.prescricaoRegistrada)
      const slotsCopia = registrada?.sessao.exercicios.map((x) => x.slot) ?? []
      if (registrada && slotsCopia.some((x) => antigos.has(x.slotId) && antigos.get(x.slotId) !== x.nome)) registrada = null
      else if (registrada) identificar(slotsCopia)
      const baseRegistrada = comPrescricoesRegistradas(base, [{ ...r.doc.dados, semana: w, treino: t, ...(registrada ? {} : { prescricaoRegistrada: undefined }) }])
      const sessao = prescreverSessao(baseRegistrada, w, t)
      if (!sessao) throw new ErroConector('Sessão registrada fora do mesociclo.', 'HISTORICO', 'validacao', false)
      const copiaDoDia = base.prescricoesRegistradas?.[chave] !== null && registrada && registrada.sessao.semana === w && registrada.sessao.treino === t ? registrada : { versao: 1 as const, sessao, metodos: metodosDaSessao(baseRegistrada, w, t), ...(baseRegistrada.historicoIncerto?.includes(chave) && { referenciaHistorica: true }) }
      if (!copiaVazia(copiaDoDia)) preservadas[chave] ??= copiaDoDia
    }
    // Mantém referências para filas de clientes antigos que só sincronizem depois do commit.
    for (let w = 1; w <= base.semanas; w++) for (let t = 1; t <= base.frequencia; t++) {
      const chave = `${w}-${t}`
      if (preservadas[chave]) continue
      const sessao = prescreverSessao(base, w, t)
      if (!sessao || JSON.stringify(sessao) === JSON.stringify(prescreverSessao(escolhido, w, t))) continue
      const copia = { versao: 1 as const, sessao, metodos: metodosDaSessao(base, w, t) }
      const historico = anteriores[chave] ?? []
      if (!historico.some((x) => JSON.stringify(x) === JSON.stringify(copia))) anteriores[chave] = [...historico, copia]
    }
    for (const s of Object.values(base.sessoes ?? {})) if (s.semana > escolhido.semanas || s.treino > escolhido.frequencia || base.inicio !== escolhido.inicio) throw new ErroConector('Essa configuração deslocaria um ajuste presencial.', 'HISTORICO', 'validacao', false)
  }
  validarIdentidades()
  // Para cópias de dados antigos, validação também ocorre antes da gravação.
  const { sessoes: _sessoes, prescricoesRegistradas: _preservadas, prescricoesAnteriores: _anteriores, historicoIncerto: _incerto, ...semSessoes } = escolhido
  const analise = mesoSchema.safeParse(semSessoes)
  if (!analise.success) {
    // Nunca devolver caminhos dinâmicos ou valores dos dados do aluno.
    const regioes: Record<string, string> = { metodos: 'métodos', progressao: 'progressão', progressaoExercicio: 'progressão', polimentos: 'polimento', divisao: 'divisão', trocas: 'divisão', adicoes: 'divisão', inicio: 'data de início' }
    const campo = analise.error.issues[0]?.path[0]
    const regiao = typeof campo === 'string' ? regioes[campo] ?? 'configuração geral' : 'configuração geral'
    throw new ErroConector(`Não foi possível preparar: confira ${regiao} do mesociclo no app.`)
  }
  const validado = analise.data
  const n = e.nome ?? titulo
  // Calculado no servidor a partir do dado real (não do texto do assistente): o coach vê cada exercício retirado ou incluído.
  const diferencas: NonNullable<PropostaPrescricao['diferencas']> = []
  if (e.acao === 'editar') {
    const mapa = (m: Meso) => new Map(m.divisao.flatMap((slots, t) => slots.map((x) => [x.slotId, { nome: x.nome, treino: t + 1 }] as const)))
    const antes = mapa(base), depois = mapa(validado)
    for (const [slotId, x] of antes) if (!depois.has(slotId)) diferencas.push({ tipo: 'retirado', ...x })
    for (const [slotId, x] of depois) if (!antes.has(slotId)) diferencas.push({ tipo: 'incluido', ...x })
  }
  const historico = e.acao === 'editar' ? { ...(Object.keys(preservadas).length && { prescricoesRegistradas: preservadas }), ...(Object.keys(anteriores).length && { prescricoesAnteriores: anteriores }) } : {}
  const tamanho = new TextEncoder().encode(JSON.stringify({ ...mesoParaDoc(validado), ...historico })).byteLength
  if (tamanho > 900_000) throw new ErroConector('A prescrição e seu histórico excedem o limite seguro. Prepare um próximo ciclo.', 'TAMANHO', 'validacao', false)
  return { acao: e.acao, alunoId: e.alunoId, alunoNome: typeof aluno.dados.nome === 'string' ? aluno.dados.nome : 'Aluno', mesoId: e.mesoId, nome: n, resumo: `${n}: ${validado.frequencia} treinos por semana, ${validado.semanas} semanas, início ${validado.inicio}.${diferencas.length ? ` Retirar/incluir: ${diferencas.map((d) => `${d.tipo === 'retirado' ? '−' : '+'} ${d.nome} (treino ${d.treino})`).join('; ')}.` : ''}`, dados: { nome: n, ...mesoParaDoc(validado), ...historico }, ...(e.acao === 'editar' ? { antes: { nome: titulo, ...mesoParaDoc(base), ...(base.prescricoesRegistradas && { prescricoesRegistradas: base.prescricoesRegistradas }), ...(sessoes ? { sessoes } : {}) }, previaDados: { nome: n, ...mesoParaDoc(validado), ...historico, ...(sessoes ? { sessoes } : {}) } } : {}), ...(remocoes.length ? { remocoes, avisos: ['As cargas registradas continuam guardadas.', 'Os exercícios removidos deixam de aparecer no treino planejado.', 'As sessões presenciais já ajustadas permanecem como estão.'] } : {}), ...(diferencas.length ? { diferencas } : {}), esperado, origem, criadaEm: agoraMs, condicoes, sessoesPreservadas: Object.keys(historico.prescricoesRegistradas ?? {}) }
}

export async function salvarPrescricao(fs: Firestore, proposta: PropostaPrescricao, idOperacao: string, _agoraMs: number, uid?: string, antesDoCommit?: () => Promise<void>): Promise<{ mesoId: string }> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(idOperacao)) throw new ErroConector('Operação inválida.')
  const mesoId = proposta.mesoId ?? (proposta.acao === 'proximo' && proposta.origem ? await proximoMesoId(proposta.origem.id) : `mcp_${idOperacao}`)
  const existente = await fs.doc(`mesos/${mesoId}`)
  if (existente?.dados.mcpOperacao === idOperacao) return { mesoId }
  if (proposta.acao === 'proximo') {
    const mesos = (await fs.consulta('mesos', 'alunoId', proposta.alunoId)).map((d) => ({ ...d.dados, id: d.id }) as unknown as MesoSalvo & { id: string })
    if (proximoMeso(mesos, new Date(_agoraMs))) throw new ErroPrescricaoRecusada('Este aluno já tem um próximo mesociclo. Prepare e confirme novamente.')
  }
  if (new TextEncoder().encode(JSON.stringify(proposta.dados)).byteLength > 900_000) throw new ErroPrescricaoRecusada('O histórico excede o limite seguro do documento. Nenhuma alteração foi salva.', 'TAMANHO')
  // A partir daqui a gravação pode ter acontecido: o chamador marca o resultado como pendente.
  await antesDoCommit?.()
  await fs.gravarMeso(mesoId, { ...proposta.dados, ...(proposta.esperado ? {} : { alunoId: proposta.alunoId }), mcpOperacao: idOperacao }, proposta.esperado ?? null, proposta.origem, uid ? { condicoes: proposta.condicoes ?? [], operacao: idOperacao, uid } : undefined)
  return { mesoId }
}
