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
  await page.addInitScript(() => localStorage.setItem('forca-tutorial-coach-visto', '1'))
  await page.goto('/')
  await page.getByLabel('E-mail', { exact: true }).fill(COACH.email)
  await page.getByLabel('Senha', { exact: true }).fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Menu', exact: true }).getByRole('link', { name: 'Alunos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Alunos' })).toBeVisible()

  // Nome no cartão do celular (a tabela do computador fica no DOM, escondida). Pelo texto exato: o botão do
  // cartão também leva o e-mail, e a engrenagem se chama "Configurações de <nome>".
  const cartao = (nome: string) => page.getByText(nome, { exact: true }).filter({ visible: true })
  const nomesNaTela = page.getByText(/^[A-Z][a-z]+ Busca$/).filter({ visible: true })
  // Altura na página, não na janela: com a lista curta a página encolhe e a rolagem volta sozinha.
  const altura = (nome: string) => cartao(nome).evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
  for (const nome of NOMES) await expect(cartao(nome)).toBeVisible({ timeout: 10_000 })
  const topoDaLista = await altura(NOMES[0])
  expect(await altura('Zeca Busca')).toBeGreaterThan(topoDaLista + 300)

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

  const campo = page.getByLabel('Buscar', { exact: true })
  // Digita como gente (uma letra a cada 80 ms): o campo mostra cada letra na hora.
  await campo.pressSequentially('zeca', { delay: 80 })
  await expect(campo).toHaveValue('zeca')

  // Só o Zeca fica, e ele termina no topo da lista, parado (sem transform sobrando do deslize).
  await expect(cartao('Ana Busca')).toHaveCount(0)
  await expect(nomesNaTela).toHaveCount(1)
  await expect.poll(() => altura('Zeca Busca'), { timeout: 5_000 }).toBe(topoDaLista)
  const parado = () => cartao('Zeca Busca').evaluate((el) => {
    for (let p: Element | null = el; p && p.tagName !== 'MAIN'; p = p.parentElement) {
      const t = getComputedStyle(p).transform
      if (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') return false
    }
    return true
  })
  await expect.poll(parado, { timeout: 5_000 }).toBe(true)

  // Apagar a busca traz todos de volta, na mesma ordem.
  await campo.fill('')
  await expect(nomesNaTela).toHaveCount(NOMES.length)
  await expect.poll(() => altura(NOMES[0]), { timeout: 5_000 }).toBe(topoDaLista)

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
