import { describe, expect, it } from 'vitest'
import { planejarPolimento, seriesPolimento } from './polimento'
import { metodosDaSessao, prescreverSessao } from './sessao'
import { cargaPolimento } from './degrauPolimento'
import { cargaAnterior } from '../lib/treino'
import { docsParaLados, docsParaRegistros, docsParaRegistrosReps, docParaMeso, mesoParaDoc, type RegistroDoc } from '../lib/conversores'
import { lerPrescricaoRegistrada } from '../lib/prescricaoRegistrada'
import type { Meso } from './tipos'

const l = [10, 10, 10, 10]
const base: Meso = {
  semanas: 5, inicio: '2026-10-01', frequencia: 1, dias: [4], pausaS: 90, metodos: [],
  divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }, { slotId: 'flex', nome: 'Flexão de Braços' }]],
  progressao: { principais: [l,l,l,l,l], auxiliares: [l,l,l,l,l] },
}
function plano(meso = base, { degraus = 0, folga = 0, semanas = [3], parcial = false, protegidos = [] as string[] }: { degraus?: 0|1|2; folga?: number; semanas?: number[]; parcial?: boolean; protegidos?: string[] } = {}) {
  return planejarPolimento(meso, {
    pct: 40, semanas, alvo: { tipo: 'todos' }, tipo: 'degrau', degraus, folga, hoje: '2026-10-15',
    historico: {
      meso, completos: new Set(['1-1','2-1']), protegidos: new Set(['1-1','2-1',...protegidos]),
      cargas: { '1-1': { sup: [50,50,50,50] }, '2-1': { sup: [50,50,50,50] } },
      reps: parcial ? {} : { '1-1': { sup: l }, '2-1': { sup: l } }, semKgNoPlano: e => e.slot.slotId === 'flex',
    },
  })
}

describe('polimento com meta de volume e tempo', () => {
  it('4 × 10 × 50 kg → 3 × 8 × 50 kg, 1.200 kg e menos tempo; volume parcial tem escopo explícito', () => {
    const { meso, linhas } = plano()
    expect(seriesPolimento(l,[50,50,50,50],1200)).toEqual([8,8,8])
    expect(prescreverSessao(meso,3,1)?.exercicios.map(e => e.reps)).toEqual([[8,8,8],[8,8,8]])
    expect(linhas[0]).toMatchObject({ base: [2,1], medidos: 1, metaKg: 1200, previstoKg: 1200, plano: 8, aplicado: 6 })
    expect(linhas[0].tempoDepois).toBeLessThan(linhas[0].tempoAntes)
    expect(meso.progressao).toBe(base.progressao)
    expect(prescreverSessao(meso,4,1)?.exercicios[0].reps).toEqual(l)
    expect(plano(meso).meso).toEqual(meso)
  })
  it('não compensa o degrau menor e preserva instrução explícita e origem normal após o polimento', () => {
    const { meso, linhas } = plano(base,{degraus:1,folga:3})
    const copia = docParaMeso(mesoParaDoc(meso))
    const sessao = prescreverSessao(copia,3,1)!
    expect(linhas[0]).toMatchObject({metaKg:1200,previstoKg:1140})
    expect(sessao.exercicios[0]).toMatchObject({reps:[8,8,8],folgaPolimento:3,polimento:1})
    expect(sessao.exercicios[1]).toMatchObject({folgaPolimento:3,polimento:0})
    expect(lerPrescricaoRegistrada(JSON.stringify({versao:1,sessao,metodos:[]}))?.sessao.exercicios[0].polimento).toBe(1)
    const regs = {'2-1':{sup:[50,50,50,50]},'3-1':{sup:[40,40,40]}}
    expect(cargaAnterior(copia,regs,3,1,1,undefined,undefined,{})?.series.slice(0,3)).toEqual([47.5,47.5,47.5])
    expect(cargaAnterior(copia,regs,4,1,1)).toMatchObject({origem:{semana:2,treino:1},series:[50,50,50,50]})
    expect(cargaPolimento(28,'Supino Reto Halter',1,true)).toBe(26)
    expect(cargaPolimento(10,'Supino Reto Halter',1,true)).toBe(9)
  })
  it.each([
    { esq: 0, total: 10, sugerido: [0, 9], previsto: 216 },
    { esq: 10, total: 10, sugerido: [9, 0], previsto: 216 },
    { esq: 10, total: 18, sugerido: [9, 7], previsto: 384 },
    { esq: null, total: 10, sugerido: null, previsto: 240 },
    { esq: 12, total: 10, sugerido: null, previsto: 240 },
  ])('usa a mesma interpretação do registro por lado: $esq / total $total', ({ esq, total, sugerido, previsto }) => {
    const m: Meso = { ...base, divisao: [[{ slotId: 'sup', nome: 'Supino Reto Halter', doisLados: true }]] }
    const colunas = (v: number | null) => ({ s1: v, s2: v, s3: v, s4: v })
    const registros: RegistroDoc[] = [{
      semana: 2, treino: 1, realizado: true,
      cargas: { sup: colunas(total) }, reps: { sup: colunas(10) },
      ...(esq !== null && { lados: { sup: colunas(esq) } }),
    }]
    const cargas = docsParaRegistros(registros), lados = docsParaLados(registros), reps = docsParaRegistrosReps(registros)
    const { meso, linhas } = planejarPolimento(m, {
      pct: 40, semanas: [3], alvo: { tipo: 'todos' }, tipo: 'degrau', degraus: 1, hoje: '2026-10-15',
      historico: { meso: m, completos: new Set(['2-1']), protegidos: new Set(['2-1']), cargas, lados, reps },
    })
    expect(prescreverSessao(meso, 3, 1)?.exercicios[0].reps).toEqual([8, 8, 8])
    expect(linhas[0]).toMatchObject({ metaKg: total * 24, previstoKg: previsto })
    const carga = cargaAnterior(meso, cargas, 3, 1, 1, undefined, lados, reps)
    if (!sugerido) {
      // A prévia mantém o total como estimativa conservadora, mas não inventa qual lado deve carregar o quê.
      expect([carga?.series[0] ?? null, carga?.dir?.series[0] ?? null]).toEqual([null, null])
    } else {
      expect([carga?.series[0], carga?.dir?.series[0]]).toEqual(sugerido)
      expect((sugerido[0] + sugerido[1]) * 24).toBe(previsto)
    }
  })
  it('não usa registro parcial, nem reescreve data com treino registrado', () => {
    expect(plano(base,{parcial:true}).linhas[0]).toMatchObject({base:[],metaKg:null,previstoKg:null})
    expect(plano(base,{protegidos:['3-1']}).meso).toBe(base)
    expect(prescreverSessao(plano(base,{semanas:[2,3]}).meso,2,1)?.exercicios[0].reps).toEqual(l)
  })
  it('retira intensificadores só na sessão e exercício selecionados, calculando séries retas e congelando a lista efetiva', () => {
    const metodo = { ativo: true, semana: 3, treino: 1, exercicio: 1, escopo: 'Todas as séries' as const }
    const drop = { ...metodo, metodo: 'Dropset' as const, etapas: 2, repsPadrao: 15, pausaInternaS: 30 }
    const rest = { ...metodo, metodo: 'Rest-pause' as const, blocos: 2, repsPadrao: 15, pausaInternaS: 30 }
    const vizinho = { ...drop, exercicio: 2 }
    const semanaNormal = { ...rest, semana: 4 }
    const m = { ...base, metodos: [drop, rest, vizinho, semanaNormal] }
    const resultado = (folga: number, degraus: 0 | 1, protegidos: string[] = []) => planejarPolimento(m, {
      pct: 40, semanas: [3], alvo: { tipo: 'exercicio', slotId: 'sup' }, tipo: 'degrau', folga, degraus, hoje: '2026-10-15',
      historico: { meso: m, completos: new Set(['2-1']), protegidos: new Set(protegidos), cargas: { '2-1': { sup: [50,50,50,50] } }, reps: { '2-1': { sup: l } } },
    })
    const { meso, linhas } = resultado(3, 0)
    const salvo = docParaMeso(mesoParaDoc(meso))
    const sessao = prescreverSessao(salvo, 3, 1)!
    expect(meso.metodos).toBe(m.metodos)
    expect(linhas[0]).toMatchObject({ metaKg: 1200, previstoKg: 1200, semIntensificadores: 1, ignorados: 0 })
    expect(linhas[0].tempoDepois).toBeLessThan(linhas[0].tempoAntes)
    expect(sessao.exercicios[0]).toMatchObject({ reps: [8,8,8], drops: [], rotulo: '', folgaPolimento: 3 })
    expect(sessao.exercicios[1]).toEqual(prescreverSessao(m, 3, 1)?.exercicios[1])
    expect(prescreverSessao(salvo, 4, 1)).toEqual(prescreverSessao(m, 4, 1))
    const metodos = metodosDaSessao(salvo, 3, 1)
    expect(metodos).toEqual([vizinho])
    expect(lerPrescricaoRegistrada(JSON.stringify({ versao: 1, sessao, metodos }))?.metodos).toEqual([vizinho])
    expect(resultado(0, 0).meso).toBe(m)
    expect(resultado(3, 0, ['3-1']).meso).toBe(m)
    expect(resultado(0, 1).linhas[0].semIntensificadores).toBe(1)
    const semEsforco = planejarPolimento(salvo, {
      pct: 40, semanas: [3], alvo: { tipo: 'exercicio', slotId: 'sup' }, tipo: 'degrau', degraus: 0, hoje: '2026-10-15',
      historico: { meso: salvo, completos: new Set(), protegidos: new Set(), cargas: {}, reps: {} },
    }).meso
    expect(metodosDaSessao(semEsforco, 3, 1)).toEqual([drop, rest, vizinho])
    const congelado = { versao: 1 as const, sessao: prescreverSessao(m, 3, 1)!, metodos: [drop, rest, vizinho] }
    expect(metodosDaSessao({ ...salvo, prescricoesRegistradas: { '3-1': congelado } }, 3, 1)).toEqual(congelado.metodos)
    expect(prescreverSessao({ ...salvo, prescricoesRegistradas: { '3-1': congelado } }, 3, 1)).toEqual(congelado.sessao)
    const editada = { semana: 3, treino: 1, exercicios: m.divisao[0], metodos: [drop] }
    expect(metodosDaSessao({ ...salvo, sessoes: { '3-1': editada } }, 3, 1)).toEqual([drop])
  })
  it('mantém outro método e explicita que o exercício fica fora do modo de esforço', () => {
    const m = {...base,metodos:[{ativo:true,semana:3,treino:1,exercicio:1,metodo:'Clusterset' as const,escopo:'Todas as séries' as const,blocos:2}]}
    const { meso, linhas } = plano(m,{folga:4})
    expect(linhas[0]).toMatchObject({ignorados:1, semIntensificadores:0})
    expect(prescreverSessao(meso,3,1)?.exercicios[0]).toEqual(prescreverSessao(m,3,1)?.exercicios[0])
  })
})
