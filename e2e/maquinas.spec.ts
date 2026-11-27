import { expect, test, type Page } from '@playwright/test'
import { criarCoach, lerDoc, limparEmuladores, listarDocs } from './seed'

// Máquinas (#260), com dados sintéticos no emulador e tela de celular (390 × 844):
// Catálogo → Máquinas → cadastrar seletora em nível ligada a um exercício → editar → o catálogo mostra a máquina.
// PRINT_CATALOGO=<pasta> salva as capturas.
const COACH = { nome: 'Gislane', email: 'gislane.maquinas@teste.com', senha: 'senha123' }
let ID = '' // sorteado ao cadastrar (não vem do nome nem do local)
let REF = ''

// lerDoc devolve o formato REST: { fields: { campo: { integerValue | arrayValue ... } } }.
const campo = (d: Record<string, unknown> | null, k: string) => (d?.fields as Record<string, any> | undefined)?.[k]

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const print = async (page: Page, nome: string) => {
  if (process.env.PRINT_CATALOGO) await page.screenshot({ path: `${process.env.PRINT_CATALOGO}/${nome}.png`, fullPage: true })
}

test('máquinas: cadastro em nível, vínculo com exercício e edição sem trocar o id', async ({ page }) => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  await page.goto('/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()

  await test.step('Catálogo → Máquinas (vazio)', async () => {
    await page.goto('/#/catalogo')
    await page.getByRole('link', { name: /Máquinas/ }).click()
    await expect(page.getByRole('heading', { name: 'Máquinas' })).toBeVisible()
    await expect(page.getByText('Nenhuma máquina cadastrada ainda.')).toBeVisible()
  })

  await test.step('cadastro: seletora em nível, pilha 5 + 5 kg, ligada à Cadeira Extensora', async () => {
    await page.getByRole('button', { name: 'Adicionar máquina' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Cadeira Extensora')
    await page.getByLabel('Onde fica').fill('Academia Teste')
    await page.getByLabel('Marca (opcional)').fill('Movement')
    await page.getByLabel('Níveis').fill('12')
    await page.getByLabel('Nível 1 ≈ kg').fill('5')
    await page.getByLabel('+ kg por nível').fill('5')
    await page.getByLabel('Exercícios feitos nela').fill('extensora tradicional')
    await page.getByRole('button', { name: '+ Cadeira Extensora Tradicional' }).click()
    await expect(page.getByRole('button', { name: 'Tirar Cadeira Extensora Tradicional' })).toBeVisible()
    await print(page, '5-maquina-cadastro')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Cadastrada: Cadeira Extensora')).toBeVisible()
    await expect(page.getByText('12 níveis · nível 1 ≈ 5 kg, +5 por nível')).toBeVisible()
    await expect.poll(async () => (await listarDocs('maquinas')).length, { timeout: 10_000 }).toBe(1)
    const [d] = await listarDocs('maquinas') as { name: string; fields: Record<string, any> }[]
    ID = d.name.split('/').pop()!
    REF = d.fields.ref?.stringValue
    expect(ID).toMatch(/^m-[a-z0-9]{20}$/)
    expect(REF).toMatch(/^mq-[a-z0-9]{20}$/)
    await expect.poll(async () => campo(await lerDoc(`maquinas/${ID}`), 'kgNivel')?.arrayValue?.values?.length, { timeout: 10_000 }).toBe(12)
  })

  await test.step('duplicata no mesmo local é recusada', async () => {
    await page.getByRole('button', { name: 'Adicionar máquina' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('cadeira extensora')
    await page.getByLabel('Onde fica').fill('Academia Teste')
    await page.getByLabel('Níveis').fill('10')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Já existe: Cadeira Extensora em Academia Teste.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
  })

  await test.step('editar: troca os níveis e mantém o id', async () => {
    await page.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Níveis').fill('15')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('15 níveis · nível 1 ≈ 5 kg, +5 por nível')).toBeVisible()
    await expect.poll(async () => campo(await lerDoc(`maquinas/${ID}`), 'niveis')?.integerValue, { timeout: 10_000 }).toBe('15')
    expect(campo(await lerDoc(`maquinas/${ID}`), 'ref')?.stringValue).toBe(REF)
    await print(page, '6-maquinas-lista')
  })

  await test.step('o catálogo mostra a máquina no exercício', async () => {
    await page.goto('/#/catalogo')
    await page.getByLabel('Buscar (nome novo ou antigo)').fill('extensora tradicional')
    await expect(page.getByText('Máquinas: Cadeira Extensora (Academia Teste)')).toBeVisible()
    await print(page, '7-catalogo-com-maquina')
  })
})
