import { beforeAll, expect, it } from 'vitest'
import { b64u } from '../../push/src/b64'
import { executar } from './execucao'

const agora = 1_800_000_000_000
const te = new TextEncoder()
let par: CryptoKeyPair
beforeAll(async () => { par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair })
async function token(sub = 'coach', projeto = 'forca--app', mfa = true) {
  const h = b64u(te.encode(JSON.stringify({ alg: 'RS256', kid: 'k' })))
  const p = b64u(te.encode(JSON.stringify({ aud: projeto, iss: `https://securetoken.google.com/${projeto}`, sub, iat: agora / 1000 - 60, exp: agora / 1000 + 3000, ...(mfa && { firebase: { sign_in_second_factor: 'totp' } }) })))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, te.encode(`${h}.${p}`))
  return `${h}.${p}.${b64u(new Uint8Array(sig))}`
}
it('preparação exige token renovado assinado do mesmo coach, projeto e segundo fator', async () => {
  for (const [t, permitido] of [[await token(), true], [await token('outro'), false], [await token('coach', 'gislane-personal-trainer'), false], [await token('coach', 'forca--app', false), false], ['invalido', false]] as const) {
    let chamado = false
    const r = await executar({ refreshToken: 'r', apiKey: 'k', projeto: 'forca--app', uid: 'coach', agora, obterChave: async () => par.publicKey, buscar: (async () => Response.json({ id_token: t })) as typeof fetch }, async () => { chamado = true; return 'ok' })
    expect(chamado).toBe(permitido)
    expect(!!r.isError).toBe(!permitido)
  }
})
