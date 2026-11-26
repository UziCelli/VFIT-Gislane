import { expect, test } from '@playwright/test'
import { criarCoach, lerDoc, limparEmuladores } from './seed'

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
  await page.getByLabel('Link do vídeo').fill('https://youtu.be/abc123')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('radio', { name: /^No ar · 1$/ }).click()
  await expect(page.getByRole('link', { name: 'Ver vídeo: Supino Reto Barra' })).toHaveAttribute('href', 'https://youtu.be/abc123')
  await expect.poll(() => campos('supino-reto-barra')).toMatchObject({ status: 'no-ar', link: 'https://youtu.be/abc123' })

  // 3. Voltar para "A gravar" apaga o registro
  await page.getByRole('button', { name: /^Supino Reto Barra/ }).click()
  await page.getByRole('radio', { name: 'A gravar', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(/^0 de \d+ gravados$/)).toBeVisible()
  await expect.poll(() => campos('supino-reto-barra')).toBeNull()
})
