import { expect, test } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, gravarDoc, hojeSaoPaulo, lerDoc, limparEmuladores } from './seed'

// Campos de texto do documento (o REST do emulador devolve { campo: { stringValue } }); null = sem documento.
const campos = async (id: string) => {
  const d = (await lerDoc(`videos/${id}`)) as { fields: Record<string, { stringValue?: string }> } | null
  return d && Object.fromEntries(Object.entries(d.fields).filter(([, v]) => v.stringValue != null).map(([k, v]) => [k, v.stringValue]))
}

const COACH = { nome: 'Gislane', email: 'gislane.vid@teste.com', senha: 'senha123' }

test.beforeAll(async () => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
})

// Aba Consultas > Vídeos: marcar gravado, pôr no ar com link e voltar para "A gravar".
test('controle dos vídeos do catálogo', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.goto('/#/videos')
  await expect(page.getByRole('heading', { name: 'Vídeos' })).toBeVisible()
  await expect(page.getByText(/^0 de \d+ gravados$/)).toBeVisible()
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/videos-lista.png` })

  // 1. Gravado, com nota
  await page.getByLabel('Buscar exercício ou grupo').fill('supino reto barra')
  await page.getByRole('button', { name: /^Supino Reto Barra/ }).click()
  await page.getByLabel('Nota (opcional)').fill('regravar com luz melhor')
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/videos-editor.png` })
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(/^1 de \d+ gravados$/)).toBeVisible()
  await expect.poll(() => campos('supino-reto-barra')).toMatchObject({ status: 'gravado', nota: 'regravar com luz melhor', por: COACH.nome })

  // 2. No ar exige link
  await page.getByRole('radio', { name: /^Gravado · 1$/ }).click()
  await page.getByRole('button', { name: /^Supino Reto Barra/ }).click()
  await page.getByRole('radio', { name: 'No ar', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Cole o link do vídeo para marcar "No ar".')).toBeVisible()
  await page.getByLabel('Link do vídeo').fill('https://drive.google.com/x')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Para o aluno ver no app, use um link do YouTube.')).toBeVisible()
  await page.getByLabel('Link do vídeo').fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('radio', { name: /^No ar · 1$/ }).click()
  await expect(page.getByRole('link', { name: 'Ver vídeo: Supino Reto Barra' })).toHaveAttribute('href', 'https://youtu.be/dQw4w9WgXcQ')
  await expect.poll(() => campos('supino-reto-barra')).toMatchObject({ status: 'no-ar', link: 'https://youtu.be/dQw4w9WgXcQ' })

  // 3. Voltar para "A gravar" apaga o registro
  await page.getByRole('button', { name: /^Supino Reto Barra/ }).click()
  await page.getByRole('radio', { name: 'A gravar', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(/^0 de \d+ gravados$/)).toBeVisible()
  await expect.poll(() => campos('supino-reto-barra')).toBeNull()
})

// #253 etapa 1: "Ver demonstração" abaixo do nome. Fechado não cria player nem baixa nada; aberto toca no cartão;
// fechar devolve o cartão à altura de antes. Exercício sem vídeo no ar não mostra botão.
test('aluno abre e fecha a demonstração no cartão do exercício', async ({ page }) => {
  const ALUNO = { nome: 'Ana Demo', email: 'ana.demo@teste.com', senha: 'senha123' }
  const alunoId = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, 70)
  const w = { w1: [10, 10, 9, 9] }
  const mesoId = await criarMeso({
    alunoId, nome: 'Meso demo', frequencia: 1, semanas: 1, inicio: hojeSaoPaulo(), pausaS: 90,
    divisao: { t1: [{ slotId: 'a', nome: 'Supino Reto Barra' }, { slotId: 'b', nome: 'Remada Curvada com Barra' }] },
    progressao: { principais: w, auxiliares: w },
  })
  await gravarDoc('videos/supino-reto-barra', { status: 'no-ar', link: 'https://youtu.be/dQw4w9WgXcQ', por: 'Gislane' })
  await gravarDoc('videos/remada-curvada-com-barra', { status: 'gravado', link: 'https://youtu.be/dQw4w9WgXcQ', por: 'Gislane' })
  // O emulador não sai para a internet: o player do YouTube responde vazio e nada externo é baixado.
  const externos: string[] = []
  await page.route(/youtube/, (r) => (externos.push(r.request().url()), r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' })))
  await page.setViewportSize({ width: 360, height: 780 })
  await page.addInitScript(() => localStorage.setItem('forca-novidades-pc', '2'))
  await page.goto('/')
  await page.getByLabel('E-mail').fill(ALUNO.email)
  await page.getByLabel('Senha').fill(ALUNO.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toBeVisible()
  await page.goto(`/#/treino/${mesoId}/1/1`)
  const cartoes = page.locator('[data-treino-cartao]')
  await expect(cartoes).toHaveCount(2)
  const supino = cartoes.filter({ hasText: 'Supino Reto Barra' })
  const abrir = supino.getByRole('button', { name: 'Ver demonstração de Supino Reto Barra' })
  await expect(abrir).toBeVisible()
  await expect(cartoes.filter({ hasText: 'Remada Curvada com Barra' }).getByRole('button', { name: /Ver demonstração/ })).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(externos).toEqual([])
  const altura = (await supino.boundingBox())!.height

  await abrir.click()
  const player = supino.locator('iframe[title="Demonstração: Supino Reto Barra"]')
  await expect(player).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*mute=1/)
  await expect.poll(() => supino.boundingBox().then((b) => b!.height)).toBeGreaterThan(altura + 100)
  if (process.env.PRINT_VIDEOS) await page.screenshot({ path: `${process.env.PRINT_VIDEOS}/demo-aberta.png` })

  await supino.getByRole('button', { name: 'Fechar demonstração' }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect.poll(() => supino.boundingBox().then((b) => Math.round(b!.height))).toBe(Math.round(altura))
})
