import { describe, expect, it } from 'vitest'
import catalogo from '../data/exercicios.json'
import { contarVideos, dadosVideo, filtrarVideos, fonteDemo, idDoCatalogo, linhasVideos, linkValido } from './videos'

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
    // Os 2 excluídos pelo Celli (sem vídeo) ficam de fora; com vídeo registrado, voltam.
    expect(ids.length).toBe(catalogo.reduce((s, g) => s + g.exercicios.length, 0) - 2)
    expect(ids).not.toContain('remada-isometrica')
    expect(linhasVideos([{ id: 'remada-isometrica', status: 'gravado', por: 'x' } as never]).map((x) => x.id)).toContain('remada-isometrica')
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
    expect(dadosVideo('no-ar', ' https://youtu.be/dQw4w9WgXcQ ', 'regravar', 'G')).toEqual({ dados: { status: 'no-ar', por: 'G', link: 'https://youtu.be/dQw4w9WgXcQ', nota: 'regravar' } })
  })
  it('No ar fora do YouTube não abre no app: recusa; Gravado aceita qualquer https', () => {
    expect(dadosVideo('no-ar', 'https://drive.google.com/x', '', 'G')).toHaveProperty('erro')
    expect(dadosVideo('gravado', 'https://drive.google.com/x', '', 'G')).toHaveProperty('dados')
  })
  it('linkValido barra espaço, http e link longo', () => {
    expect(linkValido('https://youtu.be/abc')).toBe(true)
    expect(linkValido('http://youtu.be/abc')).toBe(false)
    expect(linkValido('https://you tu.be')).toBe(false)
    expect(linkValido('https://' + 'a'.repeat(300))).toBe(false)
  })
})

describe('demonstração no cartão', () => {
  it('idDoCatalogo acha pelo nome sem acento/caixa/espaço; fora do catálogo = undefined', () => {
    const e = catalogo[0].exercicios[0]
    expect(idDoCatalogo(`  ${e.nome.toUpperCase()} `)).toBe(e.id)
    expect(idDoCatalogo('Exercício inventado')).toBeUndefined()
    expect(idDoCatalogo('Rosca Direta Polia')).toBe(idDoCatalogo('Rosca Direta Cabo')) // nome novo do catálogo = mesmo vídeo
  })
  it('fonteDemo aceita os formatos do YouTube e monta o embed mudo, em loop, sem cookies', () => {
    const id = 'dQw4w9WgXcQ'
    for (const l of [`https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}&t=3`, `https://m.youtube.com/watch?feature=x&v=${id}`, `https://youtube.com/embed/${id}`]) {
      const f = fonteDemo(l)!
      expect(f.src.startsWith(`https://www.youtube-nocookie.com/embed/${id}?`)).toBe(true)
      expect(f.src).toContain('mute=1')
      expect(f.src).toContain(`playlist=${id}`)
      expect(f.vertical).toBe(false)
    }
    expect(fonteDemo(`https://www.youtube.com/shorts/${id}`)?.vertical).toBe(true)
  })
  it('fonteDemo recusa outro site, http, id inválido e vazio', () => {
    for (const l of ['https://vimeo.com/123', 'http://youtu.be/dQw4w9WgXcQ', 'https://youtu.be/curto', 'https://youtu.be.evil.com/dQw4w9WgXcQ', '', undefined]) expect(fonteDemo(l)).toBeNull()
  })
})
