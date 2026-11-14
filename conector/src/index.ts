import { OAuthProvider, AuthorizationError, authorizationErrorRedirect, type AuthRequest, type OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server'
import { env as ambiente } from 'cloudflare:workers'
import { z } from 'zod'
import { lerCorpoJson } from '../../push/src/corpo'
import { cors } from '../../push/src/cors'
import { chaveDoGoogle } from '../../push/src/jwt'
import { executar } from './execucao'
import { catalogoExercicios, listarAlunos, verAluno, verMesos } from './ferramentas'
import { apagarPedido, concluirLogin, criarPedido, lerPedido } from './login'

type Env = {
  OAUTH_KV: KVNamespace
  OAUTH_PROVIDER: OAuthHelpers
  MCP_RESOURCE: string
  APP_URL: string
  PROJETO: string
  FIREBASE_API_KEY: string
}
const E = ambiente as unknown as Env

const texto = (t: string, status = 200, extra: HeadersInit = {}) => new Response(t, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
const json = (v: unknown, status: number, origem: string | null) =>
  new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origem) } })

// ---- Ferramentas (MCP sem estado) ----
const rodar = (leitura: Parameters<typeof executar>[1]) =>
  executar({ refreshToken: getMcpAuthContext()?.props.refreshToken, apiKey: E.FIREBASE_API_KEY, projeto: E.PROJETO }, leitura)

function criarServidor() {
  const s = new McpServer({ name: 'vfit-conector', version: '1.0.0' })
  const alunoId = z.string().describe('id do aluno (vem de listar_alunos)')
  s.registerTool('listar_alunos', { description: 'Lista os alunos: nome, status, pago até, meso atual (semana e fim) e se já tem próximo meso.' }, () => rodar((fs) => listarAlunos(fs)))
  s.registerTool(
    'ver_aluno',
    { description: 'Perfil do aluno, anamnese mais recente (com sinais de atenção), última avaliação física, notas por exercício, relatos de dor e check-ins de recuperação.', inputSchema: z.object({ alunoId }) },
    ({ alunoId }) => rodar((fs) => verAluno(fs, alunoId)),
  )
  s.registerTool(
    'ver_mesos',
    {
      description: 'Mesos do aluno (atual, próximo e anteriores): treinos, exercícios, séries e reps prescritas por semana e as cargas × reps que o aluno registrou.',
      inputSchema: z.object({ alunoId, mesoId: z.string().optional().describe('só este meso (opcional)') }),
    },
    ({ alunoId, mesoId }) => rodar((fs) => verMesos(fs, alunoId, mesoId)),
  )
  s.registerTool('catalogo_exercicios', { description: 'Nomes dos exercícios do catálogo (use exatamente estes) e os métodos disponíveis.' }, () => rodar(async () => catalogoExercicios()))
  return s
}
const mcp = createMcpHandler(criarServidor)

// ---- Login: /authorize -> app -> /concluir ----
const gerarRedirect = (req: AuthRequest, erro: 'access_denied') => authorizationErrorRedirect(req, erro)

const loginHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origem = request.headers.get('Origin')
    const agora = Date.now()
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origem) })

    if (url.pathname === '/authorize' && request.method === 'GET') {
      try {
        const req = await env.OAUTH_PROVIDER.parseAuthRequest(request)
        const c = await env.OAUTH_PROVIDER.describeConsent(req)
        const id = await criarPedido(env.OAUTH_KV, { req, cliente: c.clientName, host: c.redirectHost }, agora)
        return Response.redirect(`${env.APP_URL}/#/conectar-claude?pedido=${id}`, 302)
      } catch (e) {
        if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302)
        return texto('Pedido de conexão inválido.', 400)
      }
    }
    if (url.pathname === '/pedido' && request.method === 'GET') {
      const p = await lerPedido(env.OAUTH_KV, url.searchParams.get('id'), agora)
      return p ? json({ cliente: p.cliente, host: p.host }, 200, origem) : json({ erro: 'Pedido vencido ou já usado.' }, 404, origem)
    }
    if (url.pathname === '/concluir' && request.method === 'POST') {
      const l = await lerCorpoJson(request, 16_384)
      if (l.status) return json({ erro: 'Pedido inválido.' }, l.status, origem)
      const r = await concluirLogin(
        {
          kv: env.OAUTH_KV, agora, projeto: env.PROJETO, apiKey: env.FIREBASE_API_KEY, buscar: fetch,
          obterChave: (kid) => chaveDoGoogle(kid),
          completar: async (req, uid, refreshToken) =>
            (await env.OAUTH_PROVIDER.completeAuthorization({ request: req as AuthRequest, userId: uid, metadata: {}, scope: (req as AuthRequest).scope, props: { refreshToken } })).redirectTo,
        },
        l.corpo,
      )
      return r.status === 200 ? json({ redirectTo: r.redirectTo }, 200, origem) : json({ erro: r.erro }, r.status, origem)
    }
    if (url.pathname === '/cancelar' && request.method === 'POST') {
      const l = await lerCorpoJson(request, 1024)
      const id = l.status ? null : (l.corpo as { pedido?: unknown })?.pedido
      const p = await lerPedido(env.OAUTH_KV, id, agora)
      if (!p) return json({ erro: 'Pedido vencido ou já usado.' }, 400, origem)
      await apagarPedido(env.OAUTH_KV, id as string)
      return json({ redirectTo: gerarRedirect(p.req as AuthRequest, 'access_denied') }, 200, origem)
    }
    return texto('Não encontrado.', 404)
  },
}

export default new OAuthProvider({
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  apiRoute: '/mcp',
  apiHandler: { fetch: (request: Request, env: unknown, ctx: ExecutionContext) => mcp(request, env, ctx) },
  defaultHandler: loginHandler,
  resourceMetadata: { resource: E.MCP_RESOURCE },
})
