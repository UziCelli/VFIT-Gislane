import { describe, expect, it } from 'vitest'
import { APARELHOS } from '../data/aparelhos'
import {
  arredondarNoAparelho,
  kgAnotado,
  kgDoNivel,
  kgSentido,
  nivelParaKg,
  problemasAparelho,
  proximoValor,
  sugestaoNoAparelho,
  type AparelhoKg,
  type AparelhoNivel,
} from './aparelho'

const polia: AparelhoKg = { id: 'p', nome: 'Polia alta', local: 'Academia A', tipo: 'polia', unidade: 'kg', incremento: 5, maximo: 100, polia: '2:1' }
const halter: AparelhoKg = { id: 'h', nome: 'Halteres', local: 'Academia A', tipo: 'halter', unidade: 'kg', incremento: 2, minimo: 1, porLado: true }
const extensora: AparelhoNivel = { id: 'e', nome: 'Extensora', local: 'Condomínio X', tipo: 'maquina', unidade: 'nivel', niveis: 10, kgNivel: [5, 10, null, 20, null, null, 35] }
const semKg: AparelhoNivel = { id: 's', nome: 'Remada', local: 'Condomínio X', tipo: 'maquina', unidade: 'nivel', niveis: 8 }

describe('arredondarNoAparelho', () => {
  it('kg: vai ao incremento mais próximo, dentro dos limites; empate desce', () => {
    expect(arredondarNoAparelho(polia, 23)).toBe(25)
    expect(arredondarNoAparelho(polia, 22.5)).toBe(20)
    expect(arredondarNoAparelho(polia, 2)).toBe(5)
    expect(arredondarNoAparelho(polia, 130)).toBe(100)
    expect(arredondarNoAparelho(halter, 8)).toBe(7) // halteres 1, 3, 5, 7, 9: 8 fica no meio e desce
    expect(arredondarNoAparelho(halter, 8.2)).toBe(9)
  })
  it('nível: inteiro entre 1 e o máximo', () => {
    expect(arredondarNoAparelho(extensora, 4.4)).toBe(4)
    expect(arredondarNoAparelho(extensora, 4.5)).toBe(4)
    expect(arredondarNoAparelho(extensora, 0)).toBe(1)
    expect(arredondarNoAparelho(extensora, 15)).toBe(10)
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
  it('escolhe o nível de kg mais perto; empate fica no mais leve', () => {
    expect(nivelParaKg(extensora, 24)).toBe(5)
    expect(nivelParaKg(extensora, 12.5)).toBe(2)
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

describe('problemasAparelho', () => {
  it('aceita aparelhos válidos', () => {
    for (const a of [polia, halter, extensora, semKg]) expect(problemasAparelho(a)).toEqual([])
  })
  it('recusa dados ruins', () => {
    expect(problemasAparelho({ ...polia, incremento: 0 })).toContain('incremento deve ser maior que 0')
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
