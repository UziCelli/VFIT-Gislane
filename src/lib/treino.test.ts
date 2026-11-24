import { describe, expect, it } from 'vitest'
import { passoPorLado, type Aparelho, type Meso, type Slot } from '../engine'
import { cargaAnterior, semanaAtual } from './treino'

const sp = (iso: string) => new Date(`${iso}-03:00`)
const slot = (slotId: string, nome: string): Slot => ({ slotId, nome })

const base: Meso = {
  frequencia: 1,
  semanas: 4,
  inicio: '2026-10-05', // segunda
  pausaS: 60,
  divisao: [[slot('a', 'Supino'), slot('b', 'Agachamento')]],
  progressao: { principais: [], auxiliares: [] },
  metodos: [],
}

describe('semanaAtual (dia de calendário em São Paulo)', () => {
  it('antes do início: semana 1 e dias para começar', () => {
    expect(semanaAtual(base, sp('2026-10-04T23:59'))).toEqual({ estado: 'antes', semana: 1, diasParaComecar: 1 })
    expect(semanaAtual(base, sp('2026-09-28T08:00'))).toEqual({ estado: 'antes', semana: 1, diasParaComecar: 7 })
  })
  it('conta pelo dia de São Paulo, não UTC', () => {
    // 04/10 23:30 em SP já é dia 05 em UTC
    expect(semanaAtual(base, sp('2026-10-04T23:30')).estado).toBe('antes')
    // 11/10 23:30 em SP ainda é semana 1 (em UTC já seria 12/10)
    expect(semanaAtual(base, sp('2026-10-11T23:30'))).toEqual({ estado: 'durante', semana: 1 })
  })
  it('semana w cobre [inicio+7(w−1), inicio+7w)', () => {
    expect(semanaAtual(base, sp('2026-10-05T00:00'))).toEqual({ estado: 'durante', semana: 1 })
    expect(semanaAtual(base, sp('2026-10-12T00:00'))).toEqual({ estado: 'durante', semana: 2 })
    expect(semanaAtual(base, sp('2026-11-01T23:59'))).toEqual({ estado: 'durante', semana: 4 })
  })
  it('depois do fim: última semana', () => {
    expect(semanaAtual(base, sp('2026-11-02T00:00'))).toEqual({ estado: 'depois', semana: 4 })
    expect(semanaAtual(base, sp('2027-03-01T12:00'))).toEqual({ estado: 'depois', semana: 4 })
  })
})

describe('cargaAnterior', () => {
  const meso: Meso = {
    ...base,
    progressao: { principais: [[10, 10], [10, 10], [10, 10], [10, 10]], auxiliares: [[10, 10], [10, 10], [10, 10], [10, 10]] },
    trocas: {
      '2-1-1': slot('x', 'Remada'), // outro exercício na semana 2
      '4-1-2': slot('b4', 'Agachamento'), // mesmo nome, outro slotId
    },
  }
  const registros = {
    '1-1': { a: [40, 42], b: [80] },
    '2-1': { x: [30], b: [] },
    '3-1': { a: [null, null], b: [90, null] },
  }

  it('semana anterior mais recente com o mesmo nome, pelo slotId daquela semana', () => {
    expect(cargaAnterior(meso, registros, 4, 1, 2)).toMatchObject({ series: [90, null], drops: [] }) // s4 b4 ← s3 b
  })
  it('pula semana sem carga e semana com exercício trocado', () => {
    expect(cargaAnterior(meso, registros, 4, 1, 1)).toMatchObject({ series: [40, 42], drops: [] }) // s3 vazia, s2 Remada
    expect(cargaAnterior(meso, registros, 3, 1, 2)).toMatchObject({ series: [80], drops: [] }) // s2 b = []
  })
  it('null quando não há carga anterior', () => {
    expect(cargaAnterior(meso, registros, 1, 1, 1)).toBeNull()
    expect(cargaAnterior(meso, registros, 2, 1, 1)).toBeNull() // Remada não aparece antes
    expect(cargaAnterior(meso, {}, 4, 1, 1)).toBeNull()
    expect(cargaAnterior(meso, registros, 4, 1, 9)).toBeNull() // posição inexistente
  })
  it('com pcs, devolve só o extra: total menos o peso do corpo DAQUELE registro (não o de hoje)', () => {
    const pcs = { '3-1': { b: 76 }, '1-1': { b: 0 } }
    expect(cargaAnterior(meso, registros, 4, 1, 2, pcs)).toMatchObject({ series: [14, null], drops: [] }) // 90 - 76
    expect(cargaAnterior(meso, registros, 3, 1, 2, pcs)).toMatchObject({ series: [80], drops: [] }) // s1 b: pc 0, total = extra
    expect(cargaAnterior(meso, { '3-1': { b: [70, 90] } }, 4, 1, 2, pcs)).toMatchObject({ series: [0, 14], drops: [] }) // nunca negativo
  })
  it('separa séries e drops pelo n da semana anterior (3 séries + D1 vs. 4 séries hoje)', () => {
    const m: Meso = {
      ...base,
      divisao: [[slot('a', 'Supino')]],
      progressao: { principais: [[10, 10, 10], [10, 10, 10, 10]], auxiliares: [] },
      metodos: [{ semana: 1, treino: 1, exercicio: 1, metodo: 'Dropset', ativo: true, escopo: 'Últimas 2 séries', etapas: 1 }],
    }
    const r = cargaAnterior(m, { '1-1': { a: [50, 50, 50, 30] } }, 2, 1, 1)
    expect(r).toMatchObject({ series: [50, 50, 50], drops: [] }) // hoje não tem drop
    expect(r!.series[3]).toBeUndefined() // S4 não herda o D1
    const comDrop = { ...m, metodos: [...m.metodos, { ...m.metodos[0], semana: 2 }] }
    expect(cargaAnterior(comDrop, { '1-1': { a: [50, 50, 50, 30] } }, 2, 1, 1)!.drops).toEqual([30]) // D1 da S3 → D1 da S4
  })

  it('drops seguem a série: o D1 da S1 puxa o D1 da S1 da semana anterior', () => {
    const d = (semana: number, serie: number, etapas: number) =>
      ({ semana, treino: 1, exercicio: 1, metodo: 'Dropset', ativo: true, escopo: 'Série específica', serie, etapas }) as const
    const m: Meso = {
      ...base,
      divisao: [[slot('a', 'Supino')]],
      progressao: { principais: [[10, 10, 10], [10, 10, 10]], auxiliares: [] },
      metodos: [d(1, 1, 1), d(1, 3, 2), d(2, 3, 1)], // semana 2: só o drop da S3
    }
    // semana 1: S1 S2 S3 | S1·D1=40 | S3·D1=30 S3·D2=20
    expect(cargaAnterior(m, { '1-1': { a: [60, 60, 60, 40, 30, 20] } }, 2, 1, 1)!.drops).toEqual([30])
  })
})

describe('cargaAnterior com treino ajustado no presencial', () => {
  const m: Meso = {
    frequencia: 1, semanas: 2, inicio: '2026-01-05', pausaS: 60,
    divisao: [[{ slotId: 'A', nome: 'Supino' }, { slotId: 'B', nome: 'Remada' }]],
    progressao: { principais: [[10, 10], [10, 10]], auxiliares: [[12, 12], [12, 12]] },
    metodos: [],
    sessoes: { '2-1': { semana: 2, treino: 1, exercicios: [{ slotId: 'B', nome: 'Remada', de: 2 }, { slotId: 'n', nome: 'Supino' }], metodos: [] } },
  }
  it('acha o mesmo exercício em outra posição da semana anterior', () => {
    const regs = { '1-1': { A: [50, 52], B: [30, null] } }
    expect(cargaAnterior(m, regs, 2, 1, 1)).toMatchObject({ series: [30, null], drops: [] })
    expect(cargaAnterior(m, regs, 2, 1, 2)).toMatchObject({ series: [50, 52], drops: [] })
  })
})

describe('cargaAnterior com 2 lados', () => {
  const meso: Meso = {
    ...base,
    divisao: [[slot('r', 'Rosca Direta Halter'), slot('s', 'Supino')]],
    progressao: { principais: [[10, 10], [10, 10], [10, 10]], auxiliares: [] },
  }
  it('ignora célula antiga (sem lados): não dá para saber se era por lado ou total', () => {
    expect(cargaAnterior(meso, { '1-1': { r: [12, 12] } }, 2, 1, 1)).toBeNull()
    expect(cargaAnterior(meso, { '1-1': { r: [12, 12] } }, 2, 1, 1, undefined, {})).toBeNull()
  })
  it('célula nova: devolve o esquerdo e o direito por lado', () => {
    const r = cargaAnterior(meso, { '1-1': { r: [12, 14] } }, 2, 1, 1, undefined, { '1-1': { r: [6, 6] } })
    expect(r).toMatchObject({ series: [6, 6], drops: [], dir: { series: [6, 8], drops: [] } })
  })
  it('com corpo no registro de origem, o direito sai de total - corpo - esquerdo', () => {
    const r = cargaAnterior(meso, { '1-1': { r: [92] } }, 2, 1, 1, { '1-1': { r: 80 } }, { '1-1': { r: [6] } })
    expect(r!.series).toEqual([6])
    expect(r!.dir!.series).toEqual([6])
  })
  it('pula a semana antiga e usa a anterior no formato novo', () => {
    const r = cargaAnterior(meso, { '1-1': { r: [10] }, '2-1': { r: [20] } }, 3, 1, 1, undefined, { '1-1': { r: [5] } })
    expect(r!.series).toEqual([5])
  })
  it('exercício comum não muda (sem dir)', () => {
    expect(cargaAnterior(meso, { '1-1': { s: [50] } }, 2, 1, 2)).toMatchObject({ series: [50], drops: [] })
  })
})


describe('cargaAnterior com 2 lados ajustada às reps de hoje', () => {
  // Semana 1: 10 reps; semana 2: 8 reps.
  const m2 = (nome: string, extra: Partial<Slot> = { doisLados: true }): Meso => ({
    frequencia: 1, semanas: 2, inicio: '2026-01-05', pausaS: 60,
    divisao: [[{ slotId: 'r', nome, ...extra }]],
    progressao: { principais: [[10, 10], [8, 8]], auxiliares: [[10, 10], [8, 8]] },
    metodos: [],
  })
  it('halter: média por lado sobe pela tabela, cada lado no degrau do halter', () => {
    const r = cargaAnterior(m2('Supino Reto Halter'), { '1-1': { r: [56, 56] } }, 2, 1, 1, undefined, { '1-1': { r: [28, 28] } }, {})
    expect(r).toMatchObject({ series: [30, 30], dir: { series: [30, 30] }, estimada: true }) // 28 × ~1,05 = 29,4 → halter de 2 em 2
  })
  it('articulada: lados diferentes mantêm a proporção, de 1,25 em 1,25 por lado', () => {
    const r = cargaAnterior(m2('Remada Articulada'), { '1-1': { r: [40] } }, 2, 1, 1, undefined, { '1-1': { r: [22] } }, {})
    expect(r).toMatchObject({ series: [22.5], dir: { series: [18.75] }, estimada: true }) // 22 | 18 × ~1,05 = 23,1 | 18,9
  })
  it('polia e seletora de 2 lados: cada lado mantém o degrau da pilha (2,5)', () => {
    const r = cargaAnterior(m2('Crucifixo na Polia'), { '1-1': { r: [40] } }, 2, 1, 1, undefined, { '1-1': { r: [20] } }, {})
    expect(r).toMatchObject({ series: [20], dir: { series: [20] }, estimada: false }) // 21 → 20 na pilha de 2,5
    expect(passoPorLado('Crucifixo na Polia')).toBe(2.5)
    expect(passoPorLado('Cadeira Extensora')).toBe(2.5)
    expect(passoPorLado('Remada Articulada')).toBe(1.25)
  })
  it('reps iguais: fica como foi anotado', () => {
    const m = m2('Remada Articulada')
    const r = cargaAnterior({ ...m, progressao: { principais: [[10], [10]], auxiliares: [[10], [10]] } }, { '1-1': { r: [40] } }, 2, 1, 1, undefined, { '1-1': { r: [22] } }, {})
    expect(r).toMatchObject({ series: [22], dir: { series: [18] }, estimada: false })
  })
  it('com peso do corpo no registro: sem ajuste (como antes)', () => {
    const r = cargaAnterior(m2('Remada Articulada'), { '1-1': { r: [120] } }, 2, 1, 1, { '1-1': { r: 80 } }, { '1-1': { r: [20] } }, {})
    expect(r).toMatchObject({ series: [20], dir: { series: [20] }, estimada: false })
  })
  it('aparelho do catálogo: só vale em 2 lados se for por lado', () => {
    const ap: Aparelho = { id: 'x', nome: 'Articulada', local: 'X', tipo: 'maquina', unidade: 'kg', incremento: 5 }
    const regs = { '1-1': { r: [40] } }
    const lados = { '1-1': { r: [20] } }
    // sem porLado: ignora o catálogo e usa 1,25 por lado (20 × ~1,05 = 21 → 21,25)
    expect(cargaAnterior(m2('Remada Articulada'), regs, 2, 1, 1, undefined, lados, {}, { aparelho: ap })).toMatchObject({ series: [21.25], dir: { series: [21.25] } })
    expect(cargaAnterior(m2('Remada Articulada'), regs, 2, 1, 1, undefined, lados, {}, { aparelho: { ...ap, porLado: true } })).toMatchObject({ series: [20], dir: { series: [20] } })
  })
})

describe('cargaAnterior: exercício que reaparece em outro treino', () => {
  // Treino 1: Supino (a) e Remada (b). Treino 2: Supino (c) e Agachamento (d).
  const m: Meso = {
    frequencia: 2, semanas: 3, inicio: '2026-01-05', pausaS: 60,
    divisao: [[slot('a', 'Supino'), slot('b', 'Remada')], [slot('c', 'Supino'), slot('d', 'Agachamento')]],
    progressao: { principais: [[10, 10], [10, 10], [10, 10]], auxiliares: [[10, 10], [10, 10], [10, 10]] },
    metodos: [],
  }
  it('treino novo para o exercício: usa a carga de outro treino da mesma semana', () => {
    const r = cargaAnterior(m, { '1-1': { a: [60, 62] } }, 1, 2, 1)
    expect(r).toMatchObject({ series: [60, 62], origem: { semana: 1, treino: 1 } })
  })
  it('o mesmo treino da semana anterior continua tendo prioridade (mesma prescrição)', () => {
    const regs = { '1-2': { c: [70] }, '2-1': { a: [50] } }
    expect(cargaAnterior(m, regs, 2, 2, 1)).toMatchObject({ series: [70], origem: { semana: 1, treino: 2 } })
  })
  it('sem o mesmo treino antes, a semana atual vence as semanas passadas', () => {
    const regs = { '1-1': { a: [40] }, '2-1': { a: [50] } }
    expect(cargaAnterior(m, regs, 2, 2, 1)).toMatchObject({ series: [50], origem: { semana: 2, treino: 1 } })
  })
  it('não olha treinos posteriores da semana nem exercício diferente', () => {
    expect(cargaAnterior(m, { '1-2': { c: [70] } }, 1, 1, 1)).toBeNull() // treino 2 ainda não veio
    expect(cargaAnterior(m, { '1-1': { b: [30] } }, 1, 2, 2)).toBeNull() // Agachamento nunca foi feito
  })
  it('mesmo treino: origem é o próprio treino', () => {
    expect(cargaAnterior(m, { '1-1': { a: [40] } }, 2, 1, 1)).toMatchObject({ origem: { semana: 1, treino: 1 } })
  })
})

describe('cargaAnterior ajustada às reps de hoje (tabela de RM)', () => {
  // Treino 1: Supino 10 reps (semana 1) e 8 reps (semana 2).
  const m: Meso = {
    frequencia: 1, semanas: 2, inicio: '2026-01-05', pausaS: 60,
    divisao: [[slot('a', 'Supino')]],
    progressao: { principais: [[10, 10], [8, 8]], auxiliares: [[10, 10], [8, 8]] },
    metodos: [],
  }
  const regs = { '1-1': { a: [60, 60] } }
  it('sem reps informadas, nada muda (comportamento antigo)', () => {
    expect(cargaAnterior(m, regs, 2, 1, 1)).toMatchObject({ series: [60, 60], estimada: false })
  })
  it('menos reps hoje: carga sobe pela tabela e fica em múltiplo de 0,5', () => {
    expect(cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, {})).toMatchObject({ series: [63, 63], estimada: true })
  })
  it('nome com tipo conhecido: cai no degrau do aparelho (seletora 2,5 kg)', () => {
    const mx: Meso = { ...m, divisao: [[slot('a', 'Cadeira Extensora')]] }
    expect(cargaAnterior(mx, regs, 2, 1, 1, undefined, undefined, {})).toMatchObject({ series: [62.5, 62.5], estimada: true })
  })
  it('aparelho do catálogo passa por cima do padrão (incremento 0,625)', () => {
    const ap: Aparelho = { id: 'lf', nome: 'Polia', local: 'X', tipo: 'polia', unidade: 'kg', incremento: 0.625 }
    const r = cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, {}, { aparelho: ap })
    expect(r).toMatchObject({ series: [63.125, 63.125], estimada: true })
  })
  it('aparelho em nível: o anotado é nível, sem ajuste por reps', () => {
    const ap: Aparelho = { id: 'n', nome: 'Extensora', local: 'X', tipo: 'maquina', unidade: 'nivel', niveis: 12 }
    expect(cargaAnterior(m, { '1-1': { a: [6, 6] } }, 2, 1, 1, undefined, undefined, {}, { aparelho: ap })).toMatchObject({ series: [6, 6], estimada: false })
  })
  it('usa as reps realmente anotadas naquele dia, não as prescritas', () => {
    const r = cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, { '1-1': { a: [8, 8] } })
    expect(r).toMatchObject({ series: [60, 60], estimada: false }) // fez 8 e hoje são 8: igual
  })
  it('não altera os registros originais', () => {
    const copia = structuredClone(regs)
    cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, {})
    expect(regs).toEqual(copia)
  })
  it('com peso do corpo no registro, não ajusta (a % vale para o total, não para o extra)', () => {
    const r = cargaAnterior(m, { '1-1': { a: [90] } }, 2, 1, 1, { '1-1': { a: 76 } }, undefined, {})
    expect(r).toMatchObject({ series: [14], estimada: false })
  })
  it('reps de origem acima de 15: mantém a carga anotada', () => {
    const r = cargaAnterior(m, regs, 2, 1, 1, undefined, undefined, { '1-1': { a: [16, 16] } })
    expect(r).toMatchObject({ series: [60, 60], estimada: false })
  })
})

describe('cargaAnterior: digitação errada', () => {
  const m: Meso = {
    frequencia: 1, semanas: 2, inicio: '2026-01-05', pausaS: 60,
    divisao: [[slot('a', 'Supino')]],
    progressao: { principais: [[10, 10, 10, 10], [10, 10, 10, 10]], auxiliares: [[10, 10, 10, 10], [10, 10, 10, 10]] },
    metodos: [],
  }
  it('600 no lugar de 60 não vira sugestão (com reps informadas)', () => {
    const r = cargaAnterior(m, { '1-1': { a: [60, 60, 600, 60] } }, 2, 1, 1, undefined, undefined, {})
    expect(r).toMatchObject({ series: [60, 60, 60, 60], estimada: true })
  })
  it('sem reps informadas (recurso desligado), mostra como foi anotado', () => {
    expect(cargaAnterior(m, { '1-1': { a: [60, 60, 600, 60] } }, 2, 1, 1)).toMatchObject({ series: [60, 60, 600, 60] })
  })
})

describe('cargaAnterior: meso anterior (pelo nome do exercício)', () => {
  const mk = (nome: string, id = 'a', extra: Partial<Slot> = {}): Meso => ({
    frequencia: 1, semanas: 2, inicio: '2026-03-02', pausaS: 60,
    divisao: [[{ ...slot(id, nome), ...extra }]],
    progressao: { principais: [[10, 10], [10, 10]], auxiliares: [[10, 10], [10, 10]] },
    metodos: [],
  })
  const ant = (nome: string, extra: Partial<Slot> = {}) => ({ meso: { ...mk(nome, 'x', extra), inicio: '2026-01-05' }, registros: { '1-1': { x: [40, 42] }, '2-1': { x: [44, 46] } } })
  it('semana 1 do meso novo usa a última carga do anterior, mesmo com slotId diferente', () => {
    const r = cargaAnterior(mk('Supino Reto Barra'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('Supino Reto Barra') })
    expect(r).toMatchObject({ series: [44, 46], origem: { semana: 2, treino: 1, anterior: true } })
  })
  it('acento, caixa e espaços não atrapalham', () => {
    const r = cargaAnterior(mk('  Supino  RETO Barra'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('supino reto barra') })
    expect(r).toMatchObject({ series: [44, 46] })
    const acento = cargaAnterior(mk('Elevação Pélvica'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('elevacao pelvica') })
    expect(acento).toMatchObject({ series: [44, 46] })
  })
  it('nome parecido NÃO casa (outro equipamento é outro exercício)', () => {
    expect(cargaAnterior(mk('Supino Reto Halter'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('Supino Reto Barra') })).toBeNull()
    expect(cargaAnterior(mk('Supino Reto'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('Supino Reto Barra') })).toBeNull()
  })
  it('2 lados ou isometria diferentes não casam', () => {
    expect(cargaAnterior(mk('Rosca', 'a', { doisLados: true }), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: ant('Rosca') })).toBeNull()
  })
  it('o meso atual tem prioridade; o anterior só entra quando o atual não tem nada', () => {
    const r = cargaAnterior(mk('Supino Reto Barra'), { '1-1': { a: [50, 52] } }, 2, 1, 1, undefined, undefined, undefined, { anterior: ant('Supino Reto Barra') })
    expect(r).toMatchObject({ series: [50, 52] })
    expect(r?.origem.anterior).toBeUndefined()
  })
  it('meso anterior sem registros ou ausente: nada', () => {
    expect(cargaAnterior(mk('Supino Reto Barra'), {}, 1, 1, 1)).toBeNull()
    expect(cargaAnterior(mk('Supino Reto Barra'), {}, 1, 1, 1, undefined, undefined, undefined, { anterior: null })).toBeNull()
  })
})
