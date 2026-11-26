import { describe, expect, it } from 'vitest'
import { norm } from '../lib/busca'
import atributos from './atributos.json'
import idsDoisLados from './doisLados.json'
import catalogo from './exercicios.json'
import idsIsometricos from './isometricos.json'
import { isometrico } from '../engine/isometria'
import { chaveExercicio, EQUIPAMENTOS, EXERCICIOS, exercicioPorId, nomeAtualizado, nomeGerado, nomesConhecidos, resolverExercicio } from './catalogo'

const idsCatalogo = catalogo.flatMap((g) => g.exercicios.map((e) => e.id))

describe('atributos do catálogo', () => {
  it('cada exercício do catálogo tem atributos, e nada sobra', () => {
    expect(Object.keys(atributos).sort()).toEqual([...idsCatalogo].sort())
  })

  it('campos dentro das listas controladas', () => {
    for (const e of EXERCICIOS) {
      if (e.equipamento !== null) expect(Object.keys(EQUIPAMENTOS), e.id).toContain(e.equipamento)
      expect(['bilateral', 'unilateral', 'alternado'], e.id).toContain(e.lateralidade)
      expect(['reps', 'tempo'], e.id).toContain(e.unidade)
      expect(['total', 'por_lado', 'corporal'], e.id).toContain(e.carga)
      expect(e.modo.length, e.id).toBeGreaterThan(0)
      for (const m of e.modo) expect(['dinamico', 'isometrico', 'excentrico'], e.id).toContain(m)
      expect(e.base.trim(), e.id).toBe(e.base)
      // Sem equipamento definido, o item precisa dizer o que falta confirmar.
      if (e.equipamento === null) expect(e.aConfirmar, e.id).toBeTruthy()
    }
  })

  it('mecanismo coerente com o equipamento', () => {
    for (const e of EXERCICIOS) {
      if (e.equipamento === 'maquina_articulada') expect(e.mecanismo, e.id).toBe('anilhas')
      if (e.equipamento === 'halter' || e.equipamento === 'halteres') expect(e.mecanismo, e.id).toBe('livre')
      if (e.equipamento === 'peso_do_corpo') expect(e.carga, e.id).toBe('corporal')
    }
  })

  it('carga por lado continua igual à lista atual (doisLados.json)', () => {
    const porLado = EXERCICIOS.filter((e) => e.carga === 'por_lado').map((e) => e.id)
    expect(porLado.sort()).toEqual([...idsDoisLados].sort())
  })

  it('isometria continua igual à lista atual (isometricos.json), sempre em tempo', () => {
    const iso = EXERCICIOS.filter((e) => e.modo.includes('isometrico'))
    expect(iso.map((e) => e.id).sort()).toEqual([...idsIsometricos].sort())
    for (const e of iso) expect(e.unidade, e.id).toBe('tempo')
    for (const e of EXERCICIOS.filter((x) => !x.modo.includes('isometrico'))) expect(e.unidade, e.id).toBe('reps')
  })
})

describe('nome gerado', () => {
  it('base + rótulo do equipamento; máquina com nome próprio fica sem sufixo', () => {
    expect(nomeGerado({ base: 'Supino Reto', sufixo: true, equipamento: 'halteres' })).toBe('Supino Reto Halteres')
    expect(nomeGerado({ base: 'Leg Press 45', sufixo: false, equipamento: 'maquina_articulada' })).toBe('Leg Press 45')
    expect(nomeGerado({ base: 'Remada Cavalinho', sufixo: true, equipamento: null })).toBe('Remada Cavalinho')
  })

  it('Halter ≠ Halteres e Polia ≠ Duas Polias no nome', () => {
    expect(exercicioPorId('supino-reto-halter')?.nome).toBe('Supino Reto Halteres')
    expect(exercicioPorId('pull-over-halter')?.nome).toBe('Pull Over Halter')
    expect(exercicioPorId('crossover-no-cabo')?.nome).toBe('Crossover Duas Polias')
    expect(exercicioPorId('rosca-direta-cabo')?.nome).toBe('Rosca Direta Polia')
  })

  it('nome antigo vira apelido quando o nome muda', () => {
    for (const e of EXERCICIOS) {
      if (e.nome !== e.nomeCatalogo) expect(e.apelidos, e.id).toContain(e.nomeCatalogo)
    }
  })
})

describe('resolverExercicio (compatibilidade)', () => {
  it('todo nome atual do catálogo resolve para o mesmo id', () => {
    for (const g of catalogo) for (const x of g.exercicios) expect(resolverExercicio(x.nome)?.id, x.nome).toBe(x.id)
  })

  it('nome gerado e apelidos resolvem para o mesmo id', () => {
    for (const e of EXERCICIOS) for (const n of nomesConhecidos(e)) expect(resolverExercicio(n)?.id, n).toBe(e.id)
    expect(resolverExercicio('T-Bar Row')?.id).toBe('remada-cavalinho')
    expect(resolverExercicio('Recuo Barra')?.id).toBe('retrocesso-barra')
  })

  it('nenhum nome conhecido aponta para dois exercícios', () => {
    const dono = new Map<string, string>()
    for (const e of EXERCICIOS) {
      for (const n of nomesConhecidos(e)) {
        const k = norm(n.trim()).replace(/\s+/g, ' ')
        expect(dono.get(k) ?? e.id, `${n} em ${e.id} e ${dono.get(k)}`).toBe(e.id)
        dono.set(k, e.id)
      }
    }
  })

  it('ignora acento, caixa e espaços; texto livre não resolve', () => {
    expect(resolverExercicio('  supino   reto halteres ')?.id).toBe('supino-reto-halter')
    expect(resolverExercicio('Exercício que não existe')).toBeNull()
    expect(resolverExercicio('Supino')).toBeNull()
  })
})

describe('identidade para o histórico', () => {
  it('nome antigo e novo dão a mesma chave; texto livre fica como texto normalizado', () => {
    expect(chaveExercicio('Supino Reto Halter')).toBe(chaveExercicio('Supino Reto Halteres'))
    expect(chaveExercicio('Supino Reto Halter')).not.toBe(chaveExercicio('Supino Reto Barra'))
    expect(chaveExercicio('  Meu  Exercício ')).toBe('meu exercicio')
  })
  it('nomeAtualizado junta o histórico antigo sob o nome novo', () => {
    expect(nomeAtualizado('Rosca Direta Cabo')).toBe('Rosca Direta Polia')
    expect(nomeAtualizado(' Texto livre ')).toBe('Texto livre')
  })
  it('isometria do motor reconhece todos os nomes conhecidos dos isométricos, e só eles', () => {
    for (const e of EXERCICIOS) {
      for (const n of nomesConhecidos(e)) expect(isometrico({ nome: n }), n).toBe(e.modo.includes('isometrico'))
    }
  })
})
