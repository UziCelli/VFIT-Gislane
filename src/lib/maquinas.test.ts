import { describe, expect, it } from 'vitest'
import { problemasAparelho, sugestaoNoAparelho, type AparelhoNivel } from '../engine/aparelho'
import { definirProprios } from './catalogoProprio'
import {
  deDoc, idDoExercicio, lerNumero, lerPlaquinhas, locais, maquinasDoExercicio, paraEntrada, porExercicio,
  resumoEscala, validarMaquina, type EntradaMaquina, type Maquina,
} from './maquinas'

const nivel: EntradaMaquina = {
  nome: ' Cadeira  Extensora ', local: 'Academia Centro', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgTopo: 5, kgPlaca: 5,
  porLado: false, exercicios: ['cadeira-extensora-tradicional'],
}
const kg: EntradaMaquina = {
  nome: 'Crossover', local: 'Academia Centro', tipo: 'duasPolias', unidade: 'kg', incremento: 5, maximo: 100, complementos: [0.625, 0.625],
  polia: '2:1', porLado: true, fabricante: 'Life Fitness', modelo: 'G7', exercicios: [],
}
const ok = (e: EntradaMaquina, lista: Maquina[] = [], idAtual?: string) => {
  const r = validarMaquina(e, lista, 'Gislane', idAtual)
  if ('erro' in r) throw new Error(r.erro)
  return r
}
const comoLida = (r: ReturnType<typeof ok>) => deDoc({ ...r.dados, id: r.id })

describe('validarMaquina', () => {
  it('nível com pilha: gera o kg de cada nível e passa na conferência do motor', () => {
    const r = ok(nivel)
    expect(r.id).toMatch(/^m-[a-z0-9]{20}$/)
    expect(r.dados.ref).toMatch(/^mq-[a-z0-9]{20}$/)
    expect(r.dados).toMatchObject({ nome: 'Cadeira Extensora', unidade: 'nivel', niveis: 12, por: 'Gislane' })
    expect((r.dados as unknown as { kgNivel: number[] }).kgNivel).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60])
    const m = comoLida(r)
    expect(problemasAparelho(m)).toEqual([])
    expect(sugestaoNoAparelho(m, 23)).toEqual({ valor: 5, kg: 25, estimado: true })
  })

  it('nível sem kg: salva só os níveis (o coach sugere o nível)', () => {
    const r = ok({ ...nivel, kgTopo: undefined, kgPlaca: undefined })
    expect('kgNivel' in r.dados).toBe(false)
    expect(validarMaquina({ ...nivel, kgTopo: undefined }, [], 'G')).toEqual({ erro: 'Diga também o kg do nível 1.' })
  })

  it('kg: degrau, plaquinhas, polia 2:1 e por lado; sem campos vazios no documento', () => {
    const r = ok({ ...kg, obs: '  ', rotuloAluno: ' ', minimo: undefined })
    expect(r.dados).toEqual({ ref: r.dados.ref,
      nome: 'Crossover', local: 'Academia Centro', tipo: 'duasPolias', unidade: 'kg', incremento: 5, maximo: 100,
      complementos: [0.625, 0.625], polia: '2:1', porLado: true, fabricante: 'Life Fitness', modelo: 'G7', exercicios: [], por: 'Gislane',
    })
    expect(Object.values(r.dados).some((v) => v === undefined)).toBe(false)
  })

  it('polia só em polia; seletora nunca grava polia', () => {
    expect('polia' in ok({ ...nivel, polia: '2:1' }).dados).toBe(false)
    expect(ok({ ...kg, polia: undefined }).dados.polia).toBe('1:1')
  })

  it('recusa nome, local, degrau, níveis e limites inválidos', () => {
    const erro = (e: Partial<EntradaMaquina>) => 'erro' in validarMaquina({ ...nivel, ...e }, [], 'G')
    expect(erro({ nome: 'x' })).toBe(true)
    expect(erro({ local: ' ' })).toBe(true)
    expect(erro({ niveis: 0 })).toBe(true)
    expect(erro({ niveis: 2.5 })).toBe(true)
    expect(erro({ niveis: 41 })).toBe(true)
    expect(erro({ kgTopo: 100, kgPlaca: 50 })).toBe(true) // passa de 500 kg
    expect(erro({ unidade: 'kg', incremento: undefined })).toBe(true)
    expect(erro({ unidade: 'kg', incremento: 5, minimo: 20, maximo: 10 })).toBe(true) // problemasAparelho
    expect(erro({ exercicios: Array.from({ length: 41 }, (_, i) => `e${i}`) })).toBe(true)
  })

  it('mesma máquina no mesmo local: recusa; em outro local ou editando a própria: aceita', () => {
    const lista = [comoLida(ok(nivel))]
    expect(validarMaquina({ ...nivel, nome: 'cadeira extensora' }, lista, 'G')).toEqual({ erro: 'Já existe: Cadeira Extensora em Academia Centro.' })
    expect(ok({ ...nivel, local: 'Condomínio X' }, lista).id).not.toBe(lista[0].id)
    const editada = ok({ ...nivel, niveis: 10 }, lista, lista[0].id)
    expect([editada.id, editada.dados.ref]).toEqual([lista[0].id, lista[0].ref]) // editar não troca id nem ref
  })

  it('id sorteado que já existe é sorteado de novo; rótulo do aluno é opcional e limitado', () => {
    const fila = ['m-ocupado', 'm-livre']
    const r = validarMaquina(nivel, [{ ...comoLida(ok(nivel)), id: 'm-ocupado', nome: 'Outra' }], 'G', undefined, { id: () => fila.shift()!, ref: () => 'mq-' + 'c'.repeat(20) })
    expect('erro' in r ? r : r.id).toBe('m-livre')
    expect(ok({ ...nivel, rotuloAluno: '  Extensora  2 ' }).dados.rotuloAluno).toBe('Extensora 2')
    expect(ok({ ...nivel, rotuloAluno: 'x'.repeat(50) }).dados.rotuloAluno).toHaveLength(40)
  })
})

describe('leitura e edição', () => {
  it('lerNumero e lerPlaquinhas aceitam vírgula; texto inválido não vira 0', () => {
    expect(lerNumero('2,5')).toBe(2.5)
    expect(lerNumero(' ')).toBeUndefined()
    expect(lerNumero('abc')).toBeUndefined()
    expect(lerPlaquinhas('0,625 0,625')).toEqual([0.625, 0.625])
    expect(lerPlaquinhas('')).toEqual([])
    expect(lerPlaquinhas('0,5 x')).toBeNull()
  })

  it('paraEntrada devolve topo e placa; pilha desigual avisa', () => {
    const m = comoLida(ok(nivel)) as Maquina & AparelhoNivel
    expect(paraEntrada(m)).toMatchObject({ niveis: 12, kgTopo: 5, kgPlaca: 5, pilhaIrregular: false })
    expect(paraEntrada({ ...m, kgNivel: [5, 10, 20] }).pilhaIrregular).toBe(true)
    expect(paraEntrada({ ...m, kgNivel: [5] })).toMatchObject({ kgTopo: 5, kgPlaca: undefined, pilhaIrregular: false })
  })

  it('deDoc tira por/em e garante a lista de exercícios', () => {
    const m = deDoc({ ...ok(nivel).dados, id: 'm-x', exercicios: undefined as unknown as string[] })
    expect(m).not.toHaveProperty('por')
    expect(m.exercicios).toEqual([])
  })

  it('resumoEscala: uma linha legível', () => {
    expect(resumoEscala(comoLida(ok(nivel)))).toBe('12 níveis · nível 1 ≈ 5 kg, +5 por nível')
    expect(resumoEscala(comoLida(ok(kg)))).toBe('5 em 5 kg · 5 a 100 kg · plaquinhas 0,625 + 0,625 kg · polia 2:1 · por lado')
    expect(resumoEscala(comoLida(ok({ ...nivel, kgTopo: undefined, kgPlaca: undefined })))).toBe('12 níveis · kg não informado')
  })
})

describe('vínculo com exercícios', () => {
  it('nome antigo, novo e cadastrado pelo coach acham o mesmo id; texto livre não vincula', () => {
    definirProprios([{ id: 'p-remada-teste-articulada', nome: 'Remada Teste Articulada', base: 'Remada Teste', grupo: 'Dorsais', equipamento: 'maquina_articulada', sufixo: true, lateralidade: 'bilateral', modo: [], carga: 'total' }])
    expect(idDoExercicio('Rosca Direta Cabo')).toBe(idDoExercicio('Rosca Direta Polia'))
    expect(idDoExercicio('remada teste articulada')).toBe('p-remada-teste-articulada')
    expect(idDoExercicio('Exercício inventado')).toBeNull()
    const id = idDoExercicio('Rosca Direta Polia')!
    const lista = [comoLida(ok({ ...kg, exercicios: [id, 'p-remada-teste-articulada'] })), comoLida(ok({ ...nivel, exercicios: [id] }))]
    expect(maquinasDoExercicio(lista, 'Rosca Direta Cabo').map((m) => m.nome)).toEqual(['Crossover', 'Cadeira Extensora'])
    expect(porExercicio(lista).get('p-remada-teste-articulada')?.length).toBe(1)
    expect(maquinasDoExercicio(lista, 'Exercício inventado')).toEqual([])
    definirProprios([])
  })

  it('locais: o mais usado primeiro', () => {
    const a = comoLida(ok(nivel))
    expect(locais([a, { ...a, local: 'Condomínio X' }, { ...a, id: 'y' }])).toEqual(['Academia Centro', 'Condomínio X'])
  })
})
