import { describe, expect, it } from 'vitest'
import { Firestore } from './firestore'

describe('Firestore no Worker', () => {
  it('chama fetch sem vincular o objeto Firestore como this', async () => {
    const buscar = (async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return Response.json({ name: 'projects/p/databases/(default)/documents/usuarios/coach', fields: { papel: { stringValue: 'coach' } } })
    }) as typeof fetch
    await expect(new Firestore('forca--app', 'token', buscar).doc('usuarios/coach')).resolves.toEqual({ id: 'coach', dados: { papel: 'coach' } })
  })
})
