import { describe, expect, it } from 'vitest'
import { ErroPrescricaoRecusada, ErroCommitDesconhecido, Firestore } from './firestore'

describe('Firestore no Worker', () => {
  it('chama fetch sem vincular o objeto Firestore como this', async () => {
    const buscar = (async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return Response.json({ name: 'projects/p/databases/(default)/documents/usuarios/coach', fields: { papel: { stringValue: 'coach' } } })
    }) as typeof fetch
    await expect(new Firestore('forca--app', 'token', buscar).doc('usuarios/coach')).resolves.toEqual({ id: 'coach', dados: { papel: 'coach' } })
  })
  it.each([400, 401, 403, 409, 412, 429])('classifica recusa explícita de commit HTTP %s', async (status) => {
    const fs = new Firestore('demo-forca', 'falso', (async () => new Response('', { status })) as typeof fetch)
    await expect(fs.gravarMeso('ciclo', {}, null)).rejects.toBeInstanceOf(ErroPrescricaoRecusada)
  })
  it('mantém resposta perdida como resultado desconhecido', async () => {
    const fs = new Firestore('demo-forca', 'falso', (async () => { throw new Error('rede') }) as typeof fetch)
    await expect(fs.gravarMeso('ciclo', {}, null)).rejects.toBeInstanceOf(ErroCommitDesconhecido)
  })
})
