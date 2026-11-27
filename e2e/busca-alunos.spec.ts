import { expect, test } from '@playwright/test'
import { criarAluno, criarCoach, limparEmuladores } from './seed'

// Busca da lista de Alunos (coach) no celular: digitar filtra sem travar e o nome encontrado sobe para o topo.
// Antes, cada letra recomeçava a saída dos cartões (x/y soltos, na linha principal) e os de baixo só subiam
// depois dela. Os tempos de quadro saem no relatório (diagnóstico); o teste confere o resultado na tela.
const COACH = { nome: 'Victor', email: 'victor.busca@teste.com', senha: 'senha123' }
const NOMES = ['Ana Busca', 'Bruno Busca', 'Carla Busca', 'Diego Busca', 'Elisa Busca', 'Fabio Busca', 'Gabi Busca', 'Zeca Busca']

test.beforeAll(async () => {
  await limparEmuladores()
  await criarCoach(COACH.nome, COACH.email, COACH.senha)
  // Um por vez: a lista ordena ativos pelo vencimento, então o último criado (Zeca) fica embaixo.
  for (const [i, nome] of NOMES.entries()) await criarAluno(nome, `busca${i}@teste.com`, 'senha123')
})

test('busca de aluno no celular: filtra, o nome sobe e nada fica no meio da animação', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto('/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.getByRole('link', { name: 'Alunos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Alunos' })).toBeVisible()

  // Cartões do celular (a tabela do computador fica no DOM, escondida).
  const cartao = (nome: string) => page.getByRole('button', { name: new RegExp(nome) }).filter({ visible: true })
  for (const nome of NOMES) await expect(cartao(nome)).toBeVisible({ timeout: 10_000 })
  const topoDaLista = (await cartao(NOMES[0]).boundingBox())!.y
  expect((await cartao('Zeca Busca').boundingBox())!.y).toBeGreaterThan(topoDaLista + 300)

  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.evaluate(() => {
    const diag = { frames: [] as number[], longas: [] as number[], ultimo: 0, ativo: true }
    Object.assign(window, { diagnosticoBusca: diag })
    new PerformanceObserver((lista) => {
      if (diag.ativo) diag.longas.push(...lista.getEntries().map((e) => Math.round(e.duration)))
    }).observe({ type: 'longtask', buffered: false })
    const frame = (agora: number) => {
      if (!diag.ativo) return
      if (diag.ultimo) diag.frames.push(agora - diag.ultimo)
      diag.ultimo = agora
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })

  const campo = page.getByLabel('Buscar')
  // Digita como gente (uma letra a cada 80 ms): o campo mostra cada letra na hora.
  await campo.pressSequentially('zeca', { delay: 80 })
  await expect(campo).toHaveValue('zeca')

  // Só o Zeca fica, e ele termina no topo da lista, parado (sem transform sobrando do deslize).
  await expect(cartao('Ana Busca')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Busca/ }).filter({ visible: true })).toHaveCount(1)
  await expect.poll(async () => Math.round((await cartao('Zeca Busca').boundingBox())!.y), { timeout: 5_000 }).toBe(Math.round(topoDaLista))
  const parado = () => cartao('Zeca Busca').evaluate((el) => {
    for (let p: HTMLElement | null = el; p && p.tagName !== 'MAIN'; p = p.parentElement) {
      const t = getComputedStyle(p).transform
      if (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') return false
    }
    return true
  })
  await expect.poll(parado, { timeout: 5_000 }).toBe(true)

  // Apagar a busca traz todos de volta, na mesma ordem.
  await campo.fill('')
  for (const nome of NOMES) await expect(cartao(nome)).toBeVisible()
  await expect.poll(async () => Math.round((await cartao(NOMES[0]).boundingBox())!.y), { timeout: 5_000 }).toBe(Math.round(topoDaLista))

  const resultado = await page.evaluate(() => {
    const diag = (window as unknown as { diagnosticoBusca: { frames: number[]; longas: number[]; ativo: boolean } }).diagnosticoBusca
    diag.ativo = false
    const tempos = diag.frames.sort((a, b) => a - b)
    return { quadros: tempos.length, intervaloMedianoMs: Math.round(tempos[Math.floor(tempos.length / 2)]), p95Ms: Math.round(tempos[Math.floor(tempos.length * 0.95)]), maiorIntervaloMs: Math.round(Math.max(...tempos)), tarefasLongas: diag.longas }
  })
  console.info('Busca de alunos, CPU 4x:', JSON.stringify(resultado))
  await test.info().attach('busca-alunos-cpu-4x', { body: JSON.stringify(resultado, null, 2), contentType: 'application/json' })
  expect(erros).toEqual([])
  await context.close()
})
