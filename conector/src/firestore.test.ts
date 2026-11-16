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
  it('traduz as condições do commit: versão exata, só existir e não existir', async () => {
    let corpo: { writes: { verify?: string; currentDocument?: unknown }[] } | undefined
    const buscar = (async (_u: string, i?: RequestInit) => { corpo = JSON.parse(String(i?.body)); return Response.json({}) }) as typeof fetch
    await new Firestore('p', 't', buscar).gravarMeso('ciclo', {}, 'v1', undefined, { operacao: 'op', uid: 'coach', condicoes: [{ caminho: 'usuarios/aluno', existe: true }, { caminho: 'registros/a', updateTime: 'v2' }, { caminho: 'registros/b' }] })
    const verificacoes = corpo!.writes.filter((w) => w.verify).map((w) => [w.verify!.split('/documents/')[1], w.currentDocument])
    expect(verificacoes).toEqual([['usuarios/aluno', { exists: true }], ['registros/a', { updateTime: 'v2' }], ['registros/b', { exists: false }]])
  })
})
