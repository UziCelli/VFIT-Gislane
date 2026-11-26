import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { EQUIPAMENTOS } from '../data/catalogo'
import { buscarExercicios } from './busca'
import { doisLados } from './lados'
import { cargaPadrao, deDoc, definirProprios, idDoProprio, ladosDoCadastro, proprioPorNome, validarProprio, type DadosProprio } from './catalogoProprio'
import { pilulasDo } from './pilulas'

const d = (extra: Partial<DadosProprio> = {}): DadosProprio => ({
  base: 'Remada Pronada Unilateral', grupo: 'Dorsais', equipamento: 'maquina_articulada', sufixo: true,
  lateralidade: 'unilateral', modo: [], carga: 'total', ...extra,
})
const salvar = (x: DadosProprio) => {
  const r = validarProprio(x, [], 'Gislane')
  if ('erro' in r) throw new Error(r.erro)
  return deDoc({ ...r.dados, id: r.id })
}
afterEach(() => definirProprios([]))

describe('validarProprio', () => {
  it('gera o nome com o equipamento no fim e um id estável', () => {
    const r = validarProprio(d({ base: '  Remada   Pronada Unilateral ' }), [], 'Gislane')
    expect(r).toMatchObject({ nome: 'Remada Pronada Unilateral Articulada', id: 'p-remada-pronada-unilateral-articulada' })
  })
  it('máquina com nome próprio não repete o equipamento', () => {
    expect(validarProprio(d({ base: 'Remada Hammer Iso', sufixo: false }), [], 'x')).toMatchObject({ nome: 'Remada Hammer Iso' })
  })
  it('Halter e Halteres são exercícios diferentes', () => {
    const um = validarProprio(d({ base: 'Remada Serrote Apoiada', equipamento: 'halter' }), [], 'x')
    const dois = validarProprio(d({ base: 'Remada Serrote Apoiada', equipamento: 'halteres' }), [], 'x')
    expect(um).toMatchObject({ nome: 'Remada Serrote Apoiada Halter' })
    expect(dois).toMatchObject({ nome: 'Remada Serrote Apoiada Halteres' })
  })
  it('recusa duplicata do catálogo pelo nome novo e pelo antigo, sem ligar para acento e caixa', () => {
    expect(validarProprio(d({ base: 'supino reto', equipamento: 'barra' }), [], 'x')).toMatchObject({ erro: expect.stringContaining('Já existe') })
    expect(validarProprio(d({ base: 'Rosca Direta', equipamento: 'polia' }), [], 'x')).toMatchObject({ erro: expect.stringContaining('Já existe') })
  })
  it('recusa duplicata do que o coach já cadastrou', () => {
    const ja = salvar(d())
    expect(validarProprio(d({ base: 'REMADA PRONADA UNILATERAL' }), [ja], 'x')).toMatchObject({ erro: expect.stringContaining('já cadastrou') })
  })
  it('recusa nome que só muda a pontuação (mesmo id)', () => {
    const ja = salvar(d({ base: 'Remada (Hammer)', lateralidade: 'bilateral' }))
    expect(validarProprio(d({ base: 'Remada Hammer', lateralidade: 'bilateral' }), [ja], 'x')).toMatchObject({ erro: expect.stringContaining('já cadastrou') })
  })
  it('recusa movimento curto/longo, grupo e equipamento fora da lista; tira isométrico', () => {
    expect(validarProprio(d({ base: 'ab' }), [], 'x')).toHaveProperty('erro')
    expect(validarProprio(d({ base: 'x'.repeat(61) }), [], 'x')).toHaveProperty('erro')
    expect(validarProprio(d({ grupo: 'Pernas' }), [], 'x')).toHaveProperty('erro')
    expect(validarProprio(d({ equipamento: 'maquina' as never }), [], 'x')).toHaveProperty('erro')
    expect(validarProprio(d({ modo: ['isometrico' as never, 'excentrico'] }), [], 'x')).toMatchObject({ dados: { modo: ['excentrico'] } })
  })
  it('carga padrão: halteres por lado, peso do corpo corporal, o resto total', () => {
    expect([cargaPadrao('halteres'), cargaPadrao('peso_do_corpo'), cargaPadrao('halter'), cargaPadrao('maquina_articulada')]).toEqual(['por_lado', 'corporal', 'total', 'total'])
  })
  it('id sempre no formato da regra do Firestore', () => {
    expect(idDoProprio('Elevação ÚNICA (teste) #2')).toMatch(/^p-[a-z0-9-]{1,78}$/)
    expect(idDoProprio('x'.repeat(200)).length).toBeLessThanOrEqual(80)
  })
})

describe('lista carregada: busca e pílulas', () => {
  it('cadastrado aparece na busca (marcado) e ganha pílulas; antes de carregar, não', () => {
    const p = salvar(d({ modo: ['excentrico'] }))
    expect(buscarExercicios('pronada unilateral articulada').filter((x) => x.nome === p.nome)).toEqual([])
    expect(pilulasDo(p.nome)).toEqual([])
    definirProprios([p])
    expect(buscarExercicios('pronada unilateral articulada').filter((x) => x.nome === p.nome)).toEqual([{ nome: p.nome, grupo: 'Dorsais', proprio: true }])
    expect(pilulasDo('remada pronada unilateral articulada').map((x) => x.id)).toEqual(['maquina_articulada', 'unilateral', 'excentrico'])
    expect(proprioPorNome(' Remada Pronada Unilateral Articulada ')).toBe(p)
  })
  it('o catálogo base vem antes do cadastrado no empate', () => {
    definirProprios([salvar(d({ base: 'Supino Reto Pegada Fechada Pausado', equipamento: 'barra', grupo: 'Peitorais', lateralidade: 'bilateral' }))])
    const r = buscarExercicios('supino reto', 50)
    expect(r[0].proprio).toBeUndefined()
    expect(r.some((x) => x.proprio)).toBe(true)
  })
})

describe('ladosDoCadastro', () => {
  it('cadastrado "Por lado" entra no slot com 2 lados (o aluno não lê o cadastro); o resto não muda', () => {
    const p = salvar(d({ base: 'Supino Inclinado Pegada Neutra', grupo: 'Peitorais', equipamento: 'halteres', lateralidade: 'bilateral', carga: 'por_lado' }))
    expect(ladosDoCadastro(p.nome)).toEqual({}) // lista ainda não carregada
    definirProprios([p, salvar(d())])
    expect(ladosDoCadastro(p.nome)).toEqual({ doisLados: true })
    expect(doisLados({ nome: p.nome, ...ladosDoCadastro(p.nome) })).toBe(true)
    expect(ladosDoCadastro('Remada Pronada Unilateral Articulada')).toEqual({}) // cadastrado com carga total
    expect(ladosDoCadastro('Supino Reto Halteres')).toEqual({}) // catálogo base: padrão do catálogo, como antes
    expect(ladosDoCadastro('Texto livre')).toEqual({})
  })
})

describe('regra do Firestore', () => {
  it('lista de equipamentos igual à do catálogo', () => {
    const regras = readFileSync('firestore.rules', 'utf8')
    const bloco = regras.slice(regras.indexOf('match /exerciciosProprios/'), regras.indexOf('match /midias/'))
    const lista = bloco.match(/equipamento in \[([^\]]+)\]/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1))
    expect(lista.sort()).toEqual(Object.keys(EQUIPAMENTOS).sort())
  })
})
