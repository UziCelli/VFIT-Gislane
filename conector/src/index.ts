import { OAuthProvider, AuthorizationError, authorizationErrorRedirect, type AuthRequest, type OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server'
import { env as ambiente } from 'cloudflare:workers'
import { lerCorpoJson } from '../../push/src/corpo'
import { cors } from '../../push/src/cors'
import { chaveDoGoogle, verificarIdToken } from '../../push/src/jwt'
import { tokenAppCheck } from './appcheck'
import { ErroConector, Firestore } from './firestore'
import { prepararPrescricao, type EntradaPrescricao } from './prescricao'
import { PropostaTreino } from './proposta'
export { PropostaTreino } from './proposta'
import { executar } from './execucao'
import { criarServidor } from './servidor'
import { statusDeConexao } from './statusConexao'
import { apagarPedido, concluirLogin, criarPedido, lerPedido, type KV } from './login'
import { PedidoOAuth } from './pedido'
export { PedidoOAuth } from './pedido'

type Env = {
  OAUTH_KV: KVNamespace
  PEDIDOS: DurableObjectNamespace<PedidoOAuth>
  PROPOSTAS: DurableObjectNamespace<PropostaTreino>
  OAUTH_PROVIDER: OAuthHelpers
  MCP_RESOURCE: string
  APP_URL: string
  PROJETO: string
  FIREBASE_API_KEY: string
  FIREBASE_APP_ID?: string
  APPCHECK_DEBUG_TOKEN?: string
}
const E = ambiente as unknown as Env

const texto = (t: string, status = 200, extra: HeadersInit = {}) => new Response(t, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
const json = (v: unknown, status: number, origem: string | null) =>
  new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origem) } })

// ---- Ferramentas (MCP sem estado) ----
const rodar = (leitura: Parameters<typeof executar>[1], uid?: string) =>
  executar({ refreshToken: getMcpAuthContext()?.props.refreshToken, apiKey: E.FIREBASE_API_KEY, projeto: E.PROJETO, appId: E.FIREBASE_APP_ID, debugToken: E.APPCHECK_DEBUG_TOKEN, uid }, leitura)

const propostaObjeto = (env: Env, id: string) => env.PROPOSTAS.get(env.PROPOSTAS.idFromName(id))
const idValido = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
const negado = () => ({ isError: true as const, content: [{ type: 'text' as const, text: 'Reconecte o assistente para preparar treinos.' }] })
const mcp = createMcpHandler(() => criarServidor(rodar, {
  preparar: async (entrada: EntradaPrescricao) => {
    const props = getMcpAuthContext()?.props
    if (!statusDeConexao(props).podePrepararTreinos || typeof props?.uid !== 'string') return negado()
    const uid = props.uid
    return rodar(async (fs) => {
      const proposta = await prepararPrescricao(fs, entrada, Date.now())
      const id = crypto.randomUUID()
      // O RPC só aceita objetos simples; a leitura REST pode conter timestamps como instâncias Ts.
      await propostaObjeto(E, id).guardar(id, uid, structuredClone(proposta), Date.now())
      return { id, resumo: proposta.resumo, url: `${E.APP_URL}/#/confirmar-treino-mcp?id=${id}`, mensagem: 'O coach precisa conferir e salvar no app.' }
    }, uid)
  },
  consultar: async (id: string) => {
    const props = getMcpAuthContext()?.props
    if (!statusDeConexao(props).podePrepararTreinos || typeof props?.uid !== 'string') return negado()
    if (!idValido(id)) return { isError: true as const, content: [{ type: 'text' as const, text: 'Proposta inválida.' }] }
    const resultado = await propostaObjeto(E, id).ler(props.uid, Date.now())
    return { content: [{ type: 'text' as const, text: JSON.stringify(resultado ? { status: resultado.status, ...(resultado.status === 'salva' && { resultado: resultado.resultado }) } : { status: 'não encontrada' }) }] }
  },
}, () => getMcpAuthContext()?.props))

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
        const id = await criarPedido(pedidos(env), { req, cliente: c.clientName, host: c.redirectHost, versaoConsentimento: 2 }, agora)
        return Response.redirect(`${env.APP_URL}/#/conectar-claude?pedido=${id}`, 302)
      } catch (e) {
        if (e instanceof AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302)
        return texto('Pedido de conexão inválido.', 400)
      }
    }
    if ((url.pathname === '/prescricao' && request.method === 'GET') || (url.pathname === '/prescricao/confirmar' && request.method === 'POST')) {
      const confirmando = request.method === 'POST'
      const corpo = confirmando ? await lerCorpoJson(request, 8192) : null
      if (corpo?.status) return json({ erro: 'Pedido inválido.' }, corpo.status, origem)
      const campos = (corpo?.corpo ?? {}) as Record<string, unknown>
      const id = confirmando ? campos.id : url.searchParams.get('id')
      const idToken = confirmando ? campos.idToken : request.headers.get('Authorization')?.replace(/^Bearer /, '')
      if (!idValido(id) || typeof idToken !== 'string' || idToken.length > 4096) return json({ erro: 'Pedido inválido.' }, 400, origem)
      const quem = await verificarIdToken(idToken, (kid) => chaveDoGoogle(kid), Math.floor(agora / 1000), true)
      if (!quem || quem.projeto !== env.PROJETO) return json({ erro: 'Entre novamente com o código de 2 etapas.' }, 403, origem)
      try {
        const appCheck = await tokenAppCheck({ projeto: env.PROJETO, apiKey: env.FIREBASE_API_KEY, appId: env.FIREBASE_APP_ID, debugToken: env.APPCHECK_DEBUG_TOKEN, buscar: fetch, agora })
        const perfil = await new Firestore(env.PROJETO, idToken, fetch, appCheck).doc(`usuarios/${quem.uid}`)
        if (perfil?.dados.papel !== 'coach') return json({ erro: 'Só o coach pode confirmar um treino.' }, 403, origem)
        const obj = propostaObjeto(env, id)
        const resultado = confirmando ? await obj.confirmar(quem.uid, idToken, env.PROJETO, appCheck, agora) : await obj.ler(quem.uid, agora)
        if (!resultado) return json({ erro: 'Proposta não encontrada.' }, 404, origem)
        return json(resultado, 200, origem)
      } catch (e) {
        return json({ erro: e instanceof ErroConector ? e.message : 'Não foi possível acessar a proposta. Tente novamente.' }, 503, origem)
      }
    }
    if (url.pathname === '/pedido' && request.method === 'GET') {
      const p = await lerPedido(pedidos(env), url.searchParams.get('id'), agora)
      return p ? json({ cliente: p.cliente, host: p.host, versaoConsentimento: p.versaoConsentimento }, 200, origem) : json({ erro: 'Pedido vencido ou já usado.' }, 404, origem)
    }
    if (url.pathname === '/concluir' && request.method === 'POST') {
      const l = await lerCorpoJson(request, 16_384)
      if (l.status) return json({ erro: 'Pedido inválido.' }, l.status, origem)
      const r = await concluirLogin(
        {
          kv: pedidos(env), agora, projeto: env.PROJETO, apiKey: env.FIREBASE_API_KEY, appId: env.FIREBASE_APP_ID, debugToken: env.APPCHECK_DEBUG_TOKEN, buscar: fetch,
          obterChave: (kid) => chaveDoGoogle(kid),
          completar: async (req, uid, refreshToken, versaoConsentimento) =>
            (await env.OAUTH_PROVIDER.completeAuthorization({ request: req as AuthRequest, userId: uid, metadata: {}, scope: (req as AuthRequest).scope, props: { refreshToken, uid, ...(versaoConsentimento === 2 && { writeApproved: true }) } })).redirectTo,
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
