// As ferramentas de leitura do conector. Funções puras sobre um Firestore: a resposta é JSON enxuto para o Claude.
// Regras de cálculo ficam no motor/lib do app (importados por caminho relativo); aqui só se monta a resposta.
import catalogo from '../../src/data/exercicios.json'
import { isometrico, METODOS, prescreverSessao, type Meso } from '../../src/engine'
import { mesoAtual, proximoMeso, dataSP } from '../../src/features/aluno/mesoAtual'
import { fichaAnamnese, lerAnamnese, maisRecente, pausadoSaude, sinaisAtencao } from '../../src/lib/anamnese'
import { lerAvaliacao } from '../../src/lib/avaliacao'
import { lerCheckin } from '../../src/lib/checkin'
import { docParaMeso, docsParaRegistros, docsParaRegistrosReps, type MesoSalvo, type RegistroDoc } from '../../src/lib/conversores'
import { lerDor } from '../../src/lib/dor'
import { fimISO } from '../../src/lib/relatorio'
import { semanaAtual } from '../../src/lib/treino'
import { ErroConector, type Doc, type Firestore } from './firestore'
import { Ts } from './rest'

const isoMs = (v: unknown): string | null => (v instanceof Ts ? new Date(v.ms).toISOString() : null)
const dia = (v: unknown): string | null => (v instanceof Ts ? dataSP(new Date(v.ms)) : null)
const texto = (v: unknown) => (typeof v === 'string' ? v : '')
const uidOk = (v: string) => /^[A-Za-z0-9]{1,128}$/.test(v)

type MesoComId = MesoSalvo & { id: string }
// Documento que não converte (dado fora do formato) é ignorado, nunca derruba a lista.
function lerMeso(d: Doc): MesoComId | null {
  try {
    const m = { ...(d.dados as unknown as MesoSalvo), id: d.id }
    docParaMeso(m)
    return typeof m.alunoId === 'string' ? m : null
  } catch {
    return null
  }
}

export async function listarAlunos(fs: Firestore, agora = new Date()) {
  const [usuarios, docs] = await Promise.all([fs.consulta('usuarios', 'papel', 'aluno'), fs.consulta('mesos')])
  const mesos = docs.flatMap((d) => lerMeso(d) ?? [])
  return usuarios
    .map((u) => {
      const meus = mesos.filter((m) => m.alunoId === u.id)
      const a = mesoAtual(meus, agora)
      const prox = proximoMeso(meus, agora)
      return {
        id: u.id,
        nome: texto(u.dados.nome),
        status: texto(u.dados.status),
        pagoAte: dia(u.dados.pagoAte),
        mesoAtual: a && a.estado.estado !== 'antes'
          ? { id: a.doc.id, nome: a.doc.nome, semana: a.estado.semana, de: a.doc.semanas, estado: a.estado.estado, inicio: a.doc.inicio.slice(0, 10), fim: fimISO(a.meso) }
          : null,
        temProximo: !!prox,
      }
    })
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
}

async function aluno(fs: Firestore, alunoId: string) {
  if (!uidOk(alunoId)) throw new ErroConector('alunoId inválido.')
  const u = await fs.doc(`usuarios/${alunoId}`)
  if (!u || u.dados.papel !== 'aluno') throw new ErroConector('Aluno não encontrado.')
  return u
}

export async function verAluno(fs: Firestore, alunoId: string) {
  const u = await aluno(fs, alunoId)
  const [anamneses, avaliacoes, notas, dores, checkins] = await Promise.all([
    fs.consulta('anamneses', 'alunoId', alunoId),
    fs.consulta('avaliacoes', 'alunoId', alunoId),
    fs.doc(`notas/${alunoId}`),
    fs.consulta('fisioDores', 'alunoId', alunoId),
    fs.consulta('fisioCheckins', 'alunoId', alunoId),
  ])
  const lidas = anamneses.flatMap((d) => lerAnamnese(d.id, d.dados) ?? [])
  const an = maisRecente(lidas)
  const av = avaliacoes.flatMap((d) => lerAvaliacao(d.id, d.dados) ?? []).sort((x, y) => y.data.localeCompare(x.data))[0]
  const em = (t: { toMillis(): number } | null) => t?.toMillis() ?? 0
  return {
    perfil: { id: u.id, nome: texto(u.dados.nome), status: texto(u.dados.status), pagoAte: dia(u.dados.pagoAte), pesoKg: typeof u.dados.pesoKg === 'number' ? u.dados.pesoKg : null },
    anamnese: an && {
      em: an.em ? new Date(an.em).toISOString() : null,
      origem: an.origem,
      pausadoPorSaude: pausadoSaude(lidas),
      sinaisDeAtencao: sinaisAtencao(an.r),
      obsCoach: an.obsCoach,
      ficha: fichaAnamnese(an.r),
    },
    ultimaAvaliacao: av ?? null,
    notasDoAluno: (notas?.dados.exercicios ?? {}) as Record<string, string>,
    dores: dores.flatMap((d) => lerDor(d.id, d.dados) ?? []).sort((x, y) => em(y.em) - em(x.em)).slice(0, 20)
      .map((d) => ({ em: isoMs(d.em), exercicio: d.exercicio, local: d.articulacao, tipo: d.tipo, intensidade: d.intensidade, momento: d.momento, texto: d.texto, respostaDoCoach: d.resposta })),
    checkins: checkins.flatMap((d) => lerCheckin(d.id, d.dados) ?? []).sort((x, y) => em(y.em) - em(x.em)).slice(0, 10)
      .map((c) => ({ em: isoMs(c.em), semana: c.sessao?.semana ?? null, treino: c.sessao?.treino ?? null, sono: c.sono, estresse: c.estresse, cansaco: c.cansaco, alimentacao: c.alimentacao, dor24h: c.dor24h })),
  }
}

// "40×10 42×8": carga×reps por série; "D" no começo da etapa de drop. Série sem nada = "-".
export function resumirCargas(cargas: (number | null)[] | undefined, reps: (number | null)[] | undefined, n: number, sufixo = ''): string {
  const total = Math.max(cargas?.length ?? 0, reps?.length ?? 0)
  if (![...(cargas ?? []), ...(reps ?? [])].some((v) => v != null)) return ''
  return Array.from({ length: total }, (_, j) => `${j >= n ? 'D' : ''}${cargas?.[j] ?? '-'}×${reps?.[j] ?? '-'}${sufixo}`).join(' ')
}

export async function verMesos(fs: Firestore, alunoId: string, mesoId?: string, agora = new Date()) {
  await aluno(fs, alunoId)
  const [docsMesos, docsRegs] = await Promise.all([fs.consulta('mesos', 'alunoId', alunoId), fs.consulta('registros', 'alunoId', alunoId)])
  const mesos = docsMesos.flatMap((d) => lerMeso(d) ?? []).filter((m) => !mesoId || m.id === mesoId).sort((a, b) => b.inicio.localeCompare(a.inicio))
  return mesos.map((md) => {
    const meso: Meso = docParaMeso(md)
    const regs = docsRegs.filter((d) => d.dados.mesoId === md.id).map((d) => d.dados as unknown as RegistroDoc)
    const cargas = docsParaRegistros(regs, meso)
    const reps = docsParaRegistrosReps(regs)
    const estado = semanaAtual(meso, agora)
    const treinos = Array.from({ length: meso.frequencia }, (_, t) => {
      const porPos: { pos: number; nome: string; semanas: Record<string, unknown>[] }[] = []
      for (let s = 1; s <= meso.semanas; s++) {
        for (const e of prescreverSessao(meso, s, t + 1)?.exercicios ?? []) {
          const sufixo = isometrico(e.slot) ? 's' : ''
          let linha = porPos.find((p) => p.pos === e.pos)
          if (!linha) porPos.push((linha = { pos: e.pos, nome: e.slot.nome, semanas: [] }))
          const feito = resumirCargas(cargas[`${s}-${t + 1}`]?.[e.slot.slotId], reps[`${s}-${t + 1}`]?.[e.slot.slotId], e.n, sufixo)
          linha.semanas.push({
            s,
            ...(e.slot.nome !== linha.nome && { nome: e.slot.nome }),
            prescrito: `${e.n}x ${e.reps.slice(0, e.n).join('/')}${sufixo}`,
            ...(e.rotulo && { metodo: e.rotulo }),
            ...(feito && { feito }),
          })
        }
      }
      return { treino: t + 1, exercicios: porPos }
    })
    return {
      id: md.id,
      nome: md.nome,
      situacao: estado.estado === 'durante' ? 'atual' : estado.estado === 'antes' ? 'proximo' : 'anterior',
      inicio: md.inicio.slice(0, 10),
      fim: fimISO(meso),
      semanas: meso.semanas,
      frequencia: meso.frequencia,
      dias: meso.dias ?? null,
      divisaoPlanejada: meso.divisao.map((exercicios, t) => ({ treino: t + 1, exercicios: exercicios.map((slot, i) => ({ pos: i + 1, slotId: slot.slotId, nome: slot.nome })) })),
      treinosConcluidos: regs.filter((r) => r.realizado).map((r) => `${r.semana}-${r.treino}`),
      treinos,
    }
  })
}

export const catalogoExercicios = () => ({
  grupos: catalogo.map((g) => ({ grupo: g.grupo, exercicios: g.exercicios.map((e) => e.nome) })),
  metodos: [...METODOS],
})
