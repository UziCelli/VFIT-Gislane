import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificarAppCheck } from './conector-appcheck-check.mjs'

const config = { projeto: 'projeto', appId: 'app', apiKey: 'chave', debugToken: 'segredo' }

test('valida a troca com os mesmos parâmetros do Worker', async () => {
  let chamada
  const ok = await verificarAppCheck(config, async (url, opcoes) => {
    chamada = { url, opcoes }
    return { ok: true, json: async () => ({ token: 'token', ttl: '3600s' }) }
  })
  assert.equal(ok, true)
  assert.match(chamada.url, /projects\/projeto\/apps\/app:exchangeDebugToken\?key=chave$/)
  assert.equal(chamada.opcoes.headers.Referer, 'https://app.vfitcoachapp.com/')
  assert.deepEqual(JSON.parse(chamada.opcoes.body), { debugToken: 'segredo' })
  assert.ok(chamada.opcoes.signal)
})

test('recusa credencial ausente, erro de rede ou resposta inválida', async () => {
  assert.equal(await verificarAppCheck({ ...config, debugToken: ' ' }), false)
  assert.equal(await verificarAppCheck(config, async () => { throw Error('segredo') }), false)
  assert.equal(await verificarAppCheck(config, async () => ({ ok: false })), false)
  assert.equal(await verificarAppCheck(config, async () => ({ ok: true, json: async () => ({ token: '', ttl: '3600s' }) })), false)
  for (const ttl of ['0s', 'Infinitys', '3600garbage', '1e999s', '9'.repeat(400) + 's']) {
    assert.equal(await verificarAppCheck(config, async () => ({ ok: true, json: async () => ({ token: 'token', ttl }) })), false)
  }
})
