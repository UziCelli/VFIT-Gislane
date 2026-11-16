// Runtime real do Cloudflare + Firebase emulado. Nenhuma chamada chega à produção.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { chromium, expect } from '@playwright/test'

const ORIGEM = 'http://localhost'
const APP = 'https://app.vfitcoachapp.com'

test('OAuth PKCE → MCP HTTP → RPC/SQLite → prévia → confirmação com regras reais', { timeout: 120_000 }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/)
  const pasta = await mkdtemp(join(tmpdir(), 'vfit-runtime-'))
  const app = initializeApp({ projectId: 'demo-forca' }, 'runtime-mcp')
  const db = getFirestore(app)
  let mf, cliente, navegador, vite
  try {
    const regras = await readFile(resolve('../firestore.rules'), 'utf8')
    const regrasR = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-forca:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: regras }] } }) })
    assert.equal(regrasR.ok, true)
    await db.doc('usuarios/runtimeCoach').set({ papel: 'coach', status: 'ativo' })
    await getAuth(app).createUser({ uid: 'runtimeCoach', email: 'runtime-mcp@example.com', password: 'senha123456' })
    await getAuth(app).setCustomUserClaims('runtimeCoach', { mfaDispensado: true })
    await db.doc('usuarios/runtimeAluno').set({ papel: 'aluno', nome: 'Aluno fictício' })
    const linhas = { w1: [10, 10], w2: [12, 12] }
    await db.doc('mesos/runtimeCiclo').set({ alunoId: 'runtimeAluno', nome: 'Teste isolado', inicio: '2026-11-01', frequencia: 5, semanas: 2, pausaS: 90, divisao: { t1: [{ slotId: 'face1', nome: 'Facepull' }, { slotId: 'sup', nome: 'Supino Reto Barra' }], t2: [], t3: [], t4: [], t5: [{ slotId: 'face5', nome: 'Facepull' }] }, progressao: { principais: linhas, auxiliares: linhas }, metodos: [] })
    await db.doc('registros/runtimeCiclo_s01_t1').set({ alunoId: 'runtimeAluno', mesoId: 'runtimeCiclo', semana: 1, treino: 1, cargas: { face1: { s1: 0 } }, reps: { face1: { s1: 10 } } })
    execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', pasta], { stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
    const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const jwk = await crypto.subtle.exportKey('jwk', par.publicKey)
    const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
    const claims = (uid, projeto) => ({ aud: projeto, iss: `https://securetoken.google.com/${projeto}`, sub: uid, user_id: uid, iat: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp' } })
    const payload = `${b64({ alg: 'RS256', kid: 'fixture' })}.${b64(claims('runtimeCoach', 'forca--app'))}`
    const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, Buffer.from(payload))
    const idToken = `${payload}.${Buffer.from(assinatura).toString('base64url')}`
    let perderResposta = false
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, modulesRoot: pasta, rootPath: pasta, scriptPath: join(pasta, 'index.js'), compatibilityDate: '2026-06-01', compatibilityFlags: ['nodejs_compat'], kvNamespaces: ['OAUTH_KV'], durableObjects: { PEDIDOS: { className: 'PedidoOAuth', useSQLite: true }, PROPOSTAS: { className: 'PropostaTreino', useSQLite: true } }, bindings: { APP_URL: APP, MCP_RESOURCE: `${ORIGEM}/mcp`, PROJETO: 'forca--app', FIREBASE_API_KEY: 'fixture', FIREBASE_APP_ID: 'fixture', APPCHECK_DEBUG_TOKEN: 'fixture', EDICAO_COMPLETA: '1', BUILD_ID: 'runtime-test' },
      outboundService: async (request) => {
        const u = new URL(request.url)
        if (u.hostname === 'securetoken.googleapis.com') return Response.json({ id_token: idToken })
        if (u.hostname === 'www.googleapis.com') return Response.json({ keys: [{ ...jwk, kid: 'fixture' }] })
        if (u.hostname === 'firebaseappcheck.googleapis.com') return Response.json({ token: 'appcheck-fixture', ttl: '3600s' })
        assert.equal(u.hostname, 'firestore.googleapis.com', 'Saída desconhecida deve falhar fechada')
        const headers = new Headers(request.headers)
        // O corpo é reconstruído pelo proxy; não encaminhar framing/compressão do outro salto.
        for (const nome of ['Host', 'Content-Length', 'Transfer-Encoding', 'Connection', 'Accept-Encoding']) headers.delete(nome)
        headers.set('Authorization', `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims('runtimeCoach', 'demo-forca'))}.`)
        headers.delete('X-Firebase-AppCheck')
        const resposta = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}${u.pathname.replace('/projects/forca--app/', '/projects/demo-forca/')}${u.search}`, { method: request.method, headers, ...(request.method !== 'GET' && { body: (await request.text()).replaceAll('projects/forca--app/', 'projects/demo-forca/') }) })
        const body = await resposta.text()
        if (!resposta.ok && resposta.status !== 404) {
          let codigo = 'desconhecido'
          try { codigo = JSON.parse(body).error?.status ?? codigo } catch { /* Resposta sem JSON. */ }
          console.error(JSON.stringify({ fixture: 'firestore-emulado', metodo: request.method, caminho: u.pathname, status: resposta.status, codigo }))
        }
        if (u.pathname.endsWith(':commit') && perderResposta && resposta.ok) { perderResposta = false; return new Response('falha simulada após commit', { status: 503 }) }
        const respostaHeaders = new Headers(resposta.headers)
        for (const nome of ['Content-Length', 'Content-Encoding', 'Transfer-Encoding', 'Connection']) respostaHeaders.delete(nome)
        return new Response(body.replaceAll('projects/demo-forca/', 'projects/forca--app/'), { status: resposta.status, headers: respostaHeaders })
      },
    }))
    const worker = await mf.getWorker()
    const enviar = async (input, init = {}) => { const req = new Request(input, init); const headers = new Headers(req.headers); headers.set('Host', new URL(ORIGEM).host); return worker.fetch(req.url, { method: req.method, headers, redirect: req.redirect, ...(req.method !== 'GET' && req.method !== 'HEAD' && { body: await req.arrayBuffer() }) }) }
    const chamar = (path, init) => enviar(ORIGEM + path, init)
    assert.equal((await chamar('/mcp', { method: 'POST', body: '{}' })).status, 401)
    const cadastro = await chamar('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Teste MCP', redirect_uris: ['https://fixture.test/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) })
    assert.equal(cadastro.status, 201)
    const { client_id } = await cadastro.json()
    const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', Buffer.from(verifier))).toString('base64url')
    const parametros = new URLSearchParams({ client_id, redirect_uri: 'https://fixture.test/callback', response_type: 'code', state: 'fixture', code_challenge: challenge, code_challenge_method: 'S256', resource: `${ORIGEM}/mcp` })
    const autorizar = await chamar(`/authorize?${parametros}`, { redirect: 'manual' })
    assert.equal(autorizar.status, 302)
    const pedido = new URLSearchParams(new URL(autorizar.headers.get('Location')).hash.split('?')[1]).get('pedido')
    const aprovado = await chamar('/concluir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido, idToken, refreshToken: 'fixture', versaoConsentimento: 2 }) })
    assert.equal(aprovado.status, 200, await aprovado.clone().text())
    const code = new URL((await aprovado.json()).redirectTo).searchParams.get('code')
    const tokenR = await chamar('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id, code, code_verifier: verifier, redirect_uri: 'https://fixture.test/callback', grant_type: 'authorization_code', resource: `${ORIGEM}/mcp` }).toString() })
    assert.equal(tokenR.status, 200, await tokenR.clone().text())
    const { access_token } = await tokenR.json()
    cliente = new Client({ name: 'cliente-http-real', version: '1' })
    await cliente.connect(new StreamableHTTPClientTransport(new URL(`${ORIGEM}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${access_token}` } }, fetch: (url, init) => enviar(url, init) }))
    const ferramentas = await cliente.listTools()
    assert.ok(ferramentas.tools.some((t) => t.name === 'preparar_treino'))
    const diagnostico = await cliente.callTool({ name: 'verificar_conexao', arguments: {} })
    assert.notEqual(diagnostico.isError, true, JSON.stringify(diagnostico))
    const r = await cliente.callTool({ name: 'preparar_treino', arguments: { acao: 'editar', alunoId: 'runtimeAluno', mesoId: 'runtimeCiclo', removerSlotIds: ['face1', 'face5'] } })
    assert.notEqual(r.isError, true, JSON.stringify(r))
    const { id } = JSON.parse(r.content[0].text)
    const previa = await chamar(`/prescricao?id=${id}`, { headers: { Authorization: `Bearer ${idToken}` } })
    assert.equal(previa.status, 200)
    assert.deepEqual((await previa.json()).proposta.sessoesPreservadas, ['1-1'])
    perderResposta = true
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { cwd: resolve('..'), stdio: 'ignore', env: { ...process.env, VITE_USE_EMULATOR: '1', VITE_CONECTOR_URL: 'https://vfit-conector.vfitcoach-site.workers.dev' } })
    for (let i = 0; i < 100; i++) {
      if (await fetch('http://127.0.0.1:5177').then((r) => r.ok, () => false)) break
      if (i === 99) throw new Error('App de teste não iniciou.')
      await new Promise((r) => setTimeout(r, 100))
    }
    navegador = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] })
    const page = await navegador.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    // Proxy de teste: não fabrica respostas. O Auth emulado é traduzido para a assinatura
    // da fixture, enquanto o Worker executa sua verificação RS256/MFA normal.
    await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), headers = new Headers(req.headers())
      headers.delete('Origin') // O proxy local do Miniflare recusa origens externas antes de chegar ao Worker.
      let body = req.postData()
      if (req.method() !== 'OPTIONS') {
        const token = req.method() === 'POST' ? JSON.parse(body).idToken : headers.get('Authorization')?.replace(/^Bearer /, '')
        const quem = await getAuth(app).verifyIdToken(token)
        assert.equal(quem.uid, 'runtimeCoach')
        if (req.method() === 'POST') body = JSON.stringify({ ...JSON.parse(body), idToken })
        else headers.set('Authorization', `Bearer ${idToken}`)
      }
      const resposta = await chamar(url.pathname + url.search, { method: req.method(), headers, ...(body && { body }) })
      await route.fulfill({ status: resposta.status, headers: { ...Object.fromEntries(resposta.headers), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }, body: await resposta.text() })
    })
    await page.goto(`http://127.0.0.1:5177/#/confirmar-treino-mcp?id=${id}`)
    await page.getByLabel('E-mail').fill('runtime-mcp@example.com')
    await page.getByLabel('Senha').fill('senha123456')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('Sessões com registros preservadas', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Salvar treino', exact: true }).click()
    await expect(page.getByText('Não foi possível confirmar se o treino foi salvo.', { exact: false })).toBeVisible()
    await db.doc('mesos/runtimeCiclo').update({ mcpOperacao: 'outra-edicao' })
    await page.getByRole('button', { name: 'Consultar resultado', exact: true }).click()
    await expect(page.getByText('Treino salvo no app.', { exact: true })).toBeVisible()
    const salvo = (await db.doc('mesos/runtimeCiclo').get()).data()
    assert.equal(salvo.divisao.t1[0].slotId, 'sup')
    assert.equal(salvo.divisao.t5.length, 0)
    assert.equal(salvo.prescricoesRegistradas['1-1'].sessao.exercicios[0].slot.slotId, 'face1')
    assert.equal((await db.doc(`mcpOperacoes/${id}`).get()).data().uid, 'runtimeCoach')
    assert.equal((await db.doc('registros/runtimeCiclo_s01_t1').get()).data().cargas.face1.s1, 0)
  } finally {
    await navegador?.close()
    vite?.kill('SIGTERM')
    await cliente?.close()
    await mf?.dispose()
    await deleteApp(app)
    await rm(pasta, { recursive: true, force: true })
  }
})
