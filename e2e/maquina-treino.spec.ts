import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, gravarDoc, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

// #261: a máquina escolhida na montagem vai para o treino do aluno e fica gravada no registro ao iniciar (também
// offline). Trocar a máquina depois (A → B) não muda o treino já feito. Dados sintéticos, tela de celular.
// PRINT_CATALOGO=<pasta> salva as capturas.
const COACH = { nome: 'Gislane', email: 'gislane.maqtreino@teste.com', senha: 'senha123' }
const ALUNO = { nome: 'Bia Máquina', email: 'bia.maqtreino@teste.com', senha: 'senha123' }
const EXERCICIO = 'Cadeira Extensora Tradicional'
const A = { nome: 'Extensora', local: 'Academia', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgNivel: [5, 10, 15], porLado: false, exercicios: ['cadeira-extensora-tradicional'], por: 'Gislane', em: new Date() }
const B = { nome: 'Extensora', local: 'Condomínio', tipo: 'maquina', unidade: 'kg', incremento: 5, maximo: 80, porLado: false, exercicios: ['cadeira-extensora-tradicional'], por: 'Gislane', em: new Date() }

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' })

const print = async (page: Page, nome: string) => {
  if (process.env.PRINT_CATALOGO) await page.screenshot({ path: `${process.env.PRINT_CATALOGO}/${nome}.png` })
}
const entrar = async (page: Page, c: { email: string; senha: string }) => {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(c.email)
  await page.getByLabel('Senha').fill(c.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
type Doc = any
const maquinaDoSlot = async (mesoId: string) => {
  const d: Doc = await lerDoc(`mesos/${mesoId}`)
  return d?.fields?.divisao?.mapValue?.fields?.t1?.arrayValue?.values?.[0]?.mapValue?.fields?.maquina?.mapValue?.fields?.id?.stringValue ?? null
}
const maquinaGravada = async (regId: string) => {
  const d: Doc = await lerDoc(`registros/${regId}`)
  const texto = d?.fields?.prescricaoRegistrada?.stringValue
  return texto ? JSON.parse(texto).sessao.exercicios[0].slot.maquina?.id ?? 'sem máquina' : null
}

test('máquina no treino: montagem → aluno offline → registro guarda A; trocar para B não muda o passado', async ({ page, browser }) => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  const alunoId = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, 70)
  await gravarDoc('maquinas/m-academia-extensora', A)
  await gravarDoc('maquinas/m-condominio-extensora', B)
  const w = { w1: [10, 10, 10], w2: [10, 10, 10] }
  const mesoId = await criarMeso({
    alunoId, nome: 'Meso máquina', frequencia: 1, semanas: 2, inicio: hojeSaoPaulo(), pausaS: 60,
    divisao: { t1: [{ slotId: 'ext', nome: EXERCICIO }] }, progressao: { principais: w, auxiliares: w },
  })
  const seletor = page.getByLabel(`Máquina de ${EXERCICIO}`)
  const escolher = async (rotulo: string, id: string) => {
    await page.goto(`/#/meso/${mesoId}`)
    await page.getByRole('button', { name: 'Divisão', exact: true }).click()
    await seletor.selectOption({ label: rotulo })
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => maquinaDoSlot(mesoId), { timeout: 10_000 }).toBe(id)
  }

  await entrar(page, COACH)
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()

  await test.step('montagem: só as máquinas ligadas ao exercício; escolhe A', async () => {
    await page.goto(`/#/meso/${mesoId}`)
    await page.getByRole('button', { name: 'Divisão', exact: true }).click()
    await expect(seletor.locator('option')).toHaveText(['Sem máquina', 'Extensora · Academia', 'Extensora · Condomínio'])
    await seletor.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(800)
    await print(page, '8-montagem-maquina')
    await escolher('Extensora · Academia', 'm-academia-extensora')
  })

  const regId = `${mesoId}_s01_t1`
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  const pa = await ctx.newPage()

  await test.step('aluno: vê a máquina, inicia offline e o registro guarda A ao voltar a internet', async () => {
    await entrar(pa, ALUNO)
    await expect(pa.getByRole('navigation', { name: 'Menu' })).toBeVisible()
    await pa.goto(`/#/treino/${mesoId}/1/1`)
    const cartao = pa.locator('[data-treino-cartao]').filter({ hasText: EXERCICIO })
    await expect(cartao.getByText('Extensora · Academia', { exact: true })).toBeVisible()
    await print(pa, '9-treino-aluno-maquina')
    await ctx.setOffline(true)
    await pa.getByRole('button', { name: 'Iniciar treino' }).click()
    const kg = cartao.locator('input[inputmode="decimal"]').first()
    await kg.fill('4')
    await kg.blur()
    await ctx.setOffline(false)
    await expect.poll(() => maquinaGravada(regId), { timeout: 20_000 }).toBe('m-academia-extensora')
  })

  await test.step('coach troca para B: o plano muda, o treino feito continua com A', async () => {
    await escolher('Extensora · Condomínio', 'm-condominio-extensora')
    expect(await maquinaGravada(regId)).toBe('m-academia-extensora')
    await pa.reload()
    const cartao = pa.locator('[data-treino-cartao]').filter({ hasText: EXERCICIO })
    await expect(cartao.getByText('Extensora · Academia', { exact: true })).toBeVisible()
    await pa.goto(`/#/treino/${mesoId}/2/1`)
    await expect(pa.locator('[data-treino-cartao]').filter({ hasText: EXERCICIO }).getByText('Extensora · Condomínio', { exact: true })).toBeVisible()
  })

  await test.step('e volta para A: a semana 1 segue A, a 2 passa a A', async () => {
    await escolher('Extensora · Academia', 'm-academia-extensora')
    expect(await maquinaGravada(regId)).toBe('m-academia-extensora')
  })
  await ctx.close()
})
