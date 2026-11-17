// Conversão entre os tipos do motor (src/engine) e os documentos do Firestore. Funções puras.
import { prescreverSessao, type Cargas, type Meso, type Registros, type Slot } from '../engine'

// O Firestore proíbe array dentro de array. Por isso, no documento:
//   divisao:    Slot[][]            -> { t1: Slot[], t2: Slot[], … }       (t = treino, 1-based)
//   progressao: (number|null)[][]   -> { principais: { w1: […], w2: […] }, auxiliares: { w1: … } } (w = semana)
// Array dentro de mapa dentro de array (metodos[].cargaEtapa) é permitido e fica como está.
type Linhas<T> = Record<string, T[]>
//   progressao.padrao (opcional): igual a principais/auxiliares -> { w1: […], w2: … }
//   progressaoExercicio: Record<slotId, (number|null)[][]> -> { [slotId]: { w1: […], w2: … } }
export type MesoDoc = Omit<Meso, 'divisao' | 'progressao' | 'progressaoExercicio'> & {
  divisao: Linhas<Slot>
  progressaoExercicio?: Record<string, Linhas<number | null>>
  progressao: { principais: Linhas<number | null>; auxiliares: Linhas<number | null>; padrao?: Linhas<number | null> }
}

// Documento completo em mesos/{id}, como gravado por salvarMeso.
export type MesoSalvo = MesoDoc & { alunoId: string; nome: string; adaptadoEm?: unknown }

const paraMapa =<T>(linhas: T[][], p: string): Linhas<T> =>
  Object.fromEntries(linhas.map((l, i) => [`${p}${i + 1}`, l]))
// Pelo índice (não pela ordem das chaves): w10 vem depois de w9.
const deMapa = <T>(m: Linhas<T>, p: string): T[][] => Object.keys(m).map((_, i) => m[`${p}${i + 1}`])

// `sessoes` (treinos ajustados no presencial) nunca sai daqui: o editor do meso grava com updateDoc e não pode
// apagar nem regravar um ajuste feito no celular do coach. Só salvarSessaoEditada/voltarAoPlanejado mexem nelas.
export function mesoParaDoc({ sessoes: _s, prescricoesRegistradas: _p, prescricoesAnteriores: _a, historicoIncerto: _i, ...meso }: Meso): MesoDoc {
  return {
    ...meso,
    // Sempre presente: ao editar (updateDoc), trocas removidas não podem sobrar no documento.
    trocas: meso.trocas ?? {},
    adicoes: meso.adicoes ?? {},
    // Idem: sem agenda grava [] (nunca undefined); docParaMeso lê [] como "sem dias".
    dias: meso.dias ?? [],
    // Idem: "Voltar ao padrão" precisa apagar o override do documento.
    progressaoExercicio: Object.fromEntries(
      Object.entries(meso.progressaoExercicio ?? {}).map(([k, l]) => [k, paraMapa(l, 'w')]),
    ),
    divisao: paraMapa(meso.divisao, 't'),
    progressao: {
      principais: paraMapa(meso.progressao.principais, 'w'),
      auxiliares: paraMapa(meso.progressao.auxiliares, 'w'),
      // Sem `padrao` o campo não existe (o Firestore recusa undefined).
      ...(meso.progressao.padrao && { padrao: paraMapa(meso.progressao.padrao, 'w') }),
    },
  }
}

export function docParaMeso(d: MesoDoc): Meso {
  return {
    frequencia: d.frequencia,
    ...(d.prescricoesRegistradas && { prescricoesRegistradas: d.prescricoesRegistradas }),
    ...(d.prescricoesAnteriores && { prescricoesAnteriores: d.prescricoesAnteriores }),
    semanas: d.semanas,
    inicio: d.inicio,
    pausaS: d.pausaS,
    divisao: deMapa(d.divisao, 't'),
    trocas: d.trocas,
    progressao: {
      principais: deMapa(d.progressao.principais, 'w'),
      auxiliares: deMapa(d.progressao.auxiliares, 'w'),
      ...(d.progressao.padrao && { padrao: deMapa(d.progressao.padrao, 'w') }),
    },
    metodos: d.metodos,
    ...(d.pausaPrincipaisS != null && { pausaPrincipaisS: d.pausaPrincipaisS }),
    ...(d.progressaoPct != null && { progressaoPct: d.progressaoPct }),
    ...(d.limiteReps != null && { limiteReps: d.limiteReps }),
    ...(d.tempoLimiteMin != null && { tempoLimiteMin: d.tempoLimiteMin }),
    ...((d.dias?.length ?? 0) > 0 && { dias: d.dias }),
    ...(Object.keys(d.adicoes ?? {}).length > 0 && { adicoes: d.adicoes }),
    ...(Object.keys(d.sessoes ?? {}).length > 0 && { sessoes: d.sessoes }),
    ...(Object.keys(d.progressaoExercicio ?? {}).length > 0 && {
      progressaoExercicio: Object.fromEntries(
        Object.entries(d.progressaoExercicio!).map(([k, m]) => [k, deMapa(m, 'w')]),
      ),
    }),
  }
}

// Mesmo formato exigido por firestore.rules: {mesoId}_s{WW}_t{T}.
export const registroId = (mesoId: string, semana: number, treino: number) =>
  `${mesoId}_s${String(semana).padStart(2, '0')}_t${treino}`

// Coluna do motor (0-based) -> campo do documento (s1, s2, …).
export const caminhoCarga = (slotId: string, coluna: number) => `cargas.${slotId}.s${coluna + 1}`

type CargasDoc = Record<string, Record<string, number | null>>
export interface RegistroDoc {
  prescricaoRegistrada?: string
  semana: number
  treino: number
  cargas?: CargasDoc
  reps?: CargasDoc // reps feitas (opcional), mesmo formato das cargas
  lados?: CargasDoc // kg do lado esquerdo por série (formato novo de 2 lados); cargas continua o TOTAL
  rir?: CargasDoc // repetições que ainda faria no fim da série (0, 1, 2 ou 3 = 3 ou mais), mesmo formato das cargas
  pc?: Record<string, number> // peso do corpo somado por exercício (slotId -> kg; 0 = desligado)
  realizado?: boolean
}

// O aluno grava o registro direto no Firestore e as regras não conferem os valores de dentro de `cargas`:
// coluna fora de s1..s40 (s999999999 travaria a tela montando a lista) e valor que não é número finito
// até 2000 são ignorados na leitura. Negativo fica (máquina assistida, gravado antes do LoadInput de texto).
const MAX_COLUNA = 40
const numeroOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 2000

export function docParaCargas(cargas: CargasDoc | undefined): Cargas {
  const r: Cargas = {}
  for (const [slotId, cols] of Object.entries(cargas ?? {})) {
    const arr: (number | null)[] = []
    for (const [k, kg] of Object.entries(cols ?? {})) {
      const n = Number(/^s(\d{1,2})$/.exec(k)?.[1])
      if (n >= 1 && n <= MAX_COLUNA) arr[n - 1] = numeroOk(kg) ? kg : null
    }
    r[slotId] = Array.from(arr, (kg) => kg ?? null) // buracos viram null
  }
  return r
}

export const docParaReps = docParaCargas

// Repetições que sobraram (RIR) por série: só 0, 1, 2 ou 3 (3 = "3 ou mais"); o resto vira vazio. O aluno grava direto no
// Firestore e as regras só conferem que `rir` é mapa, então o conteúdo é desconfiado na leitura, como `cargas`.
export function docParaRir(rir: CargasDoc | undefined): Cargas {
  const r = docParaCargas(rir)
  for (const slotId of Object.keys(r)) r[slotId] = r[slotId].map((v) => (v != null && Number.isInteger(v) && v >= 0 && v <= 3 ? v : null))
  return r
}

// Peso do corpo por exercício: o que não é número de 0 a 300 conta como 0 (desligado).
export const lerPc = (pc: RegistroDoc['pc']): Record<string, number> =>
  Object.fromEntries(Object.entries(pc ?? {}).map(([slot, kg]) => [slot, numeroOk(kg) && kg > 0 && kg <= 300 ? kg : 0]))

const arred = (x: number) => Math.round(x * 100) / 100

// ÚNICA leitura de cargas de um registro (use sempre esta; nunca docParaCargas direto em tela ou cálculo).
// Convenção atual: a célula guarda o TOTAL (extra digitado + pc.<slot>). Versões antigas do app ainda
// rodam em abas e celulares abertos e gravaram de outro jeito; os dados não são reescritos, só lidos assim.
// Com pc[slot] > 0:
//  (i)   célula com c < pc: formato antigo (só o extra, pc marcado depois de digitar) -> conta c + pc.
//        No formato novo c >= pc sempre. Vale para todas as colunas, inclusive drop.
//  (ii)  célula vazia de série prescrita (coluna < n): conta pc se o registro foi concluído OU se há reps
//        feitas naquela série (versão sem `preencherCorpo`). Colunas de drop (>= n) nunca são preenchidas.
//  (iii) célula com c >= pc: fica como está.
// Sem pc (ou pc = 0) nada muda. `n` = séries prescritas por slotId; sem ele, n = maior índice com dado
// em cargas ou reps do slot (série vazia depois da última com dado não é conhecida, e uma coluna de
// drop com dado passaria por série). Por isso as telas passam o meso (ver docsParaRegistros).
export function normalizarCargas(
  doc: Pick<RegistroDoc, 'cargas' | 'reps' | 'pc' | 'realizado'>,
  n: Record<string, number> = {},
): Cargas {
  const r = docParaCargas(doc.cargas)
  const reps = docParaReps(doc.reps)
  for (const [slot, pc] of Object.entries(lerPc(doc.pc))) {
    if (!(pc > 0)) continue
    const cs = r[slot] ?? []
    const rs = reps[slot] ?? []
    const prescritas = n[slot] ?? Math.max(cs.length, rs.length)
    r[slot] = Array.from({ length: Math.max(cs.length, rs.length, prescritas) }, (_, k) => {
      const c = cs[k] ?? null
      if (c != null) return c < pc ? arred(c + pc) : c
      return k < prescritas && (doc.realizado || (rs[k] ?? 0) > 0) ? pc : null
    })
  }
  return r
}

// Séries prescritas (sem drop) de cada exercício do treino; só calculado quando o registro tem pc.
const seriesDe = (meso: Meso | undefined, d: RegistroDoc): Record<string, number> =>
  meso && Object.values(lerPc(d.pc)).some((p) => p > 0)
    ? Object.fromEntries((prescreverSessao(meso, d.semana, d.treino)?.exercicios ?? []).map((e) => [e.slot.slotId, e.n]))
    : {}

export const docsParaRegistros = (docs: RegistroDoc[], meso?: Meso): Registros =>
  Object.fromEntries(docs.map((d) => [`${d.semana}-${d.treino}`, normalizarCargas(d, seriesDe(meso, d))]))

// Lado esquerdo por série (só células no formato novo de 2 lados). Mesma chave de docsParaRegistros.
export const docsParaLados = (docs: RegistroDoc[]): Registros =>
  Object.fromEntries(docs.map((d) => [`${d.semana}-${d.treino}`, docParaCargas(d.lados)]))

export const docsParaRegistrosReps = (docs: RegistroDoc[]): Registros =>
  Object.fromEntries(docs.map((d) => [`${d.semana}-${d.treino}`, docParaReps(d.reps)]))

export const docsParaRegistrosRir = (docs: RegistroDoc[]): Registros =>
  Object.fromEntries(docs.map((d) => [`${d.semana}-${d.treino}`, docParaRir(d.rir)]))

// notas/{alunoId}: anotação do aluno por exercício (chave = nome do exercício; '' = sem nota).
// datas: quando cada anotação foi escrita (anotações de antes de 12/11/2026 não têm).
export type NotasDoc = { exercicios?: Record<string, string>; datas?: Record<string, { toMillis(): number } | null> }

// O que o aluno digitou num registro (cargas, reps, lados, rir por slot e coluna; pc por slot).
export type RegistroGravado = {
  cargas?: Record<string, object>
  reps?: Record<string, object>
  lados?: Record<string, object>
  rir?: Record<string, object>
  pc?: Record<string, unknown>
}
// Caminhos (campo a campo) que o cancelamento do treino apaga: tudo que o aluno digitou, inclusive o RIR (a resposta de uma
// tentativa cancelada não pode reaparecer marcada na seguinte).
export const caminhosParaCancelar = (atual: RegistroGravado): string[] => [
  ...(['cargas', 'reps', 'lados', 'rir'] as const).flatMap((mapa) =>
    Object.entries(atual[mapa] ?? {}).flatMap(([slot, cols]) => Object.keys(cols).map((k) => `${mapa}.${slot}.${k}`)),
  ),
  ...Object.keys(atual.pc ?? {}).map((slot) => `pc.${slot}`),
]
