import { expect, test, type Page } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

const COACH = { nome: 'Victor', email: 'victor.ordem@teste.com', senha: 'senha123' }
const CAMPO = 'input[role="combobox"]'

test.beforeAll(async () => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
})

const nomes = (page: Page) => page.getByTestId('treino-1').locator(`li[data-slot] ${CAMPO}`).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))

async function arrastar(page: Page, de: number, para: number) {
  const alca = page.getByLabel(`Arrastar para mudar a ordem, posição ${de}`)
  const alvo = page.getByTestId('treino-1').locator('li[data-slot]').nth(para - 1)
  const a = (await alca.boundingBox())!
  const b = (await alvo.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  // Passa um pouco do meio do alvo, em passos (como o dedo).
  const y = para > de ? b.y + b.height * 0.75 : b.y + b.height * 0.25
  await page.mouse.move(a.x + a.width / 2, y, { steps: 8 })
  await page.mouse.up()
}

test('arrasta para mudar a ordem (o método vai junto) e exclui um exercício do meio', async ({ page }) => {
  const alunoId = await criarAluno('Ordem Teste', 'ordem.e2e@teste.com', 'senha123')
  const linha = { w1: [10, 10, 10, null, null, null] }
  const id = await criarMeso({
    alunoId, nome: 'Meso Ordem', frequencia: 1, semanas: 1, inicio: hojeSaoPaulo(), pausaS: 60,
    divisao: { t1: [{ slotId: 'a', nome: 'Agachamento Livre Halter' }, { slotId: 'b', nome: 'Leg Press 45' }, { slotId: 'c', nome: 'Cadeira Extensora' }] },
    progressao: { principais: linha, auxiliares: linha },
    metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 3, metodo: 'Rest-pause', escopo: 'Todas as séries' }],
  })
  await page.goto('/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto(`/#/meso/${id}`)
  await page.getByRole('button', { name: 'Divisão', exact: true }).click()
  await expect.poll(() => nomes(page)).toEqual(['Agachamento Livre Halter', 'Leg Press 45', 'Cadeira Extensora'])

  await arrastar(page, 3, 1)
  await expect.poll(() => nomes(page)).toEqual(['Cadeira Extensora', 'Agachamento Livre Halter', 'Leg Press 45'])

  // Teclado: seta para baixo na alça desce uma casa.
  await page.getByLabel('Arrastar para mudar a ordem, posição 2').press('ArrowDown')
  await expect.poll(() => nomes(page)).toEqual(['Cadeira Extensora', 'Leg Press 45', 'Agachamento Livre Halter'])

  await page.getByLabel('Excluir exercício, posição 2').click()
  await expect.poll(() => nomes(page)).toEqual(['Cadeira Extensora', 'Agachamento Livre Halter'])

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 10_000 })
  // Ordem salva: c, a; o Rest-pause foi junto com a Cadeira Extensora para a posição 1.
  // A gravação é offline primeiro ("Salvo" aparece antes de chegar ao servidor): espera chegar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (campo: any) => (campo?.arrayValue?.values ?? []).map((v: any) => v.mapValue.fields)
  const salvo = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (await lerDoc(`mesos/${id}`))!.fields as any
    return {
      ordem: lista(f.divisao.mapValue.fields.t1).map((s: { slotId: { stringValue: string } }) => s.slotId.stringValue),
      metodos: lista(f.metodos).map((m: { exercicio: { integerValue: string } }) => m.exercicio.integerValue),
    }
  }
  await expect.poll(salvo, { timeout: 10_000 }).toEqual({ ordem: ['c', 'a'], metodos: ['1'] })
})
