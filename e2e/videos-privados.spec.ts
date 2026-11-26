import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

// #253 etapas 2 e 3, no emulador e com o Worker de vídeos SIMULADO (o real exige ID token de produção):
// aluno grava pela câmera falsa do Chromium e envia → cai a conexão → retoma → "Aguardando análise";
// coach vê a fila, marca um ponto no quadro, grava a orientação (com microfone falso) → aluno vê "Ligue o som",
// as marcações e a orientação de novo no treino seguinte com o mesmo exercício. Isolamento entre alunos e marcas
// fica nos testes de regras (tests/rules.test.ts, describe 'midias'); o Worker em push/src/midia.test.ts.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], executablePath: process.env.PW_CHROMIUM || undefined } })
test.describe.configure({ mode: 'serial' })

const WORKER = 'https://vfit-descanso.vfitcoach-site.workers.dev'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-forca/databases/(default)/documents'
const COACH = { nome: 'Gislane', email: 'coach.vidpriv@teste.com', senha: 'senha123' }
const ANA = { nome: 'Ana Vídeo', email: 'ana.vidpriv@teste.com', senha: 'senha123' }
const PARTE = 1024 * 1024

// Worker simulado: guarda as partes em memória, marca "pronto" no Firestore (como o real faz com o token do autor)
// e serve o vídeo. `falhar` derruba as próximas N partes (conexão caindo).
type Arquivo = { bytes: number; mime: string; partes: Map<number, Buffer>; completo: boolean }
const arquivos = new Map<string, Arquivo>()
const chamadas: string[] = []
let falhar = 0

async function simularWorker(page: Page) {
  await page.route(`${WORKER}/**`, async (r) => {
    const u = new URL(r.request().url())
    const corpo = () => JSON.parse(r.request().postData() ?? '{}')
    chamadas.push(u.pathname)
    if (u.pathname === '/vapid') return r.fulfill({ json: { publicKey: 'x' } })
    if (u.pathname === '/midia/iniciar') {
      const { id, bytes, mime } = corpo()
      const a = arquivos.get(id) ?? { bytes, mime, partes: new Map(), completo: false }
      arquivos.set(id, a)
      const total = Math.ceil(bytes / PARTE)
      return r.fulfill({ json: { ok: true, faltam: Array.from({ length: total }, (_, n) => n).filter((n) => !a.partes.has(n)) } })
    }
    if (u.pathname === '/midia/parte') {
      if (falhar > 0) {
        falhar--
        return r.abort('connectionreset')
      }
      arquivos.get(u.searchParams.get('id')!)!.partes.set(Number(u.searchParams.get('n')), r.request().postDataBuffer()!)
      return r.fulfill({ json: { ok: true } })
    }
    if (u.pathname === '/midia/concluir') {
      const { id } = corpo()
      const a = arquivos.get(id)!
      a.completo = true
      const q = 'updateMask.fieldPaths=status&updateMask.fieldPaths=prontoEm'
      await fetch(`${FS}/midias/${id}?${q}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { status: { stringValue: 'pronto' }, prontoEm: { timestampValue: new Date().toISOString() } } }) })
      return r.fulfill({ json: { ok: true } })
    }
    if (u.pathname === '/midia/link') return r.fulfill({ json: { url: `${WORKER}/midia/ver?id=${corpo().id}`, expira: Date.now() + 600_000 } })
    if (u.pathname === '/midia/ver') {
      const a = arquivos.get(u.searchParams.get('id')!)!
      const tudo = Buffer.concat([...a.partes.entries()].sort((x, y) => x[0] - y[0]).map(([, b]) => b))
      return r.fulfill({ status: 200, contentType: a.mime, body: tudo, headers: { 'Accept-Ranges': 'none' } })
    }
    if (u.pathname === '/midia/apagar') return r.fulfill({ json: { ok: true } })
    return r.fulfill({ json: { ok: true } })
  })
}

async function entrar(page: Page, conta: { email: string; senha: string }) {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.addInitScript(() => localStorage.setItem('forca-novidades-pc', '2'))
  await simularWorker(page)
  await page.goto('/')
  await page.getByLabel('E-mail').fill(conta.email)
  await page.getByLabel('Senha').fill(conta.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

const campo = async (caminho: string, nome: string) => {
  const d = (await lerDoc(caminho)) as { fields: Record<string, Record<string, unknown>> } | null
  return d?.fields?.[nome]
}
const midiasDe = async (tipo: string) => {
  const r = await fetch(`${FS}/midias`, { headers: { Authorization: 'Bearer owner' } })
  const docs = ((await r.json()).documents ?? []) as { name: string; fields: Record<string, { stringValue?: string; booleanValue?: boolean; arrayValue?: { values?: unknown[] } }> }[]
  return docs.filter((d) => d.fields.tipo.stringValue === tipo).map((d) => ({ id: d.name.split('/').pop()!, f: d.fields }))
}

let mesoId = ''
test.beforeAll(async () => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  const alunoId = await criarAluno(ANA.nome, ANA.email, ANA.senha, 70)
  const w = { w1: [10, 10, 9, 9] }
  mesoId = await criarMeso({
    alunoId, nome: 'Meso vídeo', frequencia: 2, semanas: 1, inicio: hojeSaoPaulo(), pausaS: 90,
    divisao: { t1: [{ slotId: 'a', nome: 'Supino Reto Barra' }], t2: [{ slotId: 'b', nome: 'Supino Reto Barra' }, { slotId: 'c', nome: 'Stiff Barra' }] },
    progressao: { principais: w, auxiliares: w },
  })
})

test('aluno grava, a conexão cai, retoma e vê "Aguardando análise"', async ({ page }) => {
  await entrar(page, ANA)
  await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toBeVisible()
  await page.goto(`/#/treino/${mesoId}/1/1`)
  const cartao = page.locator('[data-treino-cartao]').filter({ hasText: 'Supino Reto Barra' })
  await cartao.getByRole('button', { name: 'Enviar minha execução' }).click()
  const modal = page.getByRole('dialog', { name: 'Enviar minha execução' })
  await modal.getByRole('button', { name: 'Gravar agora' }).click()
  await expect(modal.getByRole('timer')).toContainText('Gravando')
  await page.waitForTimeout(2500)
  await modal.getByRole('button', { name: 'Parar' }).click()
  await expect(modal.locator('video[controls]')).toBeVisible()
  falhar = 3 // as 3 tentativas da 1ª parte caem
  await modal.getByRole('button', { name: 'Enviar' }).click()
  await expect(modal).toBeHidden()
  await expect(cartao.getByText('Conexão caiu. Toque em Retomar.')).toBeVisible({ timeout: 15_000 })
  const [exec] = await midiasDe('execucao')
  expect(exec.f.status.stringValue).toBe('enviando')
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/envio-parado.png` })

  await cartao.getByRole('button', { name: 'Retomar' }).click()
  await expect(cartao.getByText('Vídeo enviado · Aguardando análise')).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => (await campo(`midias/${exec.id}`, 'status'))?.stringValue).toBe('pronto')
  expect(arquivos.get(exec.id)!.completo).toBe(true)
  expect(chamadas.filter((c) => c === '/midia/concluir')).toHaveLength(1)
  // Enquanto espera a análise, não oferece outro envio do mesmo exercício.
  await expect(cartao.getByRole('button', { name: 'Enviar minha execução' })).toHaveCount(0)
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/aguardando.png` })
})

test('coach vê a fila, marca o quadro e grava a orientação falada', async ({ page }) => {
  await entrar(page, COACH)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.getByRole('link', { name: /Execuções para analisar · 1/ }).click()
  await page.getByRole('link', { name: /Ana Vídeo · Supino Reto Barra/ }).click()
  const video = page.locator('[data-revisao] video')
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'ponto', exact: true }).click()
  const caixa = (await page.locator('[data-revisao] canvas').boundingBox())!
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2)
  await expect(page.getByText(/1 marcações\./)).toBeVisible()
  await page.getByRole('button', { name: 'caneta', exact: true }).click()
  await page.mouse.move(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(caixa.x + caixa.width * 0.6, caixa.y + caixa.height * 0.6, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByText(/2 marcações\./)).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByText(/1 marcações\./)).toBeVisible()
  await page.getByRole('button', { name: 'Salvar marcações' }).click()
  await expect(page.getByText('Marcações salvas.')).toBeVisible()
  const [exec] = await midiasDe('execucao')
  await expect.poll(async () => (await midiasDe('execucao'))[0].f.marcas?.arrayValue?.values?.length).toBe(1)
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/revisao-coach.png` })

  await page.getByRole('button', { name: 'Gravar orientação' }).click()
  const modal = page.getByRole('dialog', { name: 'Orientação para o aluno' })
  await modal.getByRole('button', { name: 'Gravar agora' }).click()
  await page.waitForTimeout(2000)
  await modal.getByRole('button', { name: 'Parar' }).click()
  await modal.getByRole('button', { name: 'Enviar' }).click()
  await expect.poll(async () => (await midiasDe('orientacao'))[0]?.f.status.stringValue, { timeout: 15_000 }).toBe('pronto')
  const [orient] = await midiasDe('orientacao')
  expect(orient.f.respondeA.stringValue).toBe(exec.id)
  await expect.poll(async () => (await campo(`midias/${exec.id}`, 'respondida'))?.booleanValue).toBe(true)
  expect(arquivos.get(orient.id)!.mime).toMatch(/^video\//)
  await page.goto('/#/')
  await expect(page.getByRole('link', { name: /Execuções para analisar/ })).toHaveCount(0)
})

test('aluno vê a orientação com "Ligue o som", as marcações e de novo no treino seguinte', async ({ page }) => {
  await entrar(page, ANA)
  await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toBeVisible()
  await page.goto(`/#/treino/${mesoId}/1/1`)
  const cartao = page.locator('[data-treino-cartao]').filter({ hasText: 'Supino Reto Barra' })
  const abrir = cartao.getByRole('button', { name: /Orientação do coach/ })
  await expect(abrir).toContainText('nova')
  await abrir.click()
  await expect(cartao.locator('[data-ligue-som]')).toHaveText('Ligue o som')
  await expect(cartao.locator('video[title="Orientação: Supino Reto Barra"]')).toBeVisible()
  await expect(cartao.getByText('Seu vídeo com as marcações do coach')).toBeVisible()
  // Momento marcado: pula para ele e a marca aparece desenhada por cima (camada; o vídeo não muda).
  await cartao.getByRole('button', { name: /^\d+\.\d s$/ }).first().click()
  const tela = cartao.locator('[data-ligue-som] ~ * canvas, canvas').last()
  await expect.poll(() => tela.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
    return false
  })).toBe(true)
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/orientacao-aluno.png`, fullPage: true })
  await cartao.getByRole('button', { name: 'Fechar orientação' }).click()
  await expect(cartao.locator('video')).toHaveCount(0)

  // Treino seguinte com o mesmo exercício: a orientação mais recente reaparece; outro exercício não.
  await page.goto(`/#/treino/${mesoId}/1/2`)
  const cartoes = page.locator('[data-treino-cartao]')
  await expect(cartoes).toHaveCount(2)
  await expect(cartoes.filter({ hasText: 'Supino Reto Barra' }).getByRole('button', { name: /Orientação do coach/ })).toBeVisible()
  await expect(cartoes.filter({ hasText: 'Stiff Barra' }).getByRole('button', { name: /Orientação do coach/ })).toHaveCount(0)
  await expect(cartoes.filter({ hasText: 'Stiff Barra' }).getByRole('button', { name: 'Enviar minha execução' })).toBeVisible()
})
