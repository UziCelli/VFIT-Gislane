// Ajudas da tela do aluno. Funções puras.
import { arredondarKg, arredondarNoAparelho, cargaEquivalente, cargaPessoal, corrigirDigitacao, isometrico, passoDoAparelho, passoPorLado, prescreverSessao, REPS_MAX_ORIGEM, repsEfetivas, type Aparelho, type Meso, type ModeloRm, type Registros } from '../engine'
import { diaSP } from './acesso'
import { normalizar } from './iaTreino'
import { doisLados, lerCelula } from './lados'
import { chaveModelo } from './rmPessoal'

// Semana w cobre os dias [inicio + 7(w−1), inicio + 7w), contados no calendário de São Paulo.
export function semanaAtual(meso: Meso, hoje: Date) {
  const d = diaSP(hoje.getTime()) - diaSP(Date.parse(`${meso.inicio.slice(0, 10)}T00:00-03:00`))
  if (d < 0) return { estado: 'antes' as const, semana: 1, diasParaComecar: -d }
  const semana = Math.floor(d / 7) + 1
  if (semana > meso.semanas) return { estado: 'depois' as const, semana: meso.semanas }
  return { estado: 'durante' as const, semana }
}

export type Pcs = Record<string, Record<string, number> | undefined>
// Registros de um meso, já convertidos (docsParaRegistros e companhia). `meso` com as prescrições registradas aplicadas.
export type Fonte = { meso: Meso; registros: Registros; reps?: Registros; lados?: Registros; pcs?: Pcs }
export type Origem = { semana: number; treino: number; anterior?: true } // anterior: veio do meso anterior

// Cargas da última vez em que o aluno anotou o mesmo exercício (pelo nome, já com trocas e sessões editadas).
// 1º, o mesmo treino da semana anterior mais recente (mesma prescrição; de preferência na mesma posição).
// Sem isso (o exercício é novo neste treino), qualquer outro treino: primeiro os anteriores da MESMA semana (do mais
// perto para o 1º), depois os das semanas anteriores (do último treino para o 1º). Lida pelo slotId daquele registro.
// Se o meso atual não tem nada, `opcoes.anterior` (meso anterior do aluno) entra pela mesma ordem, e só casa exercício de
// nome normalizado IDÊNTICO (acento, caixa e espaços não contam) com o mesmo `doisLados` e a mesma isometria: nunca por
// "contém" ("Supino Reto Barra" não é "Supino Reto Halter").
// `origem` (semana e treino de onde saiu; `anterior` se do meso anterior) deixa a tela avisar de onde veio.
// Com `repsFeitas`, a série vem corrigida de digitação óbvia (corrigirDigitacao) e ajustada às reps de hoje pela tabela de
// RM (`estimada: true`); reps não anotadas valem as prescritas naquele dia. A carga estimada cai no degrau real do aparelho
// (passoDoAparelho: halter, placa, polia...); a anotada não é arredondada.
// Devolve `series` (S1..Sn daquele registro) e `drops` separados: o n muda entre registros. `drops[j]` segue os drops
// de hoje: a mesma etapa da mesma série naquele registro, senão a mesma etapa de outra série (o drop mudou de série).
// Sem `pcs`, devolve o total gravado. Com `pcs` (`${semana}-${treino}` -> { slotId: kg do corpo }),
// devolve só o extra: total menos o corpo DAQUELE registro (o de hoje pode ser outro), nunca negativo.
export function cargaAnterior(
  meso: Meso,
  registros: Registros,
  semana: number,
  treino: number,
  pos: number,
  pcs?: Pcs,
  lados?: Registros, // lado esquerdo por série (docsParaLados); só usado em exercício de 2 lados
  repsFeitas?: Registros, // reps anotadas (docsParaRegistrosReps). Dado, liga a correção e o ajuste às reps de hoje
  // modelos: modeloPorExercicio (lib/rmPessoal.ts). aparelho: o do catálogo (engine/aparelho.ts) em que o aluno treina hoje;
  // passa por cima do degrau padrão do tipo. Aparelho em nível: o anotado é nível, então não há ajuste por reps.
  opcoes?: { anterior?: Fonte | null; modelos?: Map<string, ModeloRm> | null; aparelho?: Aparelho | null },
) {
  const hoje = prescreverSessao(meso, semana, treino)?.exercicios[pos - 1]
  const alvo = hoje?.slot
  if (!hoje || !alvo) return null
  const dois = doisLados(alvo)
  const iso = isometrico(alvo)
  const nomeAlvo = normalizar(alvo.nome)
  const ajusta = !!repsFeitas
  const modelo = ajusta ? opcoes?.modelos?.get(chaveModelo(alvo.nome, dois, iso)) : undefined
  const emNivel = opcoes?.aparelho?.unidade === 'nivel'
  // 2 lados: o aparelho do catálogo só vale se for por lado (`porLado`); senão, o degrau por lado do tipo (passoPorLado).
  // SUPOSIÇÃO: aparelho de 2 lados cadastrado sem `porLado` tem incremento do total, que não serve para um lado só.
  const ap = opcoes?.aparelho && (!dois || opcoes.aparelho.porLado) ? opcoes.aparelho : null
  // Com aparelho do catálogo em kg: conta fina e arredonda no aparelho (incremento, mínimo e máximo dele).
  const passo = ap ? 0.001 : passoDoAparelho(alvo.nome)
  const noAparelho = (kg: number | null) => (kg == null || !ap ? kg : arredondarNoAparelho(ap, kg))
  const passoLado = passoPorLado(alvo.nome)
  const noLado = (kg: number) => (ap ? arredondarNoAparelho(ap, kg) : arredondarKg(kg, passoLado))
  const tentar = (f: Fonte, w: number, t: number, doAnterior: boolean) => {
    const chave = `${w}-${t}`
    const reg = f.registros[chave]
    if (!reg) return null // sem registro: nem monta a sessão daquele dia
    const exs = prescreverSessao(f.meso, w, t)?.exercicios ?? []
    const mesmo = (e: (typeof exs)[number]) =>
      doAnterior ? normalizar(e.slot.nome) === nomeAlvo && doisLados(e.slot) === dois && isometrico(e.slot) === iso : e.slot.nome === alvo.nome
    // 2 lados: só vale célula no formato novo (a antiga não diz se o número era por lado ou total).
    const comCarga = (e: (typeof exs)[number]) => {
      const cs = reg[e.slot.slotId]
      const ls = f.lados?.[chave]?.[e.slot.slotId]
      return mesmo(e) && !!cs?.some((c, i) => c != null && (!dois || ls?.[i] != null))
    }
    const e = (t === treino ? [exs[pos - 1], ...exs] : exs).find((x) => x && comCarga(x))
    if (!e) return null
    const cargas = reg[e.slot.slotId]
    const corpo = f.pcs?.[chave]?.[e.slot.slotId] ?? 0
    const cels = dois ? cargas.map((c, i) => lerCelula(c, f.lados?.[chave]?.[e.slot.slotId]?.[i], corpo)) : null
    const extra: (number | null | undefined)[] = [...(cels ? cels.map((c) => c.esq) : corpo > 0 ? cargas.map((c) => (c == null ? null : Math.max(0, Math.round((c - corpo) * 100) / 100))) : cargas)] // cópia: abaixo pode ser ajustada
    const fatiar = (v: (number | null | undefined)[]) => ({
      series: v.slice(0, e.n).map((x) => x ?? null),
      drops: hoje.drops.map(({ serie, etapa }) => {
        const j = e.drops.findIndex((d) => d.serie === serie && d.etapa === etapa)
        const k = j >= 0 ? j : e.drops.findIndex((d) => d.etapa === etapa)
        return k >= 0 ? (v[e.n + k] ?? null) : null
      }),
    })
    // Ajuste às reps de hoje: série comum, sem peso do corpo, sem isometria, sem aparelho em nível; drop fica como foi anotado.
    // 2 lados: a conta é feita na MÉDIA por lado ((esq + dir) / 2) e a mesma proporção vale para o esquerdo e o direito
    // (10 | 8 vira, por exemplo, 11 | 9), cada lado no degrau por lado (passoPorLado).
    let estimada = false
    const dirs = cels ? cels.map((c) => c.dir) : null // cópia: abaixo pode ser ajustada
    if (ajusta && !corpo && !iso && !emNivel) {
      const feitas = repsEfetivas(e.reps, (doAnterior ? f.reps : repsFeitas)?.[chave]?.[e.slot.slotId])
      const fino = dois ? 0.001 : passo // 2 lados: conta sem arredondar; arredonda cada lado no fim
      // 2 lados: cópias de esquerdo e direito; a digitação é corrigida em CADA lado (600 num braço só não mexe no outro).
      const esq0 = cels ? cels.map((c) => c.esq) : null
      const dir0 = cels ? cels.map((c) => c.dir) : null
      if (esq0 && dir0 && dirs) {
        for (const [lado, saida] of [[esq0, extra], [dir0, dirs]] as const) {
          const limpa = corrigirDigitacao(lado.slice(0, e.n), feitas.slice(0, e.n), fino)
          limpa.trocadas.forEach((k) => {
            lado[k] = limpa.series[k]
            saida[k] = noLado(limpa.series[k]!)
          })
          if (limpa.trocadas.length) estimada = true
        }
      }
      const media0 = esq0 && dir0 ? esq0.map((x, k) => (x != null && dir0[k] != null ? (x + dir0[k]!) / 2 : null)) : null
      const base = media0 ?? extra
      // Grava a carga estimada `kg` (média por lado em 2 lados, na proporção entre os lados daquela série) na série k; true se mudou.
      const gravar = (k: number, kg: number) => {
        if (!esq0 || !dir0 || !dirs) {
          const v = noAparelho(kg)
          if (v === extra[k]) return false
          extra[k] = v
          return true
        }
        const m = media0![k]
        const esq = noLado(m ? (esq0[k]! * kg) / m : kg)
        const dir = noLado(m ? (dir0[k]! * kg) / m : kg)
        if (esq === extra[k] && dir === dirs[k]) return false
        extra[k] = esq
        dirs[k] = dir
        return true
      }
      // 1º, digitação óbvia (600 em vez de 60) vira a carga equivalente da mediana das séries (1 lado; 2 lados já foi acima).
      if (!media0) {
        const limpa = corrigirDigitacao(extra.slice(0, e.n), feitas.slice(0, e.n), fino)
        limpa.trocadas.forEach((k) => gravar(k, limpa.series[k]!))
        if (limpa.trocadas.length) estimada = true
      }
      // 2º, reps de hoje diferentes das daquele registro: a carga vira a equivalente. Com o modelo pessoal do aluno (curva dele,
      // presa a −12%/+8% da tabela); sem dado suficiente, pela tabela de RM (engine/rm.ts). Reps iguais: fica como foi anotado.
      base.forEach((c, k) => {
        if (k >= e.n || k >= hoje.n) return
        // Reps iguais, ou fora de 1..15 no registro de origem (0, vazio ou acima de 15 não servem de base, nem para o modelo):
        // fica como foi anotado.
        const baseValida = feitas[k] >= 1 && feitas[k] <= REPS_MAX_ORIGEM
        if (c != null && (feitas[k] === hoje.reps[k] || !baseValida)) return
        const kg = (modelo ? cargaPessoal(modelo, hoje.reps[k], k, fino) : null) ?? (c != null ? cargaEquivalente(c, feitas[k], hoje.reps[k], fino) : null)
        if (kg != null && gravar(k, kg)) estimada = true
      })
    }
    // `dir`: lado direito (só em 2 lados); `series`/`drops` ficam com o esquerdo.
    return {
      ...fatiar(extra),
      ...(dirs && { dir: fatiar(dirs) }),
      origem: { semana: w, treino: t, ...(doAnterior && { anterior: true as const }) } as Origem,
      estimada,
    }
  }
  const atual: Fonte = { meso, registros, reps: repsFeitas, lados, pcs }
  const fontes: [Fonte, boolean][] = [[atual, false]]
  if (opcoes?.anterior) fontes.push([opcoes.anterior, true])
  for (const [f, doAnterior] of fontes) {
    const ultima = doAnterior ? f.meso.semanas : semana // semana mais recente a olhar (a atual só vale nos treinos anteriores a este)
    // Mesmo treino das semanas anteriores (mesma prescrição) primeiro.
    for (let w = doAnterior ? ultima : semana - 1; treino <= f.meso.frequencia && w >= 1; w--) {
      const r = tentar(f, w, treino, doAnterior)
      if (r) return r
    }
    // Exercício novo neste treino: a carga mais recente em outro treino.
    for (let w = ultima; w >= 1; w--)
      for (let t = !doAnterior && w === semana ? treino - 1 : f.meso.frequencia; t >= 1; t--) {
        const r = t === treino ? null : tentar(f, w, t, doAnterior)
        if (r) return r
      }
  }
  return null
}
