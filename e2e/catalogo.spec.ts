import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

// Catálogo de exercícios (#255, etapas 3 e 4), com dados sintéticos no emulador e tela de celular (390 × 844):
// Guias → Catálogo → cadastrar → bloquear duplicata → buscar na montagem ("Seu") → salvar → reabrir → aluno vê 2 lados.
// PRINT_CATALOGO=<pasta> salva as capturas.
const COACH = { nome: 'Gislane', email: 'gislane.catalogo@teste.com', senha: 'senha123' }
const ALUNO = { nome: 'Bia Catálogo', email: 'bia.catalogo@teste.com', senha: 'senha123' }
const CAMPO = 'input[role="combobox"]'
const NOVO = 'Supino Teste Pegada Neutra Halteres'

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const print = async (page: Page, nome: string) => {
  if (process.env.PRINT_CATALOGO) await page.screenshot({ path: `${process.env.PRINT_CATALOGO}/${nome}.png` })
}
const entrar = async (page: Page, c: { email: string; senha: string }) => {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(c.email)
  await page.getByLabel('Senha').fill(c.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('cadastro manual: do catálogo ao treino do aluno, com "Por lado" preservado', async ({ page, browser }) => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  const alunoId = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, 70)
  const w = { w1: [10, 10, 10], w2: [10, 10, 10] }
  const mesoId = await criarMeso({
    alunoId, nome: 'Meso catálogo', frequencia: 1, semanas: 2, inicio: hojeSaoPaulo(), pausaS: 60,
    divisao: { t1: [{ slotId: 'a', nome: 'Rosca Direta Cabo' }] }, // nome antigo do catálogo
    progressao: { principais: w, auxiliares: w },
  })

  await entrar(page, COACH)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()

  await test.step('Guias → Catálogo: busca pelo nome antigo e filtros', async () => {
    await page.goto('/#/metodos')
    await page.getByRole('link', { name: /Catálogo de exercícios/ }).click()
    await expect(page.getByRole('heading', { name: 'Catálogo de exercícios' })).toBeVisible()
    await page.getByLabel('Buscar (nome novo ou antigo)').fill('rosca direta cabo')
    await expect(page.getByText('Rosca Direta Polia', { exact: true })).toBeVisible()
    await expect(page.getByText('antes: Rosca Direta Cabo')).toBeVisible()
    await page.getByLabel('Buscar (nome novo ou antigo)').fill('')
    await page.getByLabel('Grupo').selectOption('Peitorais')
    await page.getByLabel('Equipamento', { exact: true }).selectOption('maquina_articulada')
    await expect(page.getByText('Peck Deck Articulada', { exact: true })).toBeVisible()
    await print(page, '1-catalogo-filtros')
    await page.getByLabel('Grupo').selectOption('')
    await page.getByLabel('Equipamento', { exact: true }).selectOption('')
  })

  await test.step('cadastro com prévia; "Por lado" vem marcado para Halteres', async () => {
    await page.getByRole('button', { name: 'Adicionar exercício' }).click()
    await page.getByLabel('Movimento').fill('Supino Teste Pegada Neutra')
    const form = page.locator('select')
    await form.nth(0).selectOption('Peitorais')
    await form.nth(1).selectOption('halteres')
    await expect(page.getByRole('radio', { name: 'Por lado' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText(NOVO, { exact: true })).toBeVisible()
    await page.getByText('Nome no treino').evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await print(page, '2-cadastro-previa')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(`Cadastrado: ${NOVO}`)).toBeVisible()
    await expect.poll(async () => (await lerDoc('exerciciosProprios/p-supino-teste-pegada-neutra-halteres')) != null, { timeout: 10_000 }).toBe(true)
  })

  await test.step('duplicata: só muda a pontuação (mesmo id) e nome do catálogo base', async () => {
    await page.getByRole('button', { name: 'Adicionar exercício' }).click()
    const form = page.locator('select')
    await form.nth(0).selectOption('Peitorais')
    await form.nth(1).selectOption('halteres')
    await page.getByLabel('Movimento').fill('Supino Teste (Pegada Neutra)')
    await expect(page.getByText(`Você já cadastrou: ${NOVO}.`)).toBeVisible()
    await page.getByLabel('Movimento').fill('Supino Reto')
    await expect(page.getByText('Já existe no catálogo: Supino Reto Halteres.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
  })

  await test.step('montagem do treino: acha o cadastrado ("Seu"), salva e reabre', async () => {
    await page.goto(`/#/meso/${mesoId}`)
    await page.getByRole('button', { name: 'Divisão', exact: true }).click()
    await page.waitForTimeout(800)
    const campo = (p: number) => page.getByTestId('treino-1').locator(CAMPO).nth(p - 1)
    await expect(campo(1)).toHaveValue('Rosca Direta Cabo') // treino antigo intacto
    await campo(2).fill('supino teste')
    const opcao = page.getByRole('option').filter({ hasText: NOVO })
    await expect(opcao.getByText('Seu')).toBeVisible()
    await campo(2).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(800) // fim da animação de entrada da aba
    await print(page, '3-montagem-seu')
    await opcao.click()
    await expect(campo(2)).toHaveValue(NOVO)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 10_000 })
    // "Por lado" do cadastro vai gravado no slot (o aluno não lê exerciciosProprios).
    const slots = async () => {
      const d = (await lerDoc(`mesos/${mesoId}`)) as any
      return d.fields.divisao.mapValue.fields.t1.arrayValue.values.map((v: any) => ({
        nome: v.mapValue.fields.nome.stringValue, doisLados: v.mapValue.fields.doisLados?.booleanValue,
      }))
    }
    await expect.poll(slots, { timeout: 10_000 }).toEqual([{ nome: 'Rosca Direta Cabo', doisLados: undefined }, { nome: NOVO, doisLados: true }])
    await page.reload()
    await page.getByRole('button', { name: 'Divisão', exact: true }).click()
    await expect(campo(2)).toHaveValue(NOVO)
    await expect(page.getByTestId('treino-1').getByRole('checkbox').nth(1)).toBeChecked()
  })

  await test.step('aluno: o exercício cadastrado aparece no treino com carga por lado', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' })
    const pa = await ctx.newPage()
    await entrar(pa, ALUNO)
    await pa.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Treino', exact: true }).click()
    await pa.getByRole('button', { name: /Treino 1/ }).click()
    await pa.getByRole('button', { name: 'Iniciar treino' }).click()
    const cartao = pa.locator('.rounded-xl.border').filter({ hasText: NOVO })
    await expect(cartao.getByText(/kg de cada lado/)).toBeVisible()
    await cartao.scrollIntoViewIfNeeded()
    await print(pa, '4-treino-aluno')
    await ctx.close()
  })
})
