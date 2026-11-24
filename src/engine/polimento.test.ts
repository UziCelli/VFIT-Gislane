import { describe, expect, it } from 'vitest'
import { planejarPolimento, seriesPolimento } from './polimento'
import { prescreverSessao } from './sessao'
import { cargaPolimento } from './degrauPolimento'
import { cargaAnterior } from '../lib/treino'
import { docParaMeso, mesoParaDoc } from '../lib/conversores'
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
  it('não usa registro parcial, nem reescreve data com treino registrado', () => {
    expect(plano(base,{parcial:true}).linhas[0]).toMatchObject({base:[],metaKg:null,previstoKg:null})
    expect(plano(base,{protegidos:['3-1']}).meso).toBe(base)
    expect(prescreverSessao(plano(base,{semanas:[2,3]}).meso,2,1)?.exercicios[0].reps).toEqual(l)
  })
  it('mantém métodos especiais fora, sem prometer polimento nesses exercícios', () => {
    const m = {...base,metodos:[{ativo:true,semana:3,treino:1,exercicio:1,metodo:'Rest-pause' as const,escopo:'Todas as séries' as const,blocos:2}]}
    const { meso, linhas } = plano(m,{folga:4})
    expect(linhas[0]).toMatchObject({ignorados:1})
    expect(prescreverSessao(meso,3,1)?.exercicios[0]).toEqual(prescreverSessao(m,3,1)?.exercicios[0])
  })
})
