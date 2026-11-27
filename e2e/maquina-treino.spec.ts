import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, gravarDoc, hojeSaoPaulo, lerDoc, limparEmuladores, listarDocs } from './seed'

// #261: a máquina escolhida na montagem vai para o treino do aluno e fica gravada no registro ao iniciar (também
// offline). O treino recebe só a projeção (ref opaca, rótulo do aluno e escala): local, observação, marca e o id do
// catálogo ficam no catálogo do coach. Trocar a máquina depois não muda o treino já feito; aposentar A e cadastrar B
// igual dá outra identidade, e a série em A continua em A. Dados sintéticos, tela de celular.
// PRINT_CATALOGO=<pasta> salva as capturas.
const COACH = { nome: 'Gislane', email: 'gislane.maqtreino@teste.com', senha: 'senha123' }
const ALUNO = { nome: 'Bia Máquina', email: 'bia.maqtreino@teste.com', senha: 'senha123' }
const EXERCICIO = 'Cadeira Extensora Tradicional'
const PRIVADO = ['Academia Secreta', 'Condomínio Secreto', 'OBS-SECRETA', 'MARCA-SECRETA', 'm-academia-extensora']
const pilha = Array.from({ length: 12 }, (_, i) => 5 * (i + 1))
// A: cadastro antigo (id com o local, ainda sem ref). Ganha uma ref opaca quando o coach abre a lista.
const A = { nome: 'Extensora', local: 'Academia Secreta', obs: 'OBS-SECRETA', fabricante: 'MARCA-SECRETA', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgNivel: pilha, porLado: false, exercicios: ['cadeira-extensora-tradicional'], por: 'Gislane', em: new Date() }
const REF_C = 'mq-cccccccccccccccccccc'
const C = { nome: 'Extensora', rotuloAluno: 'Extensora 2', local: 'Condomínio Secreto', tipo: 'maquina', unidade: 'kg', incremento: 5, maximo: 80, porLado: false, exercicios: ['cadeira-extensora-tradicional'], ref: REF_C, por: 'Gislane', em: new Date() }
const vazamentos = (o: unknown) => PRIVADO.filter((p) => JSON.stringify(o ?? null).includes(p))

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
const slotDoPlano = async (mesoId: string) => {
  const d: Doc = await lerDoc(`mesos/${mesoId}`)
  return d?.fields?.divisao?.mapValue?.fields?.t1?.arrayValue?.values?.[0]?.mapValue?.fields
}
const maquinaDoSlot = async (mesoId: string) => (await slotDoPlano(mesoId))?.maquina?.mapValue?.fields?.ref?.stringValue ?? null
const maquinaGravada = async (regId: string) => {
  const d: Doc = await lerDoc(`registros/${regId}`)
  const texto = d?.fields?.prescricaoRegistrada?.stringValue
  return texto ? JSON.parse(texto).sessao.exercicios[0].slot.maquina?.ref ?? 'sem máquina' : null
}
const refNoCatalogo = async (id: string) => ((await lerDoc(`maquinas/${id}`)) as Doc)?.fields?.ref?.stringValue ?? null

test('máquina no treino: sem local para o aluno; registro offline guarda A; A aposentada → B com outra identidade', async ({ page, browser }) => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  const alunoId = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, 70)
  await gravarDoc('maquinas/m-academia-extensora', A)
  await gravarDoc('maquinas/m-cccccccccccccccccccc', C)
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

  let REF_A = ''
  await test.step('montagem: só as máquinas ligadas ao exercício (o local aparece só aqui); escolhe A', async () => {
    await page.goto(`/#/meso/${mesoId}`)
    await page.getByRole('button', { name: 'Divisão', exact: true }).click()
    // A (antiga) ganha a ref ao abrir a lista e só então aparece no seletor.
    await expect(seletor.locator('option')).toHaveText(['Sem máquina', 'Extensora · Academia Secreta', 'Extensora · Condomínio Secreto'], { timeout: 10_000 })
    REF_A = (await refNoCatalogo('m-academia-extensora'))!
    expect(REF_A).toMatch(/^mq-[a-z0-9]{20}$/)
    await seletor.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(800)
    await print(page, '8-montagem-maquina')
    await escolher('Extensora · Academia Secreta', REF_A)
    const slot = await slotDoPlano(mesoId)
    expect(Object.keys(slot.maquina.mapValue.fields).sort()).toEqual(['kgNivel', 'niveis', 'nome', 'porLado', 'ref', 'tipo', 'unidade'])
    expect(vazamentos(slot)).toEqual([])
  })

  const regId = `${mesoId}_s01_t1`
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' })
  const pa = await ctx.newPage()
  const cartao = pa.locator('[data-treino-cartao]').filter({ hasText: EXERCICIO })

  await test.step('aluno: vê só o rótulo, inicia offline e o registro guarda A (sem campo privado) ao voltar a internet', async () => {
    await entrar(pa, ALUNO)
    await expect(pa.getByRole('navigation', { name: 'Menu' })).toBeVisible()
    await pa.goto(`/#/treino/${mesoId}/1/1`)
    await expect(cartao.locator('[data-maquina]')).toHaveText('Extensora')
    expect(vazamentos(await pa.locator('body').innerText())).toEqual([])
    await print(pa, '9-treino-aluno-maquina')
    await ctx.setOffline(true)
    await pa.getByRole('button', { name: 'Iniciar treino' }).click()
    const kg = cartao.locator('input[inputmode="decimal"]').first()
    await kg.fill('4')
    await kg.blur()
    expect(vazamentos(await pa.locator('body').innerText())).toEqual([])
    await ctx.setOffline(false)
    await expect.poll(() => maquinaGravada(regId), { timeout: 20_000 }).toBe(REF_A)
    expect(vazamentos(await lerDoc(`registros/${regId}`))).toEqual([])
  })

  await test.step('coach troca para C: o plano muda, o treino feito continua com A', async () => {
    await escolher('Extensora · Condomínio Secreto', REF_C)
    expect(await maquinaGravada(regId)).toBe(REF_A)
    await pa.reload()
    await expect(cartao.locator('[data-maquina]')).toHaveText('Extensora')
    await pa.goto(`/#/treino/${mesoId}/2/1`)
    await expect(cartao.locator('[data-maquina]')).toHaveText('Extensora 2')
    expect(vazamentos(await pa.locator('body').innerText())).toEqual([])
  })

  let REF_B = ''
  await test.step('A aposentada → B com mesmo nome, local e escala: outra identidade; a série em A continua em A', async () => {
    await page.goto('/#/maquinas')
    const cartaoA = page.locator('li').filter({ hasText: 'MARCA-SECRETA' }) // a marca só A tem
    await page.getByRole('heading', { name: 'Máquinas' }).waitFor()
    await cartaoA.getByRole('button', { name: 'Remover' }).click()
    await cartaoA.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('Removida: Extensora.')).toBeVisible()
    await expect.poll(() => lerDoc('maquinas/m-academia-extensora'), { timeout: 10_000 }).toBeNull()
    await page.getByRole('button', { name: 'Adicionar máquina' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Extensora')
    await page.getByLabel('Onde fica').fill('Academia Secreta')
    await page.getByLabel('Níveis').fill('12')
    await page.getByLabel('Nível 1 ≈ kg').fill('5')
    await page.getByLabel('+ kg por nível').fill('5')
    await page.getByLabel('Exercícios feitos nela').fill('extensora tradicional')
    await page.getByRole('button', { name: '+ Cadeira Extensora Tradicional' }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Cadastrada: Extensora')).toBeVisible()
    await expect.poll(async () => (await listarDocs('maquinas')).length, { timeout: 10_000 }).toBe(2)
    const b = ((await listarDocs('maquinas')) as Doc[]).find((d) => d.fields.local.stringValue === 'Academia Secreta')
    const idB = b.name.split('/').pop()
    REF_B = b.fields.ref.stringValue
    expect(idB).toMatch(/^m-[a-z0-9]{20}$/)
    expect(REF_B).toMatch(/^mq-[a-z0-9]{20}$/)
    expect(REF_B).not.toBe(REF_A)
    await escolher('Extensora · Academia Secreta', REF_B)
    expect(await maquinaGravada(regId)).toBe(REF_A)
    await pa.goto(`/#/treino/${mesoId}/1/1`)
    await expect(cartao.locator('[data-maquina]')).toHaveText('Extensora')
    expect(vazamentos(await slotDoPlano(mesoId))).toEqual([])
  })
  await ctx.close()
})
