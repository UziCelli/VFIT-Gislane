import { expect, test, type Page } from '@playwright/test'
import { criarCoach, limparEmuladores } from './seed'

const COACH = { email: 'mcp-confirmar@teste.com', senha: 'senha123' }
const ID = 'a'.repeat(36)
const proposta = { acao: 'editar', alunoNome: 'Ana Exemplo', nome: 'Força', resumo: 'Treino', dados: {
  frequencia: 1, semanas: 2, inicio: '2026-11-16', pausaS: 90, dias: [1],
  divisao: { t1: [{ slotId: 'x', nome: 'Agachamento Livre Halter' }] },
  progressao: { principais: { w1: [8, 8], w2: [10, 10] }, auxiliares: { w1: [8, 8], w2: [10, 10] } },
  metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Dropset', escopo: 'Todas as séries', etapas: 1, cargaEtapa: [12], repsEtapa: [6] }],
}, antes: { nome: 'Anterior', frequencia: 1, semanas: 1, inicio: '2026-11-16', pausaS: 90, divisao: { t1: [{ slotId: 'x', nome: 'Agachamento Livre Halter' }] }, progressao: { principais: { w1: [6, 6] }, auxiliares: { w1: [6, 6] } }, metodos: [] } }

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
test.beforeAll(async () => { await limparEmuladores(); await criarCoach('Victor', COACH.email, COACH.senha) })
async function entrar(page: Page) {
  await page.goto(`/#/confirmar-treino-mcp?id=${ID}`)
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
test('confere todas as semanas e tenta salvar novamente após falha', async ({ page }) => {
  let envios = 0
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.method() === 'GET') return route.fulfill({ headers: cors, json: { status: 'proposta', proposta } })
    envios++
    return envios === 1 ? route.fulfill({ status: 503, headers: cors, json: { erro: 'Tente novamente.' } }) : route.fulfill({ headers: cors, json: { status: 'salva', resultado: { mesoId: 'x' } } })
  })
  await entrar(page)
  await expect(page.getByText('Aluno: Ana Exemplo', { exact: false })).toBeVisible()
  await expect(page.locator('strong:visible').filter({ hasText: 'Agachamento Livre Halter' }).first()).toBeVisible()
  await page.getByText('Treino atual antes da alteração').click()
  await expect(page.getByText(/S1: 6 reps/)).toBeVisible()
  await expect(page.getByText(/carga por etapa: 12 kg/)).toBeVisible()
  await page.getByText('Semana 2', { exact: true }).click()
  await expect(page.getByText(/S1: 10 reps/)).toBeVisible()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Tente novamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Treino salvo no app.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar treino' })).toHaveCount(0)
  expect(envios).toBe(2)
})
test('proposta vencida não oferece gravação', async ({ page }) => {
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', (route) => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }, json: { status: 'expirada' } }))
  await entrar(page)
  await expect(page.getByText('Esta proposta venceu.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar treino' })).toHaveCount(0)
})
test('resultado pendente não oferece salvar outra vez e permite consultar', async ({ page }) => {
  let consultas = 0
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.method() === 'GET') return route.fulfill({ headers: cors, json: { status: 'resultado_pendente' } })
    consultas++
    return route.fulfill({ headers: cors, json: { status: 'salva', resultado: { mesoId: 'x' } } })
  })
  await entrar(page)
  await expect(page.getByText('Não foi possível confirmar se o treino foi salvo.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar treino' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Consultar resultado' }).click()
  await expect(page.getByText('Treino salvo no app.')).toBeVisible()
  expect(consultas).toBe(1)
})
test('retirada de exercício em dois treinos mostra impactos antes de salvar', async ({ page }) => {
  const linhas = { w1: [8, 8], w2: [10, 10] }
  const dados = { ...proposta.dados, frequencia: 5, dias: [], divisao: { t1: [], t2: [], t3: [], t4: [], t5: [] }, progressao: { principais: linhas, auxiliares: linhas }, metodos: [] }
  const antes = { ...dados, nome: 'Anterior', divisao: { ...dados.divisao, t1: [{ slotId: 'segredo1', nome: 'Facepull' }], t5: [{ slotId: 'segredo5', nome: 'Facepull' }] } }
  const remocao = { ...proposta, dados, previaDados: dados, antes, remocoes: [{ slotId: 'segredo1', nome: 'Facepull', treino: 1, posicao: 1 }, { slotId: 'segredo5', nome: 'Facepull', treino: 5, posicao: 1 }], avisos: ['As cargas registradas continuam guardadas.', 'Os exercícios removidos deixam de aparecer no treino planejado.', 'As sessões presenciais já ajustadas permanecem como estão.'] }
  let envios = 0
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.method() === 'GET') return route.fulfill({ headers: cors, json: { status: 'proposta', proposta: remocao } })
    envios++
    return envios === 1 ? route.fulfill({ status: 503, headers: cors, json: { erro: 'Tente novamente.' } }) : route.fulfill({ headers: cors, json: { status: 'salva', resultado: { mesoId: 'x' } } })
  })
  await entrar(page)
  await expect(page.getByText('Facepull · Treino 1')).toBeVisible()
  await expect(page.getByText('Facepull · Treino 5')).toBeVisible()
  await expect(page.getByText('As cargas registradas continuam guardadas.')).toBeVisible()
  await expect(page.getByText('Uma sessão presencial ajustada pode manter o exercício retirado.')).toBeVisible()
  await expect(page.getByText('As sessões presenciais já ajustadas permanecem como estão.')).toBeVisible()
  await expect(page.getByText('segredo1')).toHaveCount(0)
  await page.getByText('Treino atual antes da alteração').click()
  await expect(page.getByText('Facepull', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Tente novamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Treino salvo no app.')).toBeVisible()
  expect(envios).toBe(2)
})

test('proposta do assistente aparece sozinha no app e abre a conferência', async ({ page }) => {
  let pendente = true
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.url().includes('/prescricao/pendentes')) return route.fulfill({ headers: cors, json: { propostas: pendente ? [{ id: ID, nome: 'Força', alunoNome: 'Ana Exemplo', acao: 'criar', resumo: 'Treino', expiraEm: '2027-01-01T00:00:00Z', status: 'proposta' }] : [] } })
    if (req.method() === 'GET') return route.fulfill({ headers: cors, json: { status: 'proposta', proposta } })
    pendente = false
    return route.fulfill({ headers: cors, json: { status: 'salva', resultado: { mesoId: 'x' } } })
  })
  await page.goto('/#/')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('o assistente preparou um treino para você conferir.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: /Propostas/ }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Conferir treino' }).click()
  await expect(page.getByText('Aluno: Ana Exemplo', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Treino salvo no app.')).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page.getByText('o assistente preparou um treino para você conferir.', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Propostas/ })).toHaveCount(0)
})
test('lista do assistente: verificar agora consulta de novo e não há consulta periódica', async ({ page }) => {
  let consultas = 0, pendente = false
  await page.route('https://vfit-conector.vfitcoach-site.workers.dev/**', async (route) => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    consultas++
    return route.fulfill({ headers: cors, json: { propostas: pendente ? [{ id: ID, nome: 'Força', alunoNome: 'Ana Exemplo', acao: 'criar', resumo: 'Treino', expiraEm: '2027-01-01T00:00:00Z', status: 'proposta' }] : [] } })
  })
  await page.goto('/#/confirmar-treino-mcp')
  await page.getByLabel('E-mail').fill(COACH.email)
  await page.getByLabel('Senha').fill(COACH.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Nenhum treino aguardando.', { exact: false })).toBeVisible()
  const inicial = consultas
  await page.waitForTimeout(17_000) // antes consultava a cada 15 s
  expect(consultas).toBe(inicial)
  pendente = true
  await page.getByRole('button', { name: 'Verificar agora' }).click()
  await expect(page.getByText('Ana Exemplo', { exact: false }).first()).toBeVisible()
  expect(consultas).toBe(inicial + 1)
})
