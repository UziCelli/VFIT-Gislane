import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, limparEmuladores } from './seed'

const COACH = { email: 'victor.conectar-e2e@teste.com', senha: 'senha123' }
const ALUNO = { nome: 'Bia Conectar', email: 'bia.conectar-e2e@teste.com', senha: 'senha123' }
const PEDIDO = 'p'.repeat(43)

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })

test.beforeAll(async () => {
  await limparEmuladores()
  await criarCoach('Victor Celli', COACH.email, COACH.senha)
  await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha)
})

// O Worker é falso: devolve o nome do pedido e guarda o que o app manda.
async function conectorFalso(page: Page) {
  const enviados: { rota: string; corpo: Record<string, string> }[] = []
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request()
    const rota = new URL(req.url()).pathname
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (rota === '/volta') return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Voltou ao Claude</h1>' })
    if (rota === '/pedido') return route.fulfill({ status: 200, headers: cors, json: { cliente: 'Claude', host: 'claude.ai' } })
    enviados.push({ rota, corpo: req.postDataJSON() })
    return route.fulfill({ status: 200, headers: cors, json: { redirectTo: 'https://vfit-conector.vfitcoach-site.workers.dev/volta' } })
  })
  return enviados
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto(`/#/conectar-claude?pedido=${PEDIDO}`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('coach entra, vê o pedido e toca em Permitir: o app manda os tokens ao conector', async ({ page }) => {
  const enviados = await conectorFalso(page)
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByText('Permitir que o Claude veja e monte treinos dos seus alunos?')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('claude.ai', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Permitir' }).click()
  await expect(page.getByRole('heading', { name: 'Voltou ao Claude' })).toBeVisible()
  expect(enviados).toHaveLength(1)
  expect(enviados[0].rota).toBe('/concluir')
  expect(enviados[0].corpo.pedido).toBe(PEDIDO)
  expect(enviados[0].corpo.idToken.split('.')).toHaveLength(3)
  expect(enviados[0].corpo.refreshToken.length).toBeGreaterThan(10)
})

test('coach: Cancelar avisa o conector e volta', async ({ page }) => {
  const enviados = await conectorFalso(page)
  await entrar(page, COACH.email, COACH.senha)
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Voltou ao Claude' })).toBeVisible()
  expect(enviados.map((e) => e.rota)).toEqual(['/cancelar'])
  expect(enviados[0].corpo).toEqual({ pedido: PEDIDO })
})

test('pedido vencido: avisa em vez de mostrar os botões', async ({ page }) => {
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', (route) => route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, json: { erro: 'vencido' } }))
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByText('Este pedido venceu ou já foi usado.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Permitir' })).toHaveCount(0)
})

test('aluno não vê a tela de conexão', async ({ page }) => {
  await entrar(page, ALUNO.email, ALUNO.senha)
  await expect(page.getByText('Permitir que o Claude')).toHaveCount(0)
  await expect(page.getByText('Este pedido venceu')).toHaveCount(0)
})
