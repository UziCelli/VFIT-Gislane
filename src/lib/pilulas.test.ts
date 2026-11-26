import { describe, expect, it } from 'vitest'
import { pilulasDo } from './pilulas'

const ids = (n: string) => pilulasDo(n).map((p) => p.id)

describe('pilulasDo', () => {
  it('equipamento sempre; Halter ≠ Halteres; Polia ≠ Duas Polias', () => {
    expect(ids('Supino Reto Halteres')).toEqual(['halteres'])
    expect(ids('Pull Over Halter')).toEqual(['halter'])
    expect(ids('Rosca Direta Polia')).toEqual(['polia'])
    expect(ids('Crossover Duas Polias')).toEqual(['duas_polias'])
  })
  it('máquina com nome próprio mostra o tipo só na pílula', () => {
    expect(pilulasDo('Leg Press 45')).toEqual([{ id: 'maquina_articulada', rotulo: 'Articulada' }])
    expect(pilulasDo('Cadeira Extensora Tradicional')).toEqual([{ id: 'maquina_seletora', rotulo: 'Seletora' }])
  })
  it('lados e modo só quando fogem do padrão', () => {
    expect(ids('Búlgaro Halteres')).toEqual(['halteres', 'unilateral'])
    expect(ids('Elevação Frontal Alternado Halteres')).toEqual(['halteres', 'alternado'])
    expect(ids('Prancha Frontal Isométrica (cotovelos)')).toEqual(['peso_do_corpo', 'isometrico'])
    expect(ids('Flexão Nórdica no Espaldar')).toEqual(['peso_do_corpo', 'excentrico'])
  })
  it('nome antigo também tem pílulas; texto livre e equipamento a confirmar não inventam', () => {
    expect(ids('Supino Reto Halter')).toEqual(['halteres'])
    expect(pilulasDo('Meu exercício')).toEqual([])
    expect(ids('Remada Cavalinho')).toEqual([])
  })
})
