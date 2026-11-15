import { describe, expect, it } from 'vitest'
import { deRest, docDeRest, idDeRest, paraRest, Ts } from './rest'

describe('deRest', () => {
  it('converte os tipos simples (inteiro vem como texto)', () => {
    expect(docDeRest({ a: { stringValue: 'x' }, b: { integerValue: '7' }, c: { doubleValue: 1.5 }, d: { booleanValue: true }, e: { nullValue: null } })).toEqual({ a: 'x', b: 7, c: 1.5, d: true, e: null })
  })
  it('mapa e lista vazios não trazem fields/values', () => {
    expect(deRest({ mapValue: {} })).toEqual({})
    expect(deRest({ arrayValue: {} })).toEqual([])
    expect(docDeRest(undefined)).toEqual({})
  })
  it('aninha mapas e listas', () => {
    expect(deRest({ mapValue: { fields: { t1: { arrayValue: { values: [{ mapValue: { fields: { slotId: { stringValue: 'a' } } } }] } } } } })).toEqual({ t1: [{ slotId: 'a' }] })
  })
  it('timestamp vira objeto com toMillis (como o do SDK)', () => {
    const t = deRest({ timestampValue: '2026-11-14T12:00:00Z' }) as Ts
    expect(t.toMillis()).toBe(Date.parse('2026-11-14T12:00:00Z'))
    expect(deRest({ timestampValue: 'lixo' })).toBeNull()
  })
  it('tipo desconhecido vira null; id é o último pedaço do nome', () => {
    expect(deRest({ geoPointValue: {} })).toBeNull()
    expect(idDeRest('projects/p/databases/(default)/documents/mesos/abc')).toBe('abc')
  })
})

describe('ida e volta', () => {
  it('paraRest -> deRest devolve o mesmo valor', () => {
    const v = { nome: 'João', n: 3, kg: 42.5, ok: false, nada: null, lista: [1, 'a', { x: 2 }], vazio: {}, vazia: [], quando: new Ts(1_800_000_000_000) }
    expect(docDeRest((paraRest(v) as { mapValue: { fields: Record<string, unknown> } }).mapValue.fields)).toEqual(v)
  })
  it('inteiro vai como integerValue em texto; fracionário como doubleValue; Date vira timestamp', () => {
    expect(paraRest(5)).toEqual({ integerValue: '5' })
    expect(paraRest(5.5)).toEqual({ doubleValue: 5.5 })
    expect(paraRest(new Date('2026-11-14T00:00:00Z'))).toEqual({ timestampValue: '2026-11-14T00:00:00.000Z' })
  })
})
