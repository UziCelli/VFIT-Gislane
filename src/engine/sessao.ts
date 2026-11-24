import { isometrico, linhaIsometrica, LIMITE_ISOMETRIA_S } from './isometria'
import type { AplicacaoMetodo, ExercicioPrescrito, Meso, PolimentoExercicio, Sessao, SlotSessao } from './tipos'

// MAX da planilha: campos vazios valem 0 e MAX de nada é 0.
const max = (linhas: AplicacaoMetodo[], campo: (m: AplicacaoMetodo) => number | null | undefined) =>
  Math.max(0, ...linhas.map((m) => campo(m) ?? 0))

// §4 — o escopo cobre a série `pos`?
function cobre(m: AplicacaoMetodo, pos: number, n: number): boolean {
  if (m.escopo === 'Todas as séries') return true
  if (m.escopo === 'Série específica') return pos === m.serie
  const k = Number(m.escopo.split(' ')[1]) // 'Primeiras 2 séries' → 2
  return m.escopo.startsWith('Primeiras') ? pos <= k : pos > Math.max(0, n - k)
}

// §7 — sufixo do rótulo
function sufixo(m: AplicacaoMetodo): string {
  if (m.escopo === 'Todas as séries') return 'todas'
  if (m.escopo === 'Série específica') return `S${m.serie ?? ''}`
  return m.escopo.replace(' séries', '').toLowerCase() // 'Últimas 2 séries' → 'últimas 2'
}

// §8 — tamanho do bloco que divide uma pausa (Superset e Circuito: todas as posições)
const TAMANHO: Record<string, number> = { Biset: 2, Triset: 3, Superset: 0, Circuito: 0 }

// §8 — segundos extras de uma linha de método (AvTempo)
function extraTempo(m: AplicacaoMetodo): number {
  const p = m.pausaInternaS ?? 0
  const b = m.blocos ?? 0
  const ad = m.adicional ?? 0
  const rp = (m.repsPadrao ?? 0) > 0 ? m.repsPadrao! : (m.repsPorBloco ?? 0)
  if (m.metodo === 'Clusterset') return b > 1 ? rp * (b - 1) + p * (b - 1) : 0 // [CORRIGIDO]
  if (m.metodo === 'Dropset') return p * (m.etapas ?? 0)
  if (m.metodo === 'Rest-pause') return ad + p * (b > 1 ? b - 1 : 1)
  return ad + p * (b > 1 ? b - 1 : 0)
}

// Cópia congelada em que todo exercício ficou com 0 série é defeito de gravação, não histórico: vale o plano.
// (Ela nasce se o treino é iniciado, ou o histórico é protegido, quando o plano do dia estava vazio; sem este descarte
// o aluno vê "0 / —" para sempre, porque a cópia tem prioridade sobre o plano.)
export const copiaVazia = (p: { sessao: Sessao } | null | undefined): boolean =>
  !!p && p.sessao.exercicios.length > 0 && p.sessao.exercicios.every((e) => e.n === 0)

export function copiaDoDia(meso: Meso, semana: number, treino: number) {
  const p = meso.prescricoesRegistradas?.[`${semana}-${treino}`]
  return p && !copiaVazia(p) ? p : undefined
}

// Linha de reps de um exercício na semana: a própria (por slotId do slot da divisão, também numa troca),
// senão a padrão, senão o legado (principais pos 1–2, auxiliares 3–10).
export function linhaPrescrita(meso: Meso, semana: number, treino: number, pos: number): (number | null)[] {
  const slot = meso.divisao[treino - 1]?.[pos - 1]
  const iso = slot != null && isometrico(slot)
  const proprias = meso.progressaoExercicio?.[slot?.slotId ?? ''] ?? meso.progressaoExercicio?.[`${treino}-${pos}`]
  return (
    proprias?.[semana - 1] ??
    (iso ? linhaIsometrica() : undefined) ??
    meso.progressao.padrao?.[semana - 1] ??
    (pos <= 2 ? meso.progressao.principais : meso.progressao.auxiliares)[semana - 1] ??
    []
  )
}

// Exercícios do dia: a sessão editada no presencial, senão a divisão com as trocas pontuais (de = posição)
// e, no fim, as adições daquela semana (sem `de`: exercício novo).
export function slotsDaSessao(meso: Meso, semana: number, treino: number): SlotSessao[] {
  const preservada = copiaDoDia(meso, semana, treino)
  if (preservada) return preservada.sessao.exercicios.map((e) => ({ ...e.slot, repsRegistradas: e.repsBase ?? e.reps.slice(0, e.n), origemIsometrica: isometrico(e.slot), pausaRegistradaS: e.pausaS }))
  const editada = meso.sessoes?.[`${semana}-${treino}`]
  if (editada) return editada.exercicios
  return [
    ...(meso.divisao[treino - 1] ?? []).map((original, i) => ({ ...(meso.trocas?.[`${semana}-${treino}-${i + 1}`] ?? original), de: i + 1 })),
    ...(meso.adicoes?.[`${semana}-${treino}`] ?? []),
  ]
}

// Linhas de método do dia (ativas ou não): as da sessão editada, senão as do plano.
export const esforcoPolimento = (p?: Pick<PolimentoExercicio, 'folga' | 'degraus'>) => !!(p?.folga || p?.degraus)
export const intensificadorPolimento = (m: AplicacaoMetodo) => m.metodo === 'Dropset' || m.metodo === 'Rest-pause'

export function metodosDaSessao(meso: Meso, semana: number, treino: number): AplicacaoMetodo[] {
  const preservada = copiaDoDia(meso, semana, treino)
  if (preservada) return preservada.metodos
  const editada = meso.sessoes?.[`${semana}-${treino}`]
  if (editada) return editada.metodos
  const doTreino = meso.metodos.filter((m) => m.semana === semana && m.treino === treino)
  const pol = meso.polimentos?.[`${semana}-${treino}`]
  if (!pol) return doTreino
  const slots = slotsDaSessao(meso, semana, treino)
  // A mesma lista efetiva alimenta prescrição, contador, tela e a cópia histórica criada ao iniciar.
  return doTreino.filter(m => {
    if (!m.ativo || !intensificadorPolimento(m)) return true
    const slot = slots[m.exercicio - 1]
    const p = slot && pol[slot.slotId]
    return !(p && esforcoPolimento(p) && p.nome === slot.nome && !isometrico(slot))
  })
}

export function prescreverSessao(meso: Meso, semana: number, treino: number): Sessao | null {
  const preservada = copiaDoDia(meso, semana, treino)
  if (preservada) return structuredClone(preservada.sessao)
  if (semana < 1 || semana > meso.semanas || treino < 1 || treino > meso.frequencia) return null

  const [ano, mes, dia] = meso.inicio.slice(0, 10).split('-').map(Number)
  const inicioSemana = new Date(Date.UTC(ano, mes - 1, dia + 7 * (semana - 1))).toISOString().slice(0, 10)
  const editada = meso.sessoes?.[`${semana}-${treino}`]
  const doTreino = metodosDaSessao(meso, semana, treino).filter((m) => m.ativo)

  const exercicios = slotsDaSessao(meso, semana, treino).map(({ de: deGravado, origemSlotId, origemIsometrica, repsRegistradas, pausaRegistradaS, ...slot }, i): ExercicioPrescrito => {
    const pos = i + 1
    // Identidade estável nas novas sessões; legado ainda usa o slot atual ou a posição gravada.
    const agora = (meso.divisao[treino - 1] ?? []).findIndex((s, k) => origemSlotId
      ? s.slotId === origemSlotId
      : s.slotId === slot.slotId || meso.trocas?.[`${semana}-${treino}-${k + 1}`]?.slotId === slot.slotId)
    const de = deGravado != null && agora >= 0 ? agora + 1 : origemSlotId ? undefined : deGravado
    const planejado = de != null ? meso.divisao[treino - 1]?.[de - 1] : undefined
    const iso = isometrico(slot)
    const mesmaUnidade = planejado && isometrico(planejado) === iso
    // A exclusão guarda linhas por identidade; nunca reutilizar o `de` de uma origem estável excluída.
    const arquivada = agora < 0 && (!origemSlotId || origemIsometrica === iso)
      ? meso.progressaoExercicio?.[origemSlotId ?? slot.slotId]?.[semana - 1]
      : undefined
    const previsto = meso.polimentos?.[`${semana}-${treino}`]?.[slot.slotId]
    const polimento = !editada && previsto?.nome === slot.nome && !doTreino.some(m => m.exercicio === pos) ? previsto : undefined
    const linha = polimento?.reps ?? (origemIsometrica === undefined || origemIsometrica === iso ? repsRegistradas : undefined) ?? (iso ? meso.progressaoExercicio?.[slot.slotId]?.[semana - 1] : undefined) ?? arquivada ?? (mesmaUnidade ? linhaPrescrita(meso, semana, treino, de!) : iso ? linhaIsometrica() : (meso.progressao.padrao ?? meso.progressao.auxiliares)[semana - 1] ?? [])
    const base = (k: number) => linha[k - 1] ?? 0
    const n = linha.filter((r) => typeof r === 'number').length
    const linhas = doTreino.filter((m) => m.exercicio === pos)
    const dropLinhas = linhas.filter((m) => m.metodo === 'Dropset')

    // §5 — séries normais
    const reps: number[] = []
    const cargaSugerida: (number | null)[] = []
    for (let k = 1; k <= n; k++) {
      const cobrem = linhas.filter((m) => cobre(m, k, n))
      const pad = max(cobrem, (m) => m.repsPadrao)
      const bloco = max(cobrem, (m) => m.repsPorBloco)
      reps.push(pad > 0 ? pad : bloco > 0 ? bloco : base(k))
      cargaSugerida.push(null)
    }

    // §5/§6 — etapas extras do dropset. Cada linha pendura as etapas numa série: a específica (limitada a n),
    // senão a última série que o escopo cobre (Todas/Últimas = n). Linhas da mesma série se juntam (MAX).
    // Colunas depois das séries, em ordem de série; com uma série só são as mesmas de antes (cargas antigas no lugar).
    const serieDoDrop = (m: AplicacaoMetodo) =>
      m.escopo === 'Série específica'
        ? Math.min(m.serie || n, n)
        : Math.max(0, ...Array.from({ length: n }, (_, i) => i + 1).filter((k) => cobre(m, k, n))) || n
    const drops: { serie: number; etapa: number }[] = []
    for (const serie of [...new Set(dropLinhas.map(serieDoDrop))].sort((a, b) => a - b)) {
      const daSerie = dropLinhas.filter((m) => serieDoDrop(m) === serie)
      const et = max(daSerie, (m) => m.etapas)
      const padDrop = max(daSerie, (m) => m.repsPadrao)
      for (let passo = 1; passo <= et; passo++) {
        const repEt = max(daSerie, (m) => m.repsEtapa?.[passo - 1])
        reps.push(repEt > 0 ? repEt : padDrop > 0 ? padDrop : base(serie))
        cargaSugerida.push(daSerie[0].cargaEtapa?.[passo - 1] || null)
        drops.push({ serie, etapa: passo })
      }
    }

    if (iso) for (let k = 0; k < reps.length; k++) reps[k] = Math.min(LIMITE_ISOMETRIA_S, Math.max(1, reps[k]))
    const rotulo = linhas.map((m) => `${m.metodo} [${sufixo(m)}]`).join('; ')
    const pausaS = pausaRegistradaS ?? slot.pausaS ?? (de != null && de <= 2 ? (meso.pausaPrincipaisS ?? meso.pausaS) : meso.pausaS)
    return { pos, slot, n, reps, ...(polimento && { polimento: polimento.degraus, ...(polimento.folga != null && { folgaPolimento: polimento.folga }) }), repsBase: Array.from({ length: n }, (_, k) => base(k + 1)), rotulo, cargaSugerida, pausaS, drops }
  })

  // §8 — tempo
  const series = Math.max(0, ...exercicios.map((e) => e.n))
  // [DECIDIDO] exercícios do mesmo grupo dividem uma pausa só: com `grupo`, economiza (posições − 1);
  // sem `grupo`, agrupa por método em blocos de 2 (Biset), 3 (Triset) ou todos (Superset, 4+ exercícios, e Circuito).
  const grupos = new Map<string, Set<number>>()
  for (const m of doTreino) {
    if (!(m.metodo in TAMANHO)) continue
    const chave = `${m.metodo}|${m.grupo ?? ''}`
    grupos.set(chave, (grupos.get(chave) ?? new Set()).add(m.exercicio))
  }
  let economizados = 0
  for (const [chave, pos] of grupos) {
    const [metodo, grupo] = chave.split('|')
    const t = grupo || !TAMANHO[metodo] ? pos.size : TAMANHO[metodo]
    economizados += Math.floor(pos.size / t) * (t - 1)
  }
  const somaReps = exercicios.reduce((s, e) => s + e.reps.reduce((a, r) => a + r, 0), 0)
  const extras = doTreino.reduce((s, m) => s + extraTempo(m), 0)
  // A pausa de cada exercício é a do slot, senão a dos principais (pos 1–2), senão a do meso; a economia usa a pausa média.
  const somaPausas = exercicios.reduce((s, e) => s + e.pausaS, 0)
  const pausas = exercicios.length ? series * (somaPausas / exercicios.length) * Math.max(0, exercicios.length - economizados) : 0
  const tempoMin = 10 + (somaReps + pausas + extras) / 60

  return { semana, treino, inicioSemana, pausaS: meso.pausaS, series, exercicios, tempoMin }
}
