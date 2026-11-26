import { describe, expect, it } from 'vitest'
import { lerCorpoBinario, lerCorpoJson } from './corpo'

const pedido = (body: BodyInit) => new Request('https://example.test/', { method: 'POST', body, duplex: 'half' } as RequestInit)
describe('corpo da API limitado em bytes', () => {
  it('aceita JSON no limite e rejeita UTF-8 inválido ou JSON incompleto', async () => {
    expect(await lerCorpoJson(pedido('{"a":1}'), 7)).toEqual({ corpo: { a: 1 } })
    expect(await lerCorpoJson(pedido('{'), 7)).toEqual({ status: 400 })
    expect(await lerCorpoJson(pedido(new Uint8Array([34, 255, 34])), 7)).toEqual({ status: 400 })
  })
  it('mantém JSON vazio das versões antigas de desinscrição', async () => {
    expect(await lerCorpoJson(pedido('{}'), 4096)).toEqual({ corpo: {} })
  })
  it('conta bytes UTF-8, não caracteres nem Content-Length', async () => {
    const req = pedido('"é"')
    req.headers.set('Content-Length', '1')
    expect(await lerCorpoJson(req, 3)).toEqual({ status: 413 })
  })
  it('cancela o fluxo assim que ultrapassa o teto', async () => {
    let cancelado = false
    const body = new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(8)); c.enqueue(new Uint8Array(8)) },
      cancel() { cancelado = true },
    })
    expect(await lerCorpoJson(pedido(body), 7)).toEqual({ status: 413 })
    expect(cancelado).toBe(true)
  })
  it('binário: devolve os bytes no limite e corta acima dele sem ler o resto', async () => {
    const r = await lerCorpoBinario(pedido(new Uint8Array([1, 2, 3])), 3)
    expect(r.status).toBeUndefined()
    expect(new Uint8Array((r as { dados: ArrayBuffer }).dados)).toEqual(new Uint8Array([1, 2, 3]))
    let cancelado = false
    const body = new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(4)); c.enqueue(new Uint8Array(4)) },
      cancel() { cancelado = true },
    })
    expect(await lerCorpoBinario(pedido(body), 5)).toEqual({ status: 413 })
    expect(cancelado).toBe(true)
  })
})
