import { describe, expect, it } from 'vitest'
import catalogo from '../data/exercicios.json'
import { contarVideos, dadosVideo, filtrarVideos, linhasVideos, linkValido } from './videos'

const cat = [
  { grupo: 'Peito', exercicios: [{ id: 'supino-reto-barra', nome: 'Supino Reto Barra' }, { id: 'crucifixo-halter', nome: 'Crucifixo Halter' }] },
  { grupo: 'Costas', exercicios: [{ id: 'remada-curvada', nome: 'Remada Curvada' }] },
]

describe('linhasVideos', () => {
  it('sem documento = A gravar; usa status, link e nota gravados; ignora exercício fora do catálogo', () => {
    const l = linhasVideos(
      [
        { id: 'supino-reto-barra', status: 'no-ar', link: 'https://youtu.be/x', nota: ' ok ', por: 'Gislane' },
        { id: 'remada-curvada', status: 'gravado' },
        { id: 'saiu-do-catalogo', status: 'gravado' },
      ],
      cat,
    )
    expect(l.map((x) => [x.id, x.status])).toEqual([
      ['supino-reto-barra', 'no-ar'],
      ['crucifixo-halter', 'gravar'],
      ['remada-curvada', 'gravado'],
    ])
    expect(l[0]).toMatchObject({ link: 'https://youtu.be/x', nota: 'ok', por: 'Gislane', grupo: 'Peito' })
  })

  it('status desconhecido conta como A gravar', () => {
    expect(linhasVideos([{ id: 'remada-curvada', status: 'editando' }], cat)[2].status).toBe('gravar')
  })

  it('o catálogo real tem ids únicos (um documento por exercício)', () => {
    const ids = linhasVideos([]).map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(catalogo.reduce((s, g) => s + g.exercicios.length, 0))
  })
})

describe('contar e filtrar', () => {
  const l = linhasVideos([{ id: 'remada-curvada', status: 'gravado' }], cat)
  it('conta por status', () => expect(contarVideos(l)).toEqual({ total: 3, gravar: 2, gravado: 1, noAr: 0 }))
  it('filtra por status e busca sem acento por nome ou grupo', () => {
    expect(filtrarVideos(l, 'gravar', '').map((x) => x.id)).toEqual(['supino-reto-barra', 'crucifixo-halter'])
    expect(filtrarVideos(l, 'gravar', 'CRUCI').map((x) => x.id)).toEqual(['crucifixo-halter'])
    expect(filtrarVideos(l, 'gravar', 'peito reto').map((x) => x.id)).toEqual(['supino-reto-barra'])
    expect(filtrarVideos(l, 'gravado', 'peito')).toEqual([])
  })
})

describe('dadosVideo', () => {
  it('A gravar apaga o documento', () => expect(dadosVideo('gravar', 'https://a', 'x', 'G')).toBeNull())
  it('Gravado sem link vale; nota e link vazios não são gravados', () =>
    expect(dadosVideo('gravado', ' ', '  ', 'Gislane')).toEqual({ dados: { status: 'gravado', por: 'Gislane' } }))
  it('No ar exige link https válido', () => {
    expect(dadosVideo('no-ar', '', '', 'G')).toHaveProperty('erro')
    expect(dadosVideo('no-ar', 'youtu.be/x', '', 'G')).toHaveProperty('erro')
    expect(dadosVideo('no-ar', ' https://youtu.be/x ', 'regravar', 'G')).toEqual({ dados: { status: 'no-ar', por: 'G', link: 'https://youtu.be/x', nota: 'regravar' } })
  })
  it('linkValido barra espaço, http e link longo', () => {
    expect(linkValido('https://youtu.be/abc')).toBe(true)
    expect(linkValido('http://youtu.be/abc')).toBe(false)
    expect(linkValido('https://you tu.be')).toBe(false)
    expect(linkValido('https://' + 'a'.repeat(300))).toBe(false)
  })
})
