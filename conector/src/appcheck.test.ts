import { beforeEach, describe, expect, it } from 'vitest'
import { limparCacheAppCheck, tokenAppCheck } from './appcheck'
import { executar } from './execucao'
import { ErroConector, Firestore } from './firestore'

const DEBUG = 'debug-secreto-123'
const base = { projeto: 'forca--app', appId: '1:2:web:abc', apiKey: 'chave', debugToken: DEBUG }
beforeEach(limparCacheAppCheck)

function falso(ttl = '3600s') {
  const chamadas: { url: string; init?: RequestInit }[] = []
  const buscar = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url: String(url), init })
    return Response.json({ token: `ac-${chamadas.length}`, ttl })
  }) as typeof fetch
  return { chamadas, buscar }
}

describe('tokenAppCheck', () => {
  it('troca o debug token com o Referer do app', async () => {
    const f = falso()
    expect(await tokenAppCheck({ ...base, buscar: f.buscar, agora: 0 })).toBe('ac-1')
    expect(f.chamadas[0].url).toBe('https://firebaseappcheck.googleapis.com/v1/projects/forca--app/apps/1:2:web:abc:exchangeDebugToken?key=chave')
    const h = new Headers(f.chamadas[0].init?.headers)
    expect(h.get('referer')).toBe('https://app.vfitcoachapp.com/')
    expect(h.get('content-type')).toBe('application/json')
    expect(JSON.parse(String(f.chamadas[0].init?.body))).toEqual({ debugToken: DEBUG })
  })
  it('reutiliza até ttl - 5 min e renova depois', async () => {
    const f = falso()
    await tokenAppCheck({ ...base, buscar: f.buscar, agora: 0 })
    expect(await tokenAppCheck({ ...base, buscar: f.buscar, agora: 3_300_000 - 1 })).toBe('ac-1')
    expect(f.chamadas.length).toBe(1)
    expect(await tokenAppCheck({ ...base, buscar: f.buscar, agora: 3_300_000 })).toBe('ac-2')
  })
  it('sem debug token não chama nada', async () => {
    const f = falso()
    expect(await tokenAppCheck({ ...base, debugToken: undefined, buscar: f.buscar })).toBeUndefined()
    expect(f.chamadas.length).toBe(0)
  })
  it('falha de rede ou HTTP não vaza token nem corpo', async () => {
    const rede = (async () => { throw new Error(`falhou ${DEBUG}`) }) as typeof fetch
    const http = (async () => Response.json({ error: { message: `segredo ${DEBUG}` } }, { status: 403 })) as typeof fetch
    for (const buscar of [rede, http]) {
      const e = await tokenAppCheck({ ...base, buscar }).catch((x) => x)
      expect(e).toBeInstanceOf(ErroConector)
      expect(e.message).toBe('Não consegui validar o app no Firebase. Tente de novo.')
      expect(e.message).not.toContain(DEBUG)
    }
  })
  it.each(['Infinitys', '3600garbage', '1e999s', '9'.repeat(400) + 's', '0s'])('recusa duração inválida: %s', async (ttl) => {
    await expect(tokenAppCheck({ ...base, buscar: falso(ttl).buscar })).rejects.toThrow('validar o app')
  })
  it('resposta sem token vira erro seguro', async () => {
    await expect(tokenAppCheck({ ...base, buscar: (async () => Response.json({})) as typeof fetch })).rejects.toThrow('validar o app')
  })
})

describe('Firestore com App Check', () => {
  const espiar = () => {
    let h: Headers | undefined
    const buscar = (async (_u: string, i?: RequestInit) => ((h = new Headers(i?.headers)), Response.json({ name: 'a/b/usuarios/x', fields: {} }))) as typeof fetch
    return { buscar, h: () => h }
  }
  it('manda X-Firebase-AppCheck só quando há token', async () => {
    const com = espiar()
    await new Firestore('p', 't', com.buscar, 'ac').doc('usuarios/x')
    expect(com.h()?.get('x-firebase-appcheck')).toBe('ac')
    const sem = espiar()
    await new Firestore('p', 't', sem.buscar).doc('usuarios/x')
    expect(sem.h()?.has('x-firebase-appcheck')).toBe(false)
  })
  it('executar usa o token de App Check no Firestore', async () => {
    const vistos: Record<string, string | null> = {}
    const buscar = (async (u: string, i?: RequestInit) => {
      const url = String(u)
      if (url.includes('securetoken')) return Response.json({ id_token: 'id' })
      if (url.includes('firebaseappcheck')) return Response.json({ token: 'ac-x', ttl: '3600s' })
      vistos.ac = new Headers(i?.headers).get('x-firebase-appcheck')
      return Response.json({ name: 'a/b/usuarios/x', fields: {} })
    }) as typeof fetch
    const r = await executar({ refreshToken: 'r', apiKey: 'k', projeto: 'forca--app', appId: base.appId, debugToken: DEBUG, buscar }, (fs) => fs.doc('usuarios/x'))
    expect(r.isError).toBeUndefined()
    expect(vistos.ac).toBe('ac-x')
  })
})
