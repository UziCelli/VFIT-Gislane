import { expect, test, devices, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, criarRegistro, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

// Proteção do #237: anotar a carga de um exercício não pode redesenhar os outros cartões do treino, nem o tique do
// descanso. Sem medir tempo (não depende da máquina): confere quais cartões o React atualizou de fato. A cada
// atualização o React troca o objeto de props guardado no elemento (`__reactProps$…`); cartão que não redesenhou
// mantém o mesmo objeto. Função nova na tela de treino que volte a redesenhar a tela inteira derruba este teste.

const COACH = { nome: 'Coach Render', email: 'coach.render-e2e@teste.com', senha: 'senha123' }
const NOMES = ['Supino Reto Barra', 'Agachamento Livre', 'Remada Curvada Barra', 'Puxada Frontal', 'Elevação Lateral', 'Cadeira Extensora', 'Leg Press 45', 'Rosca Direta Barra']
const dados = NOMES.map((nome, i) => ({ slotId: 'ex' + i, nome }))
const cheio = (kg: number) => ({ s1: kg, s2: kg, s3: kg, s4: kg })

test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })

async function semear() {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  const alunoId = await criarAluno('Alfa Render', 'alfa.render-e2e@teste.com', 'senha123', 80)
  const w = { w1: [10, 10, 10, 10] }
  const mesoId = await criarMeso({ alunoId, nome: 'Meso Render', frequencia: 1, semanas: 1, inicio: hojeSaoPaulo(), pausaS: 90, divisao: { t1: dados }, progressao: { principais: w, auxiliares: w } })
  // Sessão já em andamento, com 4 exercícios anotados.
  await criarRegistro(mesoId, alunoId, 1, 1, { inicioEm: new Date(Date.now() - 10 * 60_000), cargas: Object.fromEntries(dados.slice(0, 4).map((d, i) => [d.slotId, cheio(20 + i)])) })
  return { alunoId, mesoId }
}

// Objeto de props atual de cada cartão, guardado na página para comparar depois.
const fotografar = (page: Page) =>
  page.evaluate(() => {
    const props = [...document.querySelectorAll('[data-treino-cartao]')].map((el) => {
      const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))!
      return (el as unknown as Record<string, unknown>)[k]
    })
    ;(window as unknown as { __cartoes: unknown[] }).__cartoes = props
    return props.length
  })
// Índices dos cartões que o React atualizou desde a foto.
const redesenhados = (page: Page) =>
  page.evaluate(() => {
    const antes = (window as unknown as { __cartoes: unknown[] }).__cartoes
    return [...document.querySelectorAll('[data-treino-cartao]')].flatMap((el, i) => {
      const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))!
      return (el as unknown as Record<string, unknown>)[k] === antes[i] ? [] : [i]
    })
  })

test('carga anotada e tique do descanso redesenham só o próprio cartão (#237)', async ({ page }) => {
  const { alunoId, mesoId } = await semear()
  await page.goto('/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto(`/#/aluno/${alunoId}/presencial/treino/${mesoId}/1/1`)
  const treino = page.getByRole('region', { name: 'Treino de Alfa Render' })
  await expect(treino.getByText('Treino em andamento')).toBeVisible()
  const cartoes = treino.locator('[data-treino-cartao]')
  await expect(cartoes).toHaveCount(NOMES.length)
  await page.waitForTimeout(1500) // histórico e confirmações da abertura chegam

  // 1) Corrige a S1 do 3º exercício (já anotado) e sai do campo: grava, confirma no servidor e só esse cartão muda.
  expect(await fotografar(page)).toBe(NOMES.length)
  const campo = cartoes.nth(2).locator('input[inputmode="decimal"]').first()
  await campo.fill('31')
  await campo.blur()
  await expect.poll(async () => {
    const d = await lerDoc(`registros/${mesoId}_s01_t1`)
    const v = (d?.fields as any)?.cargas?.mapValue?.fields?.ex2?.mapValue?.fields?.s1
    return v ? Number(v.integerValue ?? v.doubleValue) : null
  }).toBe(31)
  await page.waitForTimeout(1000) // confirmação do servidor (metadados) também chega à tela
  expect(await redesenhados(page)).toEqual([2])

  // 1b) 1ª carga num exercício ainda vazio (7º): também só ele.
  await fotografar(page)
  const vazio = cartoes.nth(6).locator('input[inputmode="decimal"]').first()
  await vazio.fill('40')
  await vazio.blur()
  await expect.poll(async () => {
    const d = await lerDoc(`registros/${mesoId}_s01_t1`)
    const v = (d?.fields as any)?.cargas?.mapValue?.fields?.ex6?.mapValue?.fields?.s1
    return v ? Number(v.integerValue ?? v.doubleValue) : null
  }).toBe(40)
  await page.waitForTimeout(1000)
  expect(await redesenhados(page)).toEqual([6])

  // 2) Descanso correndo no 6º exercício: os tiques atualizam só o número, nenhum cartão redesenha.
  await cartoes.nth(5).getByRole('button', { name: /Descansar \d+ s/ }).click()
  await expect(cartoes.nth(5).getByRole('button', { name: /Pausar \d+:\d+/ })).toBeVisible()
  await page.waitForTimeout(500)
  await fotografar(page)
  const antes = await cartoes.nth(5).getByRole('button', { name: /Pausar \d+:\d+/ }).getAttribute('aria-label')
  await expect.poll(() => cartoes.nth(5).getByRole('button', { name: /Pausar \d+:\d+/ }).getAttribute('aria-label')).not.toBe(antes)
  await page.waitForTimeout(1200)
  expect(await redesenhados(page)).toEqual([])
})
