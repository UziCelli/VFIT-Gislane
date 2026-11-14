import { expect, test } from '@playwright/test'
import { criarAluno, criarMeso, hojeSaoPaulo, limparEmuladores } from './seed'

// Diagnóstico opt-in: o tempo dos quadros depende da máquina, não é um limite de CI.
// PERF_TREINO=1 PW_CHROMIUM=/usr/bin/chromium npx playwright test e2e/treino-fluidez.spec.ts
// Testa gestos reais do Chromium, com CPU 4x mais lenta, cronômetro e gravação ativos.
test('treino: rolagem por toque e transições preservam relógio e carga', async ({ browser }) => {
  test.skip(process.env.PERF_TREINO !== '1', 'Diagnóstico de fluidez sob demanda')
  test.setTimeout(120_000)
  await limparEmuladores()
  const alunoId = await criarAluno('Bia Fluidez', 'bia.fluidez@teste.com', 'senha123', 80)
  const w = { w1: [10, 10, 10, 10] }
  await criarMeso({ alunoId, nome: 'Meso fluidez', frequencia: 1, semanas: 1, inicio: hojeSaoPaulo(), pausaS: 90,
    divisao: { t1: Array.from({ length: 10 }, (_, i) => ({ slotId: `ex${i}`, nome: `Supino Reto Barra ${i + 1}` })) },
    progressao: { principais: w, auxiliares: w },
  })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.addInitScript(() => localStorage.setItem('forca-novidades-pc', '2'))
  await page.goto('/')
  await page.getByLabel('E-mail').fill('bia.fluidez@teste.com')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const menu = page.getByRole('navigation', { name: 'Menu', exact: true })
  await menu.getByRole('link', { name: 'Treino', exact: true }).click()
  await page.getByRole('button', { name: /Treino 1/ }).click()
  await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click()
  const campo = page.locator('[data-treino-cartao] input[inputmode="decimal"]').first()
  await campo.fill('25')
  await campo.blur()
  await page.getByRole('button', { name: 'Descansar 90 s', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Pular', exact: true })).toBeVisible()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.waitForTimeout(1000) // fora da montagem inicial
  await page.evaluate(() => {
    const diag = { frames: [] as number[], longas: [] as number[], ultimo: 0, ativo: true }
    Object.assign(window, { diagnosticoTreino: diag })
    new PerformanceObserver((lista) => {
      if (diag.ativo) diag.longas.push(...lista.getEntries().map((e) => e.duration))
    }).observe({ type: 'longtask', buffered: false })
    const frame = (agora: number) => {
      if (!diag.ativo) return
      if (diag.ultimo) diag.frames.push(agora - diag.ultimo)
      diag.ultimo = agora
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  const arrastar = async (de: number, para: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 22, y: de }] })
    for (let passo = 1; passo <= 24; passo++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 22, y: de + (para - de) * passo / 24 }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(250)
  }
  for (let i = 0; i < 2; i++) {
    const inicio = await page.evaluate(() => window.scrollY)
    await arrastar(650, 100)
    await arrastar(650, 100)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(inicio + 500)
    for (let volta = 0; volta < 4 && await page.evaluate(() => window.scrollY) > 50; volta++) await arrastar(100, 700)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50)
  }
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(page.getByRole('button', { name: /Treino 1/ })).toBeVisible()
    await page.getByRole('button', { name: /Treino 1/ }).click()
    await expect(page.getByRole('heading', { name: 'Treino 1', exact: true })).toBeVisible()
    await expect(campo).toHaveValue('25')
    await expect(page.getByTestId('relogio-treino')).toBeVisible()
    // Aguarda o fim do deslize, inclusive sob CPU limitada. A tela deve liberar o transform.
    await expect.poll(() => page.locator('main').evaluate((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).transform !== 'none') return false
      return true
    })).toBe(true)
  }
  const resultado = await page.evaluate(() => {
    const diag = (window as unknown as { diagnosticoTreino: { frames: number[]; longas: number[]; ativo: boolean } }).diagnosticoTreino
    diag.ativo = false
    const tempos = diag.frames.sort((a, b) => a - b)
    return { quadros: tempos.length, intervaloMedianoMs: tempos[Math.floor(tempos.length / 2)], p95Ms: tempos[Math.floor(tempos.length * 0.95)], maiorIntervaloMs: Math.max(...tempos), tarefasLongas: diag.longas }
  })
  console.info('Fluidez CPU 4x:', JSON.stringify(resultado))
  await test.info().attach('fluidez-cpu-4x', { body: JSON.stringify(resultado, null, 2), contentType: 'application/json' })
  expect(erros).toEqual([])
  await context.close()
})
