import { expect, test, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { criarAluno, limparEmuladores, lerDoc } from './seed'

const marca = JSON.parse(readFileSync(`marcas/${process.env.MARCA ?? 'vfit'}/marca.json`, 'utf8'))
const ALUNO = { nome: 'Bia Aluna', email: 'bia.privacidade-e2e@teste.com', senha: 'senha123' }
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

test.use({ ...devices['Pixel 7'] })
test.beforeAll(limparEmuladores)

test('política abre sem login', async ({ page }) => {
  await page.goto('/privacidade')
  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible()
  await expect(page.getByText(`CREF ${marca.responsavel.cref}`)).toBeVisible()
  await expect(page.getByText('Versão vigente: 15/11/2026', { exact: false })).toBeVisible()
  await expect(page.getByText('Assistentes externos:', { exact: false })).toContainText('Claude (Anthropic) ou ChatGPT (OpenAI)')
  const assistentes = page.getByText('Assistentes externos:', { exact: false })
  if (marca.id === 'vfit') {
    await expect(assistentes).toContainText('O assistente também pode preparar treinos novos ou alterações')
    await expect(assistentes).toContainText('o coach precisa conferir e confirmar cada proposta no app antes de salvá-la')
  } else {
    await expect(assistentes).toContainText('No momento, essa conexão permite apenas consulta')
    await expect(assistentes).toContainText('ela não cria nem altera treinos ou outros dados no app')
  }
})

test('cadastro: botão só habilita com a caixa marcada', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await page.getByLabel('Nome').fill('Caio Novo')
  await page.getByLabel('E-mail').fill('caio.privacidade-e2e@teste.com')
  await page.getByLabel('Senha').fill('senha123')
  const criar = page.getByRole('button', { name: 'Criar conta', exact: true })
  await expect(criar).toBeDisabled()
  await page.getByLabel(/Li e aceito/).check()
  await expect(criar).toBeEnabled()
  await criar.click()
  await expect(page.getByText('Cadastro recebido!')).toBeVisible()
})

// Grava só a versão do aceite (como se tivesse aceitado uma política antiga).
async function versao(uid: string, v: string) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-forca/databases/(default)/documents/usuarios/${uid}?updateMask.fieldPaths=privacidadeVersao`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { privacidadeVersao: { stringValue: v } } }),
  })
  expect(r.ok).toBe(true)
}

async function entrar(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('aluno sem aceite e senha forte: só o pop-up, sem pedir senha', async ({ page }) => {
  const uid = await criarAluno(ALUNO.nome, ALUNO.email, ALUNO.senha, undefined, false)
  await entrar(page, ALUNO.email, ALUNO.senha)
  const popup = page.getByRole('dialog', { name: 'Termos de uso e privacidade' })
  await expect(popup).toBeVisible()
  await expect(page.getByLabel('Senha atual')).toHaveCount(0)
  const aceitar = page.getByRole('button', { name: 'Aceitar e continuar' })
  await expect(aceitar).toBeDisabled()
  await page.getByLabel(/Li e aceito/).check()
  await aceitar.click()
  await expect(popup).toBeHidden()
  await expect(page.getByText('Olá, Bia')).toBeVisible()
  await expect.poll(async () => JSON.stringify(await lerDoc(`usuarios/${uid}`))).toContain('privacidadeVersao')
  await page.reload()
  await expect(page.getByText('Olá, Bia')).toBeVisible()
  await expect(popup).toBeHidden()
})

test('termos atualizados: quem já conferiu a senha só vê o pop-up, mesmo sem entrar de novo', async ({ page }) => {
  const u = { nome: 'Gil Antigo', email: 'gil.termos-e2e@teste.com', senha: 'senha123' }
  const uid = await criarAluno(u.nome, u.email, u.senha)
  await entrar(page, u.email, u.senha)
  await expect(page.getByText('Olá, Gil')).toBeVisible()
  // Sessão aberta, aparelho sem o resultado do login (como quem entrou antes desta versão) e termos novos.
  await page.evaluate(() => localStorage.removeItem('forca-senha'))
  await versao(uid, '2026-11-14')
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Atualizamos os termos' })).toBeVisible()
  await expect(page.getByLabel('Senha atual')).toHaveCount(0)
  await page.getByLabel(/Li e aceito/).check()
  await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
  await expect(page.getByText('Olá, Gil')).toBeVisible()
})

test('sessão antiga sem senha conferida: confirma a senha uma vez e depois só o pop-up', async ({ page }) => {
  const u = { nome: 'Ana Velha', email: 'ana.velha-e2e@teste.com', senha: 'senha123' }
  const uid = await criarAluno(u.nome, u.email, u.senha)
  await entrar(page, u.email, u.senha)
  await expect(page.getByText('Olá, Ana')).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('forca-senha'))
  await versao(uid, '2026-10-13')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Confirme sua senha' })).toBeVisible()
  await page.getByLabel('Senha atual').fill('senha-errada1')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Senha atual incorreta.', { exact: false })).toBeVisible()
  await page.getByLabel('Senha atual').fill(u.senha)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('dialog', { name: 'Atualizamos os termos' })).toBeVisible()
  await page.getByLabel(/Li e aceito/).check()
  await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
  await expect(page.getByText('Olá, Ana')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Olá, Ana')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Confirme sua senha' })).toHaveCount(0)
})

test('cadastro: senha fraca não cria a conta e a lista mostra o que falta', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await expect(page.getByText('8 caracteres ou mais')).toBeVisible()
  await page.getByLabel('Nome').fill('Caio Fraco')
  await page.getByLabel('E-mail').fill('caio.fraca-e2e@teste.com')
  await page.getByLabel(/Li e aceito/).check()
  const criar = page.getByRole('button', { name: 'Criar conta', exact: true })
  await page.getByLabel('Senha').fill('123456')
  await expect(page.getByText('Senha forte')).toHaveCount(0)
  await criar.click()
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
  await page.getByLabel('Senha').fill('senhalonga')
  await criar.click()
  await expect(page.getByText('A senha precisa ter pelo menos um número.')).toBeVisible()
  await expect(page.getByText('Cadastro recebido!')).toHaveCount(0)
  await page.getByLabel('Senha').fill('senhalonga1')
  await expect(page.getByText('✓ Senha forte')).toBeVisible()
})

test('login com senha fraca: cria uma nova sem digitar a atual, aceita os termos e não pede de novo', async ({ page }) => {
  const u = { nome: 'Rui Fraco', email: 'rui.fraca-e2e@teste.com', senha: '123456' }
  await criarAluno(u.nome, u.email, u.senha, undefined, false)
  await entrar(page, u.email, u.senha)
  await expect(page.getByRole('heading', { name: 'Crie uma senha mais segura' })).toBeVisible()
  await expect(page.getByLabel('Senha atual')).toHaveCount(0)
  const salvar = page.getByRole('button', { name: 'Salvar senha nova' })
  await page.getByLabel('Nova senha', { exact: true }).fill('curta1')
  await page.getByLabel('Repetir nova senha').fill('curta1')
  await salvar.click()
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
  await page.getByLabel('Nova senha', { exact: true }).fill('treino2026')
  await page.getByLabel('Repetir nova senha').fill('treino2026')
  await expect(page.getByText('✓ Senha forte')).toBeVisible()
  await salvar.click()
  // Depois da senha, só o pop-up dos termos (sem pedir senha de novo).
  await expect(page.getByRole('dialog', { name: 'Termos de uso e privacidade' })).toBeVisible()
  await page.getByLabel(/Li e aceito/).check()
  await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
  await expect(page.getByText('Olá, Rui')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Olá, Rui')).toBeVisible()
  // A senha antiga parou de valer; a nova entra.
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: 'treino2026', returnSecureToken: true }),
  })
  expect(r.ok).toBe(true)
})

test('termos atualizados não pedem senha a quem tem senha forte, e senha fraca já aceita pede a troca', async ({ page }) => {
  const u = { nome: 'Edu Fraco', email: 'edu.fraco-e2e@teste.com', senha: 'abc123' }
  await criarAluno(u.nome, u.email, u.senha) // já aceitou a versão atual
  await entrar(page, u.email, u.senha)
  await expect(page.getByRole('heading', { name: 'Crie uma senha mais segura' })).toBeVisible()
  // Fechar e abrir o app não pula a troca.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Crie uma senha mais segura' })).toBeVisible()
  await page.getByLabel('Nova senha', { exact: true }).fill('treino2026')
  await page.getByLabel('Repetir nova senha').fill('treino2026')
  await page.getByRole('button', { name: 'Salvar senha nova' }).click()
  await expect(page.getByText('Olá, Edu')).toBeVisible()
})

test('sem internet na confirmação da senha: quem já aceitou a versão antiga treina agora e confirma depois', async ({ page, context }) => {
  const u = { nome: 'Lia Offline', email: 'lia.offline-e2e@teste.com', senha: 'senha123' }
  const uid = await criarAluno(u.nome, u.email, u.senha)
  await entrar(page, u.email, u.senha)
  await expect(page.getByText('Olá, Lia')).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('forca-senha'))
  await versao(uid, '2026-10-13')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Confirme sua senha' })).toBeVisible()
  const adiar = page.getByRole('button', { name: /Sem internet/ })
  await expect(adiar).toHaveCount(0) // com internet: não dá para pular
  await context.setOffline(true)
  await page.getByLabel('Senha atual').fill(u.senha)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await adiar.click()
  await expect(page.getByText('Olá, Lia')).toBeVisible()
  await context.setOffline(false)
})

// O pop-up vive num portal no <body> (fora da camada animada da tela). Na saída ele tem de ficar inerte já no começo:
// sem foco dentro e sem aceitar um segundo toque (ex.: "Não aceito, sair" logo depois de aceitar).
test('aceite no iPhone: pop-up na tela inteira e, ao aceitar, a saída não guarda foco nem aceita segundo toque', async ({ browser }) => {
  const u = { nome: 'Lia Transicao', email: 'lia.transicao-e2e@teste.com', senha: 'senha123' }
  const uid = await criarAluno(u.nome, u.email, u.senha, undefined, false)
  const vp = { width: 390, height: 844 }
  const ctx = await browser.newContext({ viewport: vp, userAgent: UA_IPHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  const page = await ctx.newPage()
  await entrar(page, u.email, u.senha)
  const popup = page.getByRole('dialog', { name: 'Termos de uso e privacidade' })
  await expect(popup).toBeVisible()

  // Disposição no iPhone: o fundo cobre a tela toda e o cartão cabe nela, sem rolagem lateral.
  const disp = await page.evaluate(() => {
    const fundo = document.querySelector('[data-fixo] > *')!.getBoundingClientRect()
    const cartao = document.querySelector('[role=dialog]')!.getBoundingClientRect()
    return { fundo: [fundo.left, fundo.top, fundo.width, fundo.height], cartao: [cartao.left, cartao.right], sw: document.documentElement.scrollWidth, iw: innerWidth }
  })
  expect(disp.fundo).toEqual([0, 0, vp.width, vp.height])
  expect(disp.cartao[0]).toBeGreaterThanOrEqual(0)
  expect(disp.cartao[1]).toBeLessThanOrEqual(vp.width)
  expect(disp.sw).toBeLessThanOrEqual(disp.iw)

  const sair = (await page.getByRole('button', { name: 'Não aceito, sair' }).boundingBox())!
  const ponto = { x: sair.x + sair.width / 2, y: sair.y + sair.height / 2 }
  await page.getByLabel(/Li e aceito/).check()

  // Saída em câmera lenta (animações a 5%), para o segundo toque cair com certeza no meio da transição.
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Animation.enable')
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.05 })
  await page.evaluate((p) => {
    const w = window as unknown as { __saida?: unknown }
    const fixo = document.querySelector('[data-fixo]')!
    new MutationObserver((_, obs) => {
      if (!fixo.hasAttribute('inert')) return
      obs.disconnect()
      const dialogo = fixo.querySelector('[role=dialog]')!
      // Dois quadros: o navegador tira o foco do que ficou inerte na atualização seguinte da tela.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        w.__saida = {
          focoDentro: dialogo.contains(document.activeElement),
          toqueNoPopup: !!document.elementFromPoint(p.x, p.y)?.closest('[data-fixo]'),
          escondido: fixo.getAttribute('aria-hidden'),
        }
      }))
    }).observe(fixo, { attributes: true, attributeFilter: ['inert'] })
  }, ponto)

  await page.getByRole('button', { name: 'Aceitar e continuar' }).tap()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __saida?: unknown }).__saida ?? null), { timeout: 3000 })
    .toEqual({ focoDentro: false, toqueNoPopup: false, escondido: 'true' })
  // Ainda na transição. Por papel não dá: o pop-up já está aria-hidden e getByRole o ignora.
  await expect(page.locator('[data-fixo] [role=dialog]')).toBeAttached()
  await page.touchscreen.tap(ponto.x, ponto.y) // segundo toque onde estava "Não aceito, sair"

  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 })
  await expect(page.getByText('Olá, Lia')).toBeVisible()
  await expect(page.locator('[data-fixo]')).toHaveCount(0) // a tela nova não herda nada do portal
  await expect.poll(async () => JSON.stringify(await lerDoc(`usuarios/${uid}`))).toContain('privacidadeVersao')
  await page.reload()
  await expect(page.getByText('Olá, Lia')).toBeVisible() // o segundo toque não saiu da conta
  await ctx.close()
})
