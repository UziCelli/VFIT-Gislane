import { expect, test, devices, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, hojeSaoPaulo, limparEmuladores } from './seed'

const COACH = { nome: 'Victor', email: 'victor.relogio-e2e@teste.com', senha: 'senha123' }
const ALUNO = { nome: 'Rita Relógio', email: 'rita.relogio-e2e@teste.com', senha: 'senha123' }
const PRINT = '/tmp/claude-0/-home-user-claude-cloud-celli/7bb1957b-62c0-5c39-98cc-434448e8e65a/scratchpad/treino-relogio.png'

test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })

let alunoId: string

async function semear() {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  alunoId = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, 80)
  const w = { w1: [8, 8, 8, null, null, null], w2: [8, 8, 8, null, null, null] }
  await criarMeso({
    alunoId,
    nome: 'Meso Relógio',
    frequencia: 2,
    semanas: 2,
    inicio: hojeSaoPaulo(),
    pausaS: 60,
    divisao: { t1: [{ slotId: 'a', nome: 'Desenvolvimento Militar Barra' }], t2: [{ slotId: 'a', nome: 'Rosca Direta Barra' }] },
    progressao: { principais: w, auxiliares: w },
  })
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

const saiu = (page: Page) => page.evaluate(() => localStorage.getItem('forca-saiu-inatividade'))

const seg = async (page: Page) => {
  const t = (await page.getByTestId('relogio-treino').innerText()).split(':').map(Number)
  return t.reduce((a, n) => a * 60 + n, 0)
}

async function iniciarEConcluir(page: Page, print = false, aluno = false) {
  await expect(page.getByRole('heading', { name: 'Treino 1' })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.getByRole('button', { name: 'Iniciar treino' }).click()
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toHaveCount(0)
  await expect(page.getByText('Treino em andamento')).toBeVisible()
  const a = await seg(page)
  await expect.poll(() => seg(page), { timeout: 8000 }).toBeGreaterThan(a)
  if (print) await page.screenshot({ path: PRINT })
  await page.getByRole('button', { name: 'Concluir treino' }).click()
  await page.getByRole('button', { name: 'Sim, concluir' }).click()
  await expect(page.getByRole('heading', { name: /Treino concluído/ })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar para Hoje' }).click()
  if (aluno) await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Treino', exact: true }).click() // aluno volta ao Início
  await expect(page.getByRole('button', { name: /Treino 1.*Feito/ })).toBeVisible()
  await expect(page.getByText('Treino em andamento')).toHaveCount(0)
}

test('aluno: iniciar, relógio andando, concluir mostra duração parada', async ({ page }) => {
  await semear()
  await entrar(page, ALUNO.email, ALUNO.senha)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Treino', exact: true }).click()
  await page.getByRole('button', { name: /Treino 1/ }).click()
  await iniciarEConcluir(page, true, true)
  await page.getByRole('button', { name: /Treino 1/ }).click()
  await expect(page.getByText('Duração do treino')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('coach presencial: iniciar, relógio andando, concluir', async ({ page }) => {
  await semear()
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto(`/#/aluno/${alunoId}`)
  await page.getByRole('button', { name: 'Treino presencial' }).click()
  await expect(page.getByRole('heading', { name: 'Treino 1' })).toBeVisible() // abre sozinho no treino de hoje
  await iniciarEConcluir(page)
})

// Rolou a tela: o tempo continua à vista numa pílula no canto; tocar nela volta ao relógio.
async function pilulaAoRolar(page: Page, coach = false) {
  await page.getByRole('button', { name: 'Iniciar treino' }).click()
  await expect(page.getByText('Treino em andamento')).toBeVisible()
  const pilula = page.getByTestId('relogio-flutuante')
  await expect(pilula).toHaveCount(0) // relógio do topo à vista: sem pílula
  await page.evaluate(() => { document.body.style.paddingBottom = '3000px'; window.scrollTo(0, 1500) })
  await expect(pilula).toBeVisible()
  await expect(pilula).toHaveText(/\d+:\d{2}/)
  const caixa = await pilula.boundingBox()
  const barra = coach ? await page.getByRole('region', { name: 'Presencial' }).boundingBox() : null
  expect(caixa!.y).toBeGreaterThanOrEqual(barra ? barra.y + barra.height : 0) // coach: abaixo da barra do presencial
  expect(caixa!.x + caixa!.width).toBeGreaterThan(300) // canto direito
  await pilula.click()
  await expect(page.getByTestId('relogio-treino')).toBeInViewport()
  await expect(pilula).toHaveCount(0)
}

test('aluno: pílula do tempo aparece ao rolar', async ({ page }) => {
  await semear()
  await entrar(page, ALUNO.email, ALUNO.senha)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Treino', exact: true }).click()
  await page.getByRole('button', { name: /Treino 1/ }).click()
  await pilulaAoRolar(page)
})

test('coach presencial: pílula do tempo aparece ao rolar', async ({ page }) => {
  await semear()
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto(`/#/aluno/${alunoId}`)
  await page.getByRole('button', { name: 'Treino presencial' }).click()
  await expect(page.getByRole('heading', { name: 'Treino 1' })).toBeVisible()
  await pilulaAoRolar(page, true)
})

// Dois alunos no presencial: a pílula é só do aluno à vista (a do escondido não aparece por cima).
test('coach presencial com dois alunos: pílula só do aluno à vista', async ({ page }) => {
  await semear()
  const bId = await criarAluno('Caio Relógio', 'caio.relogio-e2e@teste.com', 'senha123', 80)
  const w = { w1: [8, 8, 8, null, null, null], w2: [8, 8, 8, null, null, null] }
  await criarMeso({
    alunoId: bId, nome: 'Meso Caio', frequencia: 2, semanas: 2, inicio: hojeSaoPaulo(), pausaS: 60,
    divisao: { t1: [{ slotId: 'a', nome: 'Supino Reto Barra' }], t2: [{ slotId: 'a', nome: 'Rosca Direta Barra' }] },
    progressao: { principais: w, auxiliares: w },
  })
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto(`/#/aluno/${alunoId}/presencial`)
  const bar = page.getByRole('region', { name: 'Presencial' })
  const a = page.getByRole('region', { name: `Treino de ${ALUNO.nome}` })
  await a.getByRole('button', { name: 'Iniciar treino' }).click()
  await page.evaluate(() => { document.body.style.paddingBottom = '3000px'; window.scrollTo(0, 1500) })
  await expect(a.getByTestId('relogio-flutuante')).toBeVisible()

  await bar.getByRole('button', { name: 'Adicionar aluno' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Caio Relógio/ }).click()
  await expect(bar.getByText('Caio Relógio')).toBeVisible()
  await expect(page.getByTestId('relogio-flutuante')).toBeHidden() // Rita escondida, Caio sem iniciar

  await page.getByRole('navigation', { name: 'Alunos do grupo' }).getByRole('button', { name: 'Rita' }).click()
  await page.evaluate(() => window.scrollTo(0, 1500))
  await expect(a.getByTestId('relogio-flutuante')).toBeVisible()
})

// Coach fica conectado: 25 min parado não derruba (antes caía em 20 min e pedia o 2FA de novo); 7 dias sem uso, sim.
test('inatividade do coach: não cai em 25 min, cai depois de 7 dias', async ({ page }) => {
  await semear()
  await page.clock.install()
  await entrar(page, COACH.email, COACH.senha)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.clock.fastForward('25:00')
  await page.waitForTimeout(1500)
  expect(await saiu(page)).toBeNull()
  await page.clock.fastForward(7 * 24 * 60 * 60_000)
  // O app marca "saiu por inatividade" e chama sair() (a tela de login não renderiza sob relógio falso).
  await expect.poll(() => saiu(page), { timeout: 15_000 }).toBe('1')
})
