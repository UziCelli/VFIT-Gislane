// Oscilações por segmento entre duas avaliações: carga, frequência, volume, dor relatada e medida.
// INFERÊNCIA INTERPRETATIVA sobre o histórico do aluno, nunca causa e efeito: não há evidência que ligue,
// no indivíduo, carga ou dor à mudança de perímetro (docs/evidencias-avaliacao.md, item 4). Só o coach vê:
// usa relato de dor (dado de saúde), então nunca vai ao relatório do aluno, ao PDF, à IA nem ao log. Funções puras.
import { diaSP } from './acesso'
import { LIMIAR_TRONCO_CM, type Avaliacao } from './avaliacao'
import type { RelatoDor } from './dor'
import type { Ocorrencia } from './evolucao'
import { cargaPorSegmento, medidaSegmento, segmentoDoExercicio, SEGMENTOS, type SegmentoId } from './segmentos'

// Articulação do relato de dor → segmentos que ela costuma envolver (quando o exercício não está no catálogo).
const DA_ARTICULACAO: Record<string, SegmentoId[]> = {
  ombro: ['ombros', 'peito', 'costas'], cotovelo: ['bracos', 'antebracos'], punho: ['antebracos'], cervical: ['ombros', 'costas'],
  lombar: ['costas', 'abdomen'], quadril: ['quadril', 'coxas'], joelho: ['coxas'], tornozelo: ['panturrilhas'],
}
// Tronco: oscila mais por gordura e líquido (respiração, refeição, retenção). Limiar maior e leitura mais cautelosa.
export const TRONCO = new Set<SegmentoId>(['peito', 'abdomen'])
const LIMIAR_FREQ = 0.25 // queda ou alta de 25% nas sessões por semana

export type Oscilacao = {
  id: SegmentoId
  rotulo: string
  fatos: string[]
  inferencia: string | null
}

const diaISO = (iso: string) => diaSP(Date.parse(`${iso}T12:00Z`))
const fmt = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

// Sessões (dias distintos) do segmento em cada metade da janela.
function frequencia(hist: Record<string, Ocorrencia[]>, seg: SegmentoId, de: number, ate: number) {
  const meio = de + (ate - de) / 2
  const dias = new Set<number>()
  for (const [nome, os] of Object.entries(hist)) {
    if (segmentoDoExercicio(nome) !== seg) continue
    for (const o of os) if (o.conta && o.dia != null && o.dia >= de && o.dia <= ate) dias.add(o.dia)
  }
  const xs = [...dias]
  const semanas = Math.max(1, (ate - de) / 7)
  return { porSemana: xs.length / semanas, antes: xs.filter((d) => d < meio).length, depois: xs.filter((d) => d >= meio).length }
}

export function oscilacoes(atual: Avaliacao, ant: Avaliacao, hist: Record<string, Ocorrencia[]>, dores: RelatoDor[]): Oscilacao[] {
  const de = diaISO(ant.data)
  const ate = diaISO(atual.data)
  if (ate <= de) return []
  const carga = cargaPorSegmento(hist, ant.data, atual.data)
  const doresJanela = dores.filter((d) => {
    const ms = d.em?.toMillis()
    if (ms == null) return false
    const dia = diaSP(ms)
    return dia >= de && dia <= ate && d.tipo === 'dor'
  })
  return SEGMENTOS.flatMap((seg): Oscilacao[] => {
    const fatos: string[] = []
    const tronco = TRONCO.has(seg.id)
    const m = medidaSegmento(seg, atual, ant)
    const dPerim = m ? m.cm : null
    const limiar = tronco ? LIMIAR_TRONCO_CM : 0.5
    const medidaMexeu = dPerim != null && Math.abs(dPerim) >= limiar
    if (m) fatos.push(`Medida ${m.delta}${medidaMexeu ? '' : ' (dentro do erro de medida)'}`)

    const c = carga[seg.id]
    if (c) fatos.push(`Carga ${c.pct >= 0 ? '+' : '−'}${fmt(Math.abs(c.pct))}% (${c.n} ${c.n === 1 ? 'exercício' : 'exercícios'})`)
    const f = frequencia(hist, seg.id, de, ate)
    let freq: 'caiu' | 'subiu' | null = null
    if (f.antes + f.depois > 0) {
      fatos.push(`${fmt(f.porSemana)} ${f.porSemana === 1 ? 'treino' : 'treinos'} por semana`)
      const base = Math.max(f.antes, 1)
      if ((f.depois - f.antes) / base <= -LIMIAR_FREQ && f.antes >= 2) freq = 'caiu'
      else if ((f.depois - f.antes) / base >= LIMIAR_FREQ && f.depois >= 2) freq = 'subiu'
      if (freq) fatos.push(`Frequência ${freq} na 2ª metade do período (${f.antes} → ${f.depois} treinos)`)
    }
    const dSeg = doresJanela.filter((d) => {
      const s = segmentoDoExercicio(d.exercicio)
      return s ? s === seg.id : d.articulacao !== 'outro' && (DA_ARTICULACAO[d.articulacao] ?? []).includes(seg.id)
    })
    if (dSeg.length) fatos.push(`${dSeg.length} ${dSeg.length === 1 ? 'relato' : 'relatos'} de dor (máx. ${Math.max(...dSeg.map((d) => d.intensidade))}/10)`)
    if (!fatos.length) return []

    const caiuTreino = c?.classe === 'cai' || freq === 'caiu'
    const desceu = medidaMexeu && dPerim! < 0
    let inferencia: string | null = null
    if (dSeg.length && caiuTreino) inferencia = `A dor relatada pode ter levado a menos carga ou menos treino neste segmento${desceu ? ', e a medida menor pode acompanhar isso' : ''}.`
    else if (dSeg.length && c?.classe === 'sobe') inferencia = 'A carga seguiu subindo apesar da dor relatada: vale acompanhar se a dor se mantém.'
    else if (dSeg.length) inferencia = 'Houve dor relatada sem mudança clara de carga ou frequência.'
    else if (caiuTreino && desceu) inferencia = 'Menos carga ou menos treino no período pode ajudar a explicar a medida menor.'
    else if (caiuTreino) inferencia = 'Carga ou frequência caiu no período, sem mudança clara na medida.'
    else if (c?.classe === 'sobe' && medidaMexeu && dPerim! > 0 && !tronco) inferencia = 'Carga e medida subiram juntas; força e tamanho, porém, nem sempre andam juntos no indivíduo.'
    if (tronco && m) inferencia = `${inferencia ? inferencia + ' ' : ''}Tórax, cintura e abdômen oscilam mais por gordura e líquido: leia a medida com cautela.`
    return [{ id: seg.id, rotulo: seg.rotulo, fatos, inferencia }]
  })
}
