import { describe, expect, it } from 'vitest'
import { APARELHOS } from '../data/aparelhos'
import {
  arredondarNoAparelho,
  kgAnotado,
  kgDaPilha,
  kgDoNivel,
  kgSentido,
  nivelParaKg,
  problemasAparelho,
  proximoValor,
  sugestaoNoAparelho,
  volumeNoAparelho,
  type AparelhoKg,
  type AparelhoNivel,
} from './aparelho'

const polia: AparelhoKg = { id: 'p', nome: 'Polia alta', local: 'Academia A', tipo: 'polia', unidade: 'kg', incremento: 5, maximo: 100, polia: '2:1' }
const halter: AparelhoKg = { id: 'h', nome: 'Halteres', local: 'Academia A', tipo: 'halter', unidade: 'kg', incremento: 2, minimo: 1, porLado: true }
const extensora: AparelhoNivel = { id: 'e', nome: 'Extensora', local: 'Condomínio X', tipo: 'maquina', unidade: 'nivel', niveis: 10, kgNivel: [5, 10, null, 20, null, null, 35] }
const semKg: AparelhoNivel = { id: 's', nome: 'Remada', local: 'Condomínio X', tipo: 'maquina', unidade: 'nivel', niveis: 8 }

describe('arredondarNoAparelho', () => {
  it('kg: vai ao incremento mais próximo, dentro dos limites; empate sobe', () => {
    expect(arredondarNoAparelho(polia, 23)).toBe(25)
    expect(arredondarNoAparelho(polia, 22.5)).toBe(25)
    expect(arredondarNoAparelho(polia, 2)).toBe(5)
    expect(arredondarNoAparelho(polia, 130)).toBe(100)
    const foraDaGrade: AparelhoKg = { ...polia, minimo: 5, maximo: 12 }
    expect(arredondarNoAparelho(foraDaGrade, 15)).toBe(10)
    expect(proximoValor(foraDaGrade, 10, 1)).toBeNull()
    expect(arredondarNoAparelho(halter, 8)).toBe(9) // halteres 1, 3, 5, 7, 9: 8 fica no meio e sobe
    expect(arredondarNoAparelho(halter, 7.8)).toBe(7)
    expect(arredondarNoAparelho(halter, 8.2)).toBe(9)
  })
  it('nível: inteiro entre 1 e o máximo', () => {
    expect(arredondarNoAparelho(extensora, 4.4)).toBe(4)
    expect(arredondarNoAparelho(extensora, 4.5)).toBe(5)
    expect(arredondarNoAparelho(extensora, 0)).toBe(1)
    expect(arredondarNoAparelho(extensora, 15)).toBe(10)
  })
})

describe('plaquinhas complementares (Life Fitness)', () => {
  const lf: AparelhoKg = { id: 'lf', nome: 'Polia', local: 'Condomínio Y', tipo: 'polia', unidade: 'kg', incremento: 2.5, minimo: 1.25, maximo: 50, complementos: [0.625, 0.625] }
  it('cabe o meio do degrau: 11,25 → 12,5 em vez de 13,75', () => {
    expect(arredondarNoAparelho(lf, 12.4)).toBe(12.5)
    expect(arredondarNoAparelho(lf, 11.9)).toBe(11.875)
    expect(arredondarNoAparelho(lf, 13.75)).toBe(13.75)
    expect(arredondarNoAparelho(lf, 60)).toBe(50) // 48,75 + 1,25; nunca acima do máximo
  })
  it('anda uma plaquinha por vez', () => {
    expect(proximoValor(lf, 11.25, 1)).toBe(11.875)
    expect(proximoValor(lf, 12.5, 1)).toBe(13.75) // 11,25 + as 2 plaquinhas; depois o próximo degrau
    expect(proximoValor(lf, 11.25, -1)).toBe(10) // 8,75 + as 2 plaquinhas
    expect(proximoValor(lf, 1.25, -1)).toBeNull()
    expect(proximoValor(lf, 50, 1)).toBeNull()
  })
  it('plaquinha maior que o incremento alcança degraus abaixo', () => {
    const grande: AparelhoKg = { ...lf, complementos: [5.625] }
    expect(arredondarNoAparelho(grande, 11.875)).toBe(11.875) // 6,25 + 5,625
    expect(proximoValor(grande, 11.25, 1)).toBe(11.875)
    expect(arredondarNoAparelho(grande, 60)).toBe(49.375) // 43,75 + 5,625, não 48,75
  })
  it('valida as plaquinhas', () => {
    expect(problemasAparelho(lf)).toEqual([])
    expect(problemasAparelho({ ...lf, complementos: [0] })).toContain('complementos: até 4 plaquinhas maiores que 0')
  })
})

describe('proximoValor', () => {
  it('sobe e desce um passo; null no limite', () => {
    expect(proximoValor(polia, 20, 1)).toBe(25)
    expect(proximoValor(polia, 100, 1)).toBeNull()
    expect(proximoValor(extensora, 1, -1)).toBeNull()
    expect(proximoValor(extensora, 3, 1)).toBe(4)
  })
})

describe('kgSentido', () => {
  it('polia 2:1 = metade; 1:1 igual', () => {
    expect(kgSentido(polia, 40)).toBe(20)
    expect(kgSentido(halter, 10)).toBe(10)
  })
})

describe('kgDoNivel', () => {
  it('usa o anotado e interpola entre anotados', () => {
    expect(kgDoNivel(extensora, 2)).toBe(10)
    expect(kgDoNivel(extensora, 3)).toBe(15)
    expect(kgDoNivel(extensora, 5)).toBe(25)
    expect(kgDoNivel(extensora, 6)).toBe(30)
  })
  it('não inventa fora dos anotados nem nível inválido', () => {
    expect(kgDoNivel(extensora, 8)).toBeNull()
    expect(kgDoNivel(extensora, 0)).toBeNull()
    expect(kgDoNivel(extensora, 2.5)).toBeNull()
    expect(kgDoNivel(semKg, 3)).toBeNull()
  })
})

describe('nivelParaKg e sugestaoNoAparelho', () => {
  it('escolhe o nível de kg mais perto; empate fica no mais pesado', () => {
    expect(nivelParaKg(extensora, 24)).toBe(5)
    expect(nivelParaKg(extensora, 12.5)).toBe(3)
    expect(nivelParaKg(extensora, 80)).toBe(7)
    expect(nivelParaKg(semKg, 20)).toBeNull()
  })
  it('traduz a sugestão do motor', () => {
    expect(sugestaoNoAparelho(extensora, 29)).toEqual({ valor: 6, kg: 30, estimado: true })
    expect(sugestaoNoAparelho(polia, 23)).toEqual({ valor: 25, kg: 25, estimado: false })
    expect(sugestaoNoAparelho(semKg, 20)).toBeNull()
    expect(sugestaoNoAparelho(polia, 0)).toBeNull()
  })
  it('kgAnotado: nível vira kg estimado; kg fica como está', () => {
    expect(kgAnotado(extensora, 3)).toBe(15)
    expect(kgAnotado(semKg, 3)).toBeNull()
    expect(kgAnotado(polia, 30)).toBe(30)
  })
})

describe('kgDaPilha', () => {
  it('placa do topo + placas iguais ou variadas', () => {
    expect(kgDaPilha(2.5, 5, 4)).toEqual([2.5, 7.5, 12.5, 17.5])
    expect(kgDaPilha(3, [4, 4, 6])).toEqual([3, 7, 11, 17])
  })
})

describe('volumeNoAparelho', () => {
  it('nível vira kg estimado para volume e média', () => {
    expect(volumeNoAparelho(extensora, [2, 3, 4], [12, 10, 8])).toEqual({ volume: 430, cargaMedia: 15, series: 3, semKg: 0 })
  })
  it('conta à parte a série sem kg estimado', () => {
    expect(volumeNoAparelho(extensora, [2, 9, null], [10, 10, 10])).toEqual({ volume: 100, cargaMedia: 10, series: 1, semKg: 1 })
    expect(volumeNoAparelho(semKg, [3], [10])).toEqual({ volume: 0, cargaMedia: null, series: 0, semKg: 1 })
  })
})

describe('problemasAparelho', () => {
  it('aceita aparelhos válidos', () => {
    for (const a of [polia, halter, extensora, semKg]) expect(problemasAparelho(a)).toEqual([])
  })
  it('recusa dados ruins', () => {
    expect(problemasAparelho({ ...polia, incremento: 0 })).toContain('incremento deve ser maior que 0')
    expect(problemasAparelho({ ...polia, maximo: 3 })).toContain('máximo menor que a menor carga')
    expect(problemasAparelho({ ...halter, maximo: 0.5 })).toContain('máximo menor que a menor carga')
    expect(problemasAparelho({ ...halter, polia: '2:1' })).toContain('polia só em aparelho de polia')
    expect(problemasAparelho({ ...extensora, kgNivel: [10, 5] })).toContain('kgNivel deve subir a cada nível')
    expect(problemasAparelho({ ...extensora, niveis: 2 })).toContain('kgNivel maior que o número de níveis')
    expect(problemasAparelho({ ...semKg, unidade: 'lb' })).toContain('unidade deve ser kg ou nivel')
    expect(problemasAparelho({ ...semKg, id: 'com espaço' })).toContain('id vazio ou com espaço')
  })
})

describe('catálogo', () => {
  it('todo item é válido e o id não se repete', () => {
    for (const a of APARELHOS) expect(problemasAparelho(a), a.id).toEqual([])
    expect(new Set(APARELHOS.map((a) => a.id)).size).toBe(APARELHOS.length)
  })
})
