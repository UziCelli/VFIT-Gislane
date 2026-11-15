import { OAuthProvider, AuthorizationError, authorizationErrorRedirect, type AuthRequest, type OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server'
import { env as ambiente } from 'cloudflare:workers'
import { lerCorpoJson } from '../../push/src/corpo'
import { cors } from '../../push/src/cors'
import { chaveDoGoogle } from '../../push/src/jwt'
import { executar } from './execucao'
import { criarServidor } from './servidor'
import { apagarPedido, concluirLogin, criarPedido, lerPedido, type KV } from './login'
import { PedidoOAuth } from './pedido'
export { PedidoOAuth } from './pedido'

type Env = {
  OAUTH_KV: KVNamespace
  PEDIDOS: DurableObjectNamespace<PedidoOAuth>
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

const mcp = createMcpHandler(() => criarServidor(rodar))

// Cada pedido usa uma instância própria do Durable Object deste Worker.
// KV continua exclusivo para concessões OAuth; não garante consumo único de pedidos.
function pedidos(env: Env): KV {
  const objeto = (k: string) => env.PEDIDOS.get(env.PEDIDOS.idFromName(`__mcp:${k}`))
  return {
    get: (k) => objeto(k).lerPedido(),
    put: (k, v, o) => objeto(k).guardarPedido(v, Date.now() + (o?.expirationTtl ?? 600) * 1000),
    delete: async (k) => { await objeto(k).consumirPedido() },
    consume: (k) => objeto(k).consumirPedido(),
  }
}

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
        const id = await criarPedido(pedidos(env), { req, cliente: c.clientName, host: c.redirectHost }, agora)
        return Response.redirect(`${env.APP_URL}/#/conectar-claude?pedido=${id}`, 302)
      } catch (e) {
        if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302)
        return texto('Pedido de conexão inválido.', 400)
      }
    }
    if (url.pathname === '/pedido' && request.method === 'GET') {
      const p = await lerPedido(pedidos(env), url.searchParams.get('id'), agora)
      return p ? json({ cliente: p.cliente, host: p.host }, 200, origem) : json({ erro: 'Pedido vencido ou já usado.' }, 404, origem)
    }
    if (url.pathname === '/concluir' && request.method === 'POST') {
      const l = await lerCorpoJson(request, 16_384)
      if (l.status) return json({ erro: 'Pedido inválido.' }, l.status, origem)
      const r = await concluirLogin(
        {
          kv: pedidos(env), agora, projeto: env.PROJETO, apiKey: env.FIREBASE_API_KEY, buscar: fetch,
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
      const p = await lerPedido(pedidos(env), id, agora)
      if (!p) return json({ erro: 'Pedido vencido ou já usado.' }, 400, origem)
      await apagarPedido(pedidos(env), id as string)
      return json({ redirectTo: gerarRedirect(p.req as AuthRequest, 'access_denied') }, 200, origem)
    }
    return texto('Não encontrado.', 404)
  },
}

export const provedor = () => new OAuthProvider({
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  apiRoute: '/mcp',
  apiHandler: { fetch: (request: Request, env: unknown, ctx: ExecutionContext) => mcp(request, env, ctx) },
  defaultHandler: loginHandler,
  resourceMetadata: { resource: E.MCP_RESOURCE },
})

export default provedor()
