import { lerCorpoBinario, lerCorpoJson } from './corpo'
import { atenderIA, MAX_CORPO_IA, ROTAS_IA, type AcaoIA, type ResultadoIA } from './ia'
import { DurableObject } from 'cloudflare:workers'
import { acessoComCache, appCheckOk, ehCoach, lerPermissao, podeAvisarTreino, quemAvisaCoach, registrarAgendamento, type CacheAcesso } from './acesso'
import { cors } from './cors'
import { chaveDaConta, chaveDoGoogle, verificarAviso, verificarIdToken, type Projeto } from './jwt'
import { alvosDe, comAparelho, endpointOk, semAparelho, type Fixa, inicioDoDiaBrasilia, nomeAgenda, nomeCoaches, nomeDO, passoAgenda, prefixoAgenda, tipoCoachOk, uidOk, validarAvisos, validarDesligados, validarEsquecer, validarFimEm, validarInscricao, validarRecado, type Aviso, type Inscricao, type Tipo, type TipoCoach } from './validar'
import { enviarPush, gerarParVapid, type ParVapid } from './webpush'
import { assinar, conferir, faixa, faltando, idOk, LINK_MS, limitarFaixa, lerMidia, marcarPronto, nomeMidia, ORFAO_MS, PARTE, partesDe, podeApagar, RETENCAO_DIAS, retomar, tamanhoParte, TETO_TOTAL, validarInicio, type Meta } from './midia'

// VIDEOS = "1" liga as rotas /midia/* (vídeos privados, #253). Desligado por padrão em wrangler.toml.
type Env = { DESCANSO: DurableObjectNamespace<Descanso>; MIDIA: DurableObjectNamespace<Midia>; VIDEOS?: string }

type Mensagem = { title: string; body: string; tag: string; url: string }

// Lidas pelo public/sw-push.js. Sem emoji (o ícone é a letra da marca).
const DESCANSO: Mensagem = { title: 'Descanso acabou', body: 'Volte para o treino', tag: 'descanso', url: '/' }
const TREINO: Mensagem = { title: 'Treino novo pronto', body: 'Seu próximo treino já está no app. Toque para ver.', tag: 'treino', url: '/' }
// Avisos do robô diário: [mensagem, tipo que a pessoa liga/desliga em Conta].
const ROBO: Record<Aviso['tipo'], [Mensagem, Tipo]> = {
  'vence-3d': [{ title: 'Mensalidade vence em 3 dias', body: 'Toque para ver como pagar.', tag: 'mensalidade', url: '/#/' }, 'mensalidade'],
  'vence-hoje': [{ title: 'Mensalidade vence hoje', body: 'Toque para ver como pagar.', tag: 'mensalidade', url: '/#/' }, 'mensalidade'],
  'treino-hoje': [{ title: 'Hoje tem treino', body: 'Seu treino de hoje está no app. Toque para começar.', tag: 'lembrete', url: '/' }, 'lembrete'],
}
const recado = (texto: string): Mensagem => ({ title: 'Aviso do coach', body: texto, tag: 'recado', url: '/' })
// Para o coach. A tag leva o uid do aluno: o aviso de um aluno não apaga o de outro na tela do coach.
const DO_ALUNO: Record<TipoCoach, (nome: string, uid: string) => Mensagem> = {
  concluiu: (n, u) => ({ title: 'Treino concluído', body: `${n} concluiu o treino.`, tag: `concluiu:${u}`, url: '/' }),
  comentou: (n, u) => ({ title: 'Nova anotação', body: `${n} escreveu uma anotação no treino.`, tag: `comentou:${u}`, url: '/' }),
  pagou: (n, u) => ({ title: 'Pagamento informado', body: `${n} tocou em "Já paguei". Toque para confirmar.`, tag: `pagou:${u}`, url: '/#/alunos' }),
}
// Vídeos (#253): sem nome, link ou miniatura no texto. O coach abre a fila; o aluno abre o treino.
const VIDEO_COACH: Mensagem = { title: 'Execução para analisar', body: 'Um aluno enviou um vídeo. Toque para ver.', tag: 'video', url: '/#/execucoes' }
const ORIENTACAO: Mensagem = { title: 'Orientação do coach', body: 'Chegou um vídeo com orientação. Ligue o som.', tag: 'orientacao', url: '/' }
const DEZ_MIN = 10 * 60_000
const MAX_COACHES = 5

// Uma instância por aluno (nome: veja nomeDO): guarda a inscrição e dispara o alarme.
// A instância '__vapid' guarda o par de chaves VAPID (gerado na 1ª vez, nunca regenerado).
export class Descanso extends DurableObject<Env> {
  private iaFila: Promise<unknown> = Promise.resolve()
  // Fila exclusiva do projeto: não deixa uma migração atrasada sobrescrever uma chave nova.
  ia(acao: AcaoIA, corpo: unknown, projeto: Projeto, token: string, appCheck?: string): Promise<string> {
    const resultado = this.iaFila.then(() => atenderIA(acao, corpo, this.ctx.storage, projeto, token, appCheck))
    this.iaFila = resultado.catch(() => {})
    return resultado.then(r => JSON.stringify(r))
  }

  private par?: Promise<ParVapid>
  // Só na memória: se a instância reiniciar, o limite e o cache recomeçam (basta para segurar abuso).
  private marcas: number[] = []
  private marcasTreino: number[] = []
  private limites = new Map<string, number[]>()
  private acesso?: CacheAcesso

  vapid(): Promise<ParVapid> {
    this.par ??= (async () => {
      const salvo = await this.ctx.storage.get<ParVapid>('vapid')
      if (salvo) return salvo
      const novo = await gerarParVapid()
      await this.ctx.storage.put('vapid', novo)
      return novo
    })().catch((e) => {
      this.par = undefined // falha temporária não fica presa no cache até o DO reiniciar
      throw e
    })
    return this.par
  }

  // Limite de frequência, depois acesso (ativo e em dia), depois agenda.
  async agendar(uid: string, projeto: Projeto, token: string, inscricao: Inscricao, fimEm: number, appCheck?: string): Promise<'ok' | 'limite' | 'bloqueado' | 'indisponivel'> {
    const agora = Date.now()
    const marcas = registrarAgendamento(this.marcas, agora)
    if (!marcas) return 'limite'
    this.marcas = marcas
    const r = await acessoComCache(this.acesso, agora, () => lerPermissao(uid, token, agora, projeto, fetch, appCheck))
    this.acesso = r.cache
    if (r.ok === null) return 'indisponivel'
    if (!r.ok) return 'bloqueado'
    await this.ctx.storage.put('inscricao', inscricao)
    await this.ctx.storage.setAlarm(fimEm)
    return 'ok'
  }

  async cancelar() {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.delete('inscricao')
  }

  // Limite de frequência por chave (janela deslizante, só na memória). false = estourou.
  async passar(chave: string, limite: number, janela: number): Promise<boolean> {
    const marcas = registrarAgendamento(this.limites.get(chave) ?? [], Date.now(), limite, janela)
    if (marcas) this.limites.set(chave, marcas)
    return !!marcas
  }

  // Só na instância '__coaches:<projeto>': uids dos coaches que ativaram as notificações (no máximo 5; sai o mais antigo).
  async coaches(): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>('coaches')) ?? []
  }

  async entrarCoach(uid: string) {
    const lista = (await this.coaches()).filter((c) => c !== uid)
    await this.ctx.storage.put('coaches', [...lista, uid].slice(-MAX_COACHES))
  }

  async sairCoach(uid: string) {
    const lista = await this.coaches()
    if (lista.includes(uid)) await this.ctx.storage.put('coaches', lista.filter((c) => c !== uid))
  }

  // Inscrições fixas (todos os avisos menos o descanso), uma por aparelho: não são apagadas depois do alarme do descanso.
  // Formato antigo (uma só: chaves `fixa` e `desligados`) é lido como a primeira da lista.
  private async fixas(): Promise<Fixa[]> {
    const lista = await this.ctx.storage.get<Fixa[]>('fixas')
    if (lista) return lista
    const antiga = await this.ctx.storage.get<Inscricao>('fixa')
    return antiga ? [{ i: antiga, d: (await this.ctx.storage.get<Tipo[]>('desligados')) ?? [], em: 0 }] : []
  }

  private async guardarFixas(lista: Fixa[]) {
    await this.ctx.storage.put('fixas', lista)
    await this.ctx.storage.delete(['fixa', 'desligados'])
  }

  // `desligados` = tipos que a pessoa desligou em Conta, neste aparelho.
  async inscrever(inscricao: Inscricao, desligados: Tipo[] = []) {
    await this.guardarFixas(comAparelho(await this.fixas(), { i: inscricao, d: desligados, em: Date.now() }))
  }

  // Tira este aparelho (ou todos, sem endpoint). Devolve quantos aparelhos sobraram.
  async desinscrever(endpoint?: string): Promise<number> {
    const resto = semAparelho(await this.fixas(), endpoint)
    await this.guardarFixas(resto)
    return resto.length
  }

  // Vídeos do aluno (#253): ids guardados aqui para a Limpeza LGPD apagar os arquivos junto.
  async anotarMidia(id: string) {
    const lista = (await this.ctx.storage.get<string[]>('midias')) ?? []
    if (!lista.includes(id)) await this.ctx.storage.put('midias', [...lista, id].slice(-5000))
  }

  async midias(): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>('midias')) ?? []
  }

  // Limpeza LGPD ("Apagar de vez"): apaga tudo o que esta instância guarda da pessoa.
  async esquecer() {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  // O aluno concluiu um treino agora (vem do /avisar-coach): o lembrete de hoje não faz mais sentido.
  async marcarConcluiu() {
    await this.ctx.storage.put('concluiuEm', Date.now())
  }

  // Só na instância '__agenda:<projeto>': guarda um lote de avisos para disparar em `quando` (alarme pontual).
  // `limpar` = 1º lote de um envio novo: troca o que estava guardado para essa mesma hora.
  async agendarAvisos(projeto: Projeto, quando: number, avisos: Aviso[], limpar: boolean) {
    const prefixo = prefixoAgenda(quando)
    if (limpar) await this.ctx.storage.delete([...(await this.ctx.storage.list({ prefix: prefixo })).keys()])
    if (avisos.length) await this.ctx.storage.put(`${prefixo}${crypto.randomUUID()}`, { projeto, avisos })
    const { alarme } = passoAgenda([...(await this.ctx.storage.list({ prefix: 'ag:' })).keys()], 0)
    if (alarme) await this.ctx.storage.setAlarm(alarme)
    else await this.ctx.storage.deleteAlarm()
  }

  // Um lote (até 20 avisos) por alarme, para caber nos 50 subpedidos do plano grátis; o resto fica para o alarme seguinte.
  private async dispararAgenda(chaves: string[]) {
    const { disparar, descartar, alarme } = passoAgenda(chaves, Date.now())
    const lote = disparar ? await this.ctx.storage.get<{ projeto: Projeto; avisos: Aviso[] }>(disparar) : undefined
    // Apaga antes de enviar: se o alarme falhar e repetir, ninguém recebe duas vezes.
    await this.ctx.storage.delete([...descartar, ...(disparar ? [disparar] : [])])
    if (alarme) await this.ctx.storage.setAlarm(alarme)
    if (!lote) return
    await Promise.all(
      lote.avisos.map((a) =>
        this.env.DESCANSO.get(this.env.DESCANSO.idFromName(nomeDO(lote.projeto, a.uid)))
          .avisar(...ROBO[a.tipo], false)
          .catch(() => false),
      ),
    )
  }

  // Envia a todos os aparelhos da pessoa que não desligaram o tipo. true = chegou em pelo menos um;
  // false = sem inscrição, tipo desligado ou não entregue; 404/410 apagam a inscrição daquele aparelho.
  async avisar(msg: Mensagem, tipo: Tipo, comLimite: boolean): Promise<boolean | 'limite'> {
    const fixas = await this.fixas()
    const alvos = alvosDe(fixas, tipo)
    if (fixas.length && !alvos.length) return false
    // Lembrete do treino: quem já concluiu um treino hoje (Brasília) não recebe.
    if (tipo === 'lembrete' && ((await this.ctx.storage.get<number>('concluiuEm')) ?? 0) >= inicioDoDiaBrasilia(Date.now())) return false
    if (comLimite) {
      // 3 por 10 min: o coach pode corrigir e reenviar, mas não dá para spammar o aluno.
      const marcas = registrarAgendamento(this.marcasTreino, Date.now(), 3, 10 * 60_000)
      if (!marcas) return 'limite'
      this.marcasTreino = marcas
    }
    if (!alvos.length) return false
    try {
      const chaves = await this.env.DESCANSO.get(this.env.DESCANSO.idFromName('__vapid')).vapid()
      const agora = Math.floor(Date.now() / 1000)
      const status = await Promise.all(alvos.map((f) => enviarPush(f.i, msg, chaves, agora).catch(() => 0)))
      const mortas = alvos.filter((_, k) => status[k] === 404 || status[k] === 410).map((f) => f.i.endpoint)
      // Relê a lista: durante o envio pode ter chegado um /inscrever ou /desinscrever (não regravar a lista velha).
      if (mortas.length) await this.guardarFixas((await this.fixas()).filter((f) => !mortas.includes(f.i.endpoint)))
      return status.some((x) => x >= 200 && x < 300)
    } catch {
      return false
    }
  }

  async alarm() {
    const agenda = [...(await this.ctx.storage.list({ prefix: 'ag:' })).keys()]
    if (agenda.length) return this.dispararAgenda(agenda)
    const inscricao = await this.ctx.storage.get<Inscricao>('inscricao')
    if (!inscricao) return
    await this.ctx.storage.delete('inscricao')
    try {
      const chaves = await this.env.DESCANSO.get(this.env.DESCANSO.idFromName('__vapid')).vapid()
      // 404/410: inscrição morta, já foi apagada acima. Outro erro: não insiste (o aviso ficaria atrasado).
      await enviarPush(inscricao, DESCANSO, chaves, Math.floor(Date.now() / 1000))
    } catch {
      /* sem rede: perdeu este aviso */
    }
  }
}

// Um vídeo privado por instância (nome: nomeMidia). Guarda `meta` e as partes `p:<n>` de 1 MiB.
// Instâncias especiais: '__chave' (chave HMAC dos links) e '__cota' (bytes guardados no total, teto TETO_TOTAL).
export class Midia extends DurableObject<Env> {
  private chave?: Promise<CryptoKey>

  hmac(): Promise<CryptoKey> {
    this.chave ??= (async () => {
      let bruta = await this.ctx.storage.get<ArrayBuffer>('hmac')
      if (!bruta) {
        bruta = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer
        await this.ctx.storage.put('hmac', bruta)
      }
      return crypto.subtle.importKey('raw', bruta, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    })().catch((e) => {
      this.chave = undefined
      throw e
    })
    return this.chave
  }

  // Só em '__cota'.
  async reservar(bytes: number): Promise<boolean> {
    const total = (await this.ctx.storage.get<number>('total')) ?? 0
    if (total + bytes > TETO_TOTAL) return false
    await this.ctx.storage.put('total', total + bytes)
    return true
  }

  async liberar(bytes: number) {
    const total = (await this.ctx.storage.get<number>('total')) ?? 0
    await this.ctx.storage.put('total', Math.max(0, total - bytes))
  }

  private cota() {
    return this.env.MIDIA.get(this.env.MIDIA.idFromName('__cota'))
  }

  async meta(): Promise<Meta | undefined> {
    return this.ctx.storage.get<Meta>('meta')
  }

  // Começa ou retoma. Devolve as partes que faltam; 'conflito' = outro arquivo com o mesmo id; 'cheio' = sem espaço.
  async iniciar(m: Pick<Meta, 'projeto' | 'id' | 'autor' | 'alunoId' | 'tipo' | 'bytes' | 'mime'>): Promise<{ faltam: number[] } | 'conflito' | 'cheio'> {
    const atual = await this.meta()
    if (atual) return retomar(atual, m)
    if (!(await this.cota().reservar(m.bytes))) return 'cheio'
    const meta: Meta = { ...m, partes: partesDe(m.bytes), recebidas: [], criadoEm: Date.now(), completo: false, avisado: false }
    await this.ctx.storage.put('meta', meta)
    await this.ctx.storage.setAlarm(meta.criadoEm + ORFAO_MS) // envio largado no meio some em 24 h
    return { faltam: faltando(meta) }
  }

  async parte(uid: string, n: number, dados: ArrayBuffer): Promise<200 | 400 | 403 | 404 | 409> {
    const m = await this.meta()
    if (!m) return 404
    if (m.autor !== uid) return 403
    if (m.completo) return 409
    if (!Number.isInteger(n) || n < 0 || n >= m.partes || dados.byteLength !== tamanhoParte(m.bytes, n)) return 400
    await this.ctx.storage.put(`p:${n}`, dados)
    if (!m.recebidas.includes(n)) await this.ctx.storage.put('meta', { ...m, recebidas: [...m.recebidas, n] })
    return 200
  }

  async concluir(uid: string): Promise<'ok' | 'faltam' | 403 | 404> {
    const m = await this.meta()
    if (!m) return 404
    if (m.autor !== uid) return 403
    if (m.completo) return 'ok'
    if (faltando(m).length) return 'faltam'
    await this.ctx.storage.put('meta', { ...m, completo: true })
    await this.ctx.storage.setAlarm(Date.now() + RETENCAO_DIAS * 86_400_000)
    return 'ok'
  }

  // Controle de duplicata: true só na primeira vez (o aviso sai uma vez por vídeo, mesmo com "concluir" repetido).
  async primeiroAviso(): Promise<boolean> {
    const m = await this.meta()
    if (!m || m.avisado) return false
    await this.ctx.storage.put('meta', { ...m, avisado: true })
    return true
  }

  async ler(inicio: number, fim: number): Promise<Uint8Array | null> {
    const m = await this.meta()
    if (!m?.completo) return null
    const de = Math.floor(inicio / PARTE)
    const ate = Math.floor(fim / PARTE)
    const chaves = Array.from({ length: ate - de + 1 }, (_, k) => `p:${de + k}`)
    const partes = await this.ctx.storage.get<ArrayBuffer>(chaves)
    const out = new Uint8Array(fim - inicio + 1)
    let pos = 0
    for (let n = de; n <= ate; n++) {
      const p = partes.get(`p:${n}`)
      if (!p) return null
      const ini = n === de ? inicio - n * PARTE : 0
      const fi = n === ate ? fim - n * PARTE + 1 : p.byteLength
      out.set(new Uint8Array(p, ini, fi - ini), pos)
      pos += fi - ini
    }
    return out
  }

  async apagar() {
    const m = await this.meta()
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    if (m) await this.cota().liberar(m.bytes)
  }

  // Órfão (não terminou em 24 h) ou fim da retenção: apaga o arquivo. O documento no Firestore fica (histórico).
  async alarm() {
    await this.apagar()
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req.headers.get('Origin'))
    const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(corpo, { status, headers: { ...h, 'Cache-Control': 'no-store', ...extra } })
    const { pathname } = new URL(req.url)

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })

    if (req.method === 'GET' && pathname === '/vapid') {
      const { publicKey } = await env.DESCANSO.get(env.DESCANSO.idFromName('__vapid')).vapid()
      return json({ publicKey }, 200, { 'Cache-Control': 'public, max-age=86400' })
    }

    const token = /^Bearer (\S+)$/.exec(req.headers.get('Authorization') ?? '')?.[1]
    const agora = Math.floor(Date.now() / 1000)
    const appCheck = appCheckOk(req.headers.get('X-Firebase-AppCheck')) // nunca logar
    const lerJson = async (max: number): Promise<{ corpo: unknown } | Response> => {
      const r = await lerCorpoJson(req, max)
      return r.status ? json({ erro: r.status === 413 ? 'corpo grande demais' : 'JSON inválido' }, r.status) : r
    }

    const coaches = (projeto: Projeto) => env.DESCANSO.get(env.DESCANSO.idFromName(nomeCoaches(projeto)))
    const aluno = (projeto: Projeto, uid: string) => env.DESCANSO.get(env.DESCANSO.idFromName(nomeDO(projeto, uid)))
    const midia = (projeto: Projeto, id: string) => env.MIDIA.get(env.MIDIA.idFromName(nomeMidia(projeto, id)))

    if (pathname.startsWith('/midia/')) {
      if (env.VIDEOS !== '1') return json({ erro: 'vídeos desligados' }, 404)
      return atenderMidia(req, env, pathname, token, agora, appCheck, json, lerJson, { aluno, coaches, midia })
    }

    if (req.method === 'POST' && ROTAS_IA.includes(pathname as AcaoIA)) {
      const id = token ? await verificarIdToken(token, kid => chaveDoGoogle(kid), agora, true) : null
      if (!token || !id || !uidOk(id.uid)) return json({ erro: 'Entre novamente com a verificação em 2 etapas.' }, 401)
      if (!(await aluno(id.projeto, id.uid).passar('ia', 30, 60000))) return json({ erro: 'Muitos pedidos. Tente mais tarde.' }, 429)
      if (!(await ehCoach(id.projeto, id.uid, token, fetch, appCheck))) return json({ erro: 'Sem permissão para usar a IA.' }, 403)
      const j = await lerJson(MAX_CORPO_IA)
      if (j instanceof Response) return j
      const corpo = j.corpo
      const r: ResultadoIA = JSON.parse(await env.DESCANSO.get(env.DESCANSO.idFromName(`__ia:${id.projeto}`)).ia(pathname as AcaoIA, corpo, id.projeto, token, appCheck))
      return json(r.corpo, r.status, { 'Cache-Control': 'no-store' })
    }

    // Robô diário (GitHub): JWT da conta de serviço, não ID token.
    if (req.method === 'POST' && pathname === '/aviso-pagamento') {
      if (!token || !(await verificarAviso(token, (iss, kid) => chaveDaConta(iss, kid), agora))) return json({ erro: 'não autorizado' }, 401)
      const j = await lerJson(64 * 1024)
      if (j instanceof Response) return j
      const dados = validarAvisos((j as { corpo: unknown }).corpo)
      if (!dados) return json({ erro: 'avisos inválidos' }, 400)
      if (dados.quando) {
        await env.DESCANSO.get(env.DESCANSO.idFromName(nomeAgenda(dados.projeto))).agendarAvisos(dados.projeto, dados.quando, dados.avisos, dados.inicio)
        return json({ ok: true, agendados: dados.avisos.length })
      }
      let enviados = 0
      for (let k = 0; k < dados.avisos.length; k += 10) {
        const lote = dados.avisos.slice(k, k + 10)
        const r = await Promise.all(lote.map((a) => aluno(dados.projeto, a.uid).avisar(...ROBO[a.tipo], false).catch(() => false)))
        enviados += r.filter((x) => x === true).length
      }
      return json({ ok: true, enviados })
    }

    // Limpeza LGPD (GitHub): mesmo JWT da conta de serviço. Apaga o que o Worker guarda de cada pessoa apagada.
    if (req.method === 'POST' && pathname === '/esquecer') {
      if (!token || !(await verificarAviso(token, (iss, kid) => chaveDaConta(iss, kid), agora))) return json({ erro: 'não autorizado' }, 401)
      const j = await lerJson(4096)
      if (j instanceof Response) return j
      const dados = validarEsquecer((j as { corpo: unknown }).corpo)
      if (!dados) return json({ erro: 'pedido inválido' }, 400)
      for (const uid of dados.uids) {
        for (const id of await aluno(dados.projeto, uid).midias()) await midia(dados.projeto, id).apagar()
        await aluno(dados.projeto, uid).esquecer()
        await coaches(dados.projeto).sairCoach(uid)
      }
      return json({ ok: true, esquecidos: dados.uids.length })
    }

    if (req.method === 'POST' && ['/agendar', '/cancelar', '/inscrever', '/desinscrever', '/treino-pronto', '/avisar-coach', '/recado'].includes(pathname)) {
      const id = token ? await verificarIdToken(token, (kid) => chaveDoGoogle(kid), agora) : null
      if (!token || !id || !uidOk(id.uid)) return json({ erro: 'não autorizado' }, 401)
      const { uid, projeto } = id
      const meu = aluno(projeto, uid)

      if (pathname === '/cancelar') {
        await meu.cancelar()
        return json({ ok: true })
      }
      if (pathname === '/desinscrever') {
        // Com `endpoint`, sai só este aparelho; o app antigo manda `{}` e tira todos.
        const j = await lerJson(4096)
        if (j instanceof Response) return j
        const endpoint = (j.corpo as { endpoint?: unknown } | null)?.endpoint
        const sobraram = await meu.desinscrever(endpointOk(endpoint) ? endpoint : undefined)
        if (sobraram === 0) await coaches(projeto).sairCoach(uid)
        return json({ ok: true })
      }

      const j = await lerJson(4096)
      if (j instanceof Response) return j
      const corpo = (j as { corpo: { subscription?: unknown; fimEm?: unknown; alunoId?: unknown; desligados?: unknown; coach?: unknown; tipo?: unknown } | null }).corpo

      if (pathname === '/treino-pronto') {
        const s = await podeAvisarTreino(projeto, uid, corpo?.alunoId, token, fetch, appCheck)
        if (s === 400) return json({ erro: 'alunoId inválido' }, 400)
        if (s === 403) return json({ erro: 'sem permissão' }, 403)
        if (s === 503) return json({ erro: 'não foi possível verificar o aluno' }, 503)
        const r = await aluno(projeto, corpo!.alunoId as string).avisar(TREINO, 'treino', true)
        if (r === 'limite') return json({ erro: 'aviso já enviado há pouco' }, 429, { 'Retry-After': '600' })
        return json({ ok: true, enviado: r })
      }

      // Aluno avisa o coach (concluiu, anotou, "Já paguei"). Texto fixo; o nome sai do perfil do aluno.
      if (pathname === '/avisar-coach') {
        const tipo = corpo?.tipo
        if (!tipoCoachOk(tipo)) return json({ erro: 'tipo inválido' }, 400)
        // 10 por minuto no total (segura as leituras do Firestore) e, depois de conferido, 1 por tipo a cada 10 min.
        if (!(await meu.passar('coach', 10, 60_000))) return json({ erro: 'muitos avisos' }, 429, { 'Retry-After': '60' })
        const quem = await quemAvisaCoach(projeto, uid, tipo, token, Date.now(), fetch, appCheck)
        if (quem === 403) return json({ erro: 'sem permissão' }, 403)
        if (quem === 503) return json({ erro: 'não foi possível verificar o acesso' }, 503)
        if (tipo === 'concluiu') await meu.marcarConcluiu()
        if (!(await meu.passar(`coach:${tipo}`, 1, DEZ_MIN))) return json({ erro: 'aviso já enviado há pouco' }, 429, { 'Retry-After': '600' })
        const lista = (await coaches(projeto).coaches()).filter((c) => c !== uid)
        await Promise.all(lista.map((c) => aluno(projeto, c).avisar(DO_ALUNO[tipo](quem.nome, uid), tipo, false).catch(() => false)))
        return json({ ok: true }) // não revela se o coach recebeu
      }

      // Coach escreve um aviso para até 15 alunos por chamada. Cada aluno é conferido como no /treino-pronto.
      if (pathname === '/recado') {
        const dados = validarRecado(corpo)
        if (!dados) return json({ erro: 'recado inválido' }, 400)
        if (!(await meu.passar('recado', 10, DEZ_MIN))) return json({ erro: 'muitos avisos' }, 429, { 'Retry-After': '600' })
        const msg = recado(dados.texto)
        const r = await Promise.all(
          dados.alunoIds.map(async (id) => {
            const s = await podeAvisarTreino(projeto, uid, id, token, fetch, appCheck)
            return s === 200 ? aluno(projeto, id).avisar(msg, 'recado', true).catch(() => false) : s
          }),
        )
        if (r.every((x) => x === 403)) return json({ erro: 'sem permissão' }, 403)
        if (r.every((x) => x === 503)) return json({ erro: 'não foi possível verificar os alunos' }, 503)
        return json({ ok: true, enviados: r.filter((x) => x === true).length })
      }

      const inscricao = validarInscricao(corpo?.subscription)
      if (!inscricao) return json({ erro: 'inscrição inválida' }, 400)
      if (pathname === '/inscrever') {
        const desligados = validarDesligados(corpo?.desligados)
        if (!desligados) return json({ erro: 'tipos inválidos' }, 400)
        await meu.inscrever(inscricao, desligados)
        // Só o app do coach manda `coach: true`; o papel é conferido no perfil (o aluno não gasta essa leitura).
        if (corpo?.coach === true && (await meu.passar('souCoach', 5, DEZ_MIN)) && (await ehCoach(projeto, uid, token, fetch, appCheck))) await coaches(projeto).entrarCoach(uid)
        return json({ ok: true })
      }

      if (!validarFimEm(corpo?.fimEm, Date.now())) return json({ erro: 'fimEm fora da janela (1 s a 15 min)' }, 400)
      const r = await meu.agendar(uid, projeto, token, inscricao, corpo.fimEm, appCheck)
      if (r === 'limite') return json({ erro: 'muitos agendamentos' }, 429, { 'Retry-After': '60' })
      if (r === 'bloqueado') return json({ erro: 'acesso bloqueado' }, 403)
      if (r === 'indisponivel') return json({ erro: 'não foi possível verificar o acesso' }, 503)
      return json({ ok: true })
    }

    return json({ erro: 'não encontrado' }, 404)
  },
}

type Json = (corpo: unknown, status?: number, extra?: Record<string, string>) => Response
type LerJson = (max: number) => Promise<{ corpo: unknown } | Response>
type Inst = {
  aluno: (p: Projeto, uid: string) => DurableObjectStub<Descanso>
  coaches: (p: Projeto) => DurableObjectStub<Descanso>
  midia: (p: Projeto, id: string) => DurableObjectStub<Midia>
}

// Rotas dos vídeos privados (#253). Contrato: docs/plano-videos.md.
// A confirmação anterior pode ter gravado 'pronto' e a resposta se perdido: lê de novo para saber.
async function jaPronto(projeto: Projeto, id: string, token: string, appCheck?: string): Promise<boolean> {
  const d = await lerMidia(projeto, id, token, fetch, appCheck)
  return !!d && d.status === 'pronto'
}

async function atenderMidia(req: Request, env: Env, pathname: string, token: string | undefined, agora: number, appCheck: string | undefined, json: Json, lerJson: LerJson, { aluno, coaches, midia }: Inst): Promise<Response> {
  const chave = () => env.MIDIA.get(env.MIDIA.idFromName('__chave')).hmac()
  const url = new URL(req.url)

  // <video src>: link assinado e curto, sem token (o player não manda cabeçalho). Suporta Range (avançar/voltar).
  if (req.method === 'GET' && pathname === '/midia/ver') {
    const q = url.searchParams
    const projeto = await conferir(await chave(), q.get('p'), q.get('id'), q.get('exp'), q.get('sig'), Date.now())
    if (!projeto) return new Response('link expirado', { status: 403, headers: { 'Cache-Control': 'no-store' } })
    const inst = midia(projeto, q.get('id')!)
    const m = await inst.meta()
    if (!m?.completo) return new Response('vídeo indisponível', { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const f = faixa(req.headers.get('Range'), m.bytes)
    if (f === 'invalida') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${m.bytes}` } })
    const r = limitarFaixa(f ?? { inicio: 0, fim: m.bytes - 1 })
    const corpo = await inst.ler(r.inicio, r.fim)
    if (!corpo) return new Response('vídeo indisponível', { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const parcial = !!f || r.fim < m.bytes - 1
    return new Response(corpo, {
      status: parcial ? 206 : 200,
      headers: {
        'Content-Type': m.mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(corpo.byteLength),
        ...(parcial ? { 'Content-Range': `bytes ${r.inicio}-${r.fim}/${m.bytes}` } : {}),
        'Cache-Control': 'private, no-store',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const id = token ? await verificarIdToken(token, (kid) => chaveDoGoogle(kid), agora) : null
  if (!token || !id || !uidOk(id.uid)) return json({ erro: 'não autorizado' }, 401)
  const { uid, projeto } = id
  const meu = aluno(projeto, uid)

  // Parte n do arquivo (corpo binário de até 1 MiB). Só o autor; tamanho exato conferido na instância.
  if (req.method === 'PUT' && pathname === '/midia/parte') {
    const mid = url.searchParams.get('id')
    const n = Number(url.searchParams.get('n'))
    if (!idOk(mid) || !Number.isInteger(n)) return json({ erro: 'pedido inválido' }, 400)
    if (!(await meu.passar('midia-parte', 120, 60_000))) return json({ erro: 'muitos pedidos' }, 429, { 'Retry-After': '60' })
    if (Number(req.headers.get('Content-Length') ?? 0) > PARTE) return json({ erro: 'parte grande demais' }, 413)
    const b = await lerCorpoBinario(req, PARTE)
    if (b.status) return json({ erro: b.status === 413 ? 'parte grande demais' : 'pedido inválido' }, b.status)
    const s = await midia(projeto, mid).parte(uid, n, b.dados)
    return s === 200 ? json({ ok: true }) : json({ erro: 'parte recusada' }, s)
  }

  if (req.method !== 'POST') return json({ erro: 'não encontrado' }, 404)
  const j = await lerJson(1024)
  if (j instanceof Response) return j
  const corpo = j.corpo as { id?: unknown } | null

  if (pathname === '/midia/iniciar') {
    const v = validarInicio(corpo)
    if (!v) return json({ erro: 'pedido inválido' }, 400)
    if (!(await meu.passar('midia', 20, DEZ_MIN))) return json({ erro: 'muitos envios' }, 429, { 'Retry-After': '600' })
    // O documento midias/{id} já foi criado pelo app (as regras conferiram quem pode); aqui só confere que é dele.
    const d = await lerMidia(projeto, v.id, token, fetch, appCheck)
    if (d === null) return json({ erro: 'não foi possível verificar o vídeo' }, 503)
    // 'pronto' também passa: a confirmação pode ter caído depois de o Firestore gravar, e o app repete sem reenviar.
    if (!d || d.autor !== uid || (d.status !== 'enviando' && d.status !== 'pronto') || d.bytes !== v.bytes) return json({ erro: 'sem permissão' }, 403)
    const r = await midia(projeto, v.id).iniciar({ projeto, id: v.id, autor: uid, alunoId: d.alunoId, tipo: d.tipo, bytes: v.bytes, mime: v.mime })
    if (r === 'conflito') return json({ erro: 'vídeo já enviado' }, 409)
    if (r === 'cheio') return json({ erro: 'espaço de vídeos cheio' }, 507)
    await aluno(projeto, d.alunoId).anotarMidia(v.id)
    return json({ ok: true, faltam: r.faltam })
  }

  if (!idOk(corpo?.id)) return json({ erro: 'pedido inválido' }, 400)
  const mid = corpo.id

  // Todas as partes chegaram: marca "pronto" no Firestore (token do autor) e avisa uma vez só.
  if (pathname === '/midia/concluir') {
    const inst = midia(projeto, mid)
    const r = await inst.concluir(uid)
    if (r === 'faltam') return json({ erro: 'faltam partes' }, 409)
    if (r !== 'ok') return json({ erro: 'sem permissão' }, r)
    // Repetir é seguro: se já está 'pronto' (a resposta anterior se perdeu), as regras recusam a escrita e a leitura confirma.
    if (!(await marcarPronto(projeto, mid, token, fetch, appCheck)) && !(await jaPronto(projeto, mid, token, appCheck))) {
      return json({ erro: 'não foi possível confirmar o vídeo' }, 503)
    }
    const m = (await inst.meta())!
    if (await inst.primeiroAviso()) {
      if (m.tipo === 'execucao') {
        const lista = (await coaches(projeto).coaches()).filter((c) => c !== uid)
        await Promise.all(lista.map((c) => aluno(projeto, c).avisar(VIDEO_COACH, 'video', false).catch(() => false)))
      } else {
        await aluno(projeto, m.alunoId).avisar(ORIENTACAO, 'orientacao', false).catch(() => false)
      }
    }
    return json({ ok: true })
  }

  // Link curto para tocar. As regras do Firestore decidem: o aluno dono ou um coach da marca conseguem ler o documento.
  if (pathname === '/midia/link') {
    if (!(await meu.passar('midia-link', 60, 60_000))) return json({ erro: 'muitos pedidos' }, 429, { 'Retry-After': '60' })
    const d = await lerMidia(projeto, mid, token, fetch, appCheck)
    if (d === null) return json({ erro: 'não foi possível verificar o vídeo' }, 503)
    if (!d) return json({ erro: 'sem permissão' }, 403)
    const m = await midia(projeto, mid).meta()
    if (d.status !== 'pronto' || !m?.completo) return json({ erro: 'vídeo indisponível' }, 404)
    const exp = Date.now() + LINK_MS
    const sig = await assinar(await chave(), projeto, mid, exp)
    const ver = new URL('/midia/ver', req.url)
    ver.search = new URLSearchParams({ p: projeto, id: mid, exp: String(exp), sig }).toString()
    return json({ url: ver.toString(), expira: exp })
  }

  // Apagar o arquivo: o autor (cancelar envio) ou um coach. O app apaga o documento depois (regras).
  if (pathname === '/midia/apagar') {
    const d = await lerMidia(projeto, mid, token, fetch, appCheck)
    if (d === null) return json({ erro: 'não foi possível verificar o vídeo' }, 503)
    const pode = d ? podeApagar(d, uid, d.autor !== uid && (await ehCoach(projeto, uid, token, fetch, appCheck))) : 403
    if (pode !== 200) return json({ erro: pode === 409 ? 'vídeo já enviado' : 'sem permissão' }, pode)
    await midia(projeto, mid).apagar()
    return json({ ok: true })
  }

  return json({ erro: 'não encontrado' }, 404)
}
