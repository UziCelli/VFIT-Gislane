import { DurableObject } from 'cloudflare:workers'
import { proximoMesoId } from '../../src/lib/proximoMesoId'
import { ErroConector, ErroPrescricaoRecusada, Firestore } from './firestore'
import { salvarPrescricao, type PropostaPrescricao } from './prescricao'

const VALIDADE_MS = 24 * 60 * 60 * 1000
const RETENCAO_MS = 24 * 60 * 60 * 1000
export type ResultadoProposta = { status: 'proposta'; proposta: PropostaPrescricao } | { status: 'expirada' } | { status: 'resultado_pendente' } | { status: 'recusada'; mensagem: string } | { status: 'salva'; resultado: { mesoId: string } }
type Registro = { id: string; uid: string; expira: number; resultado: ResultadoProposta; tentativa?: PropostaPrescricao; tentativaEm?: number }
// Sem comprovante depois deste prazo, o commit perdido não existe mais: a proposta não foi salva.
const PRAZO_COMPROVANTE_MS = 10 * 60 * 1000

// Uma instância por proposta. Credenciais do navegador só vivem durante confirmar.
export class PropostaTreino extends DurableObject {
  async saude() { await this.ctx.storage.get('registro'); return { armazenamento: 'disponivel' as const } }
  private fila: Promise<void> = Promise.resolve()
  private serializar<T>(acao: () => Promise<T>): Promise<T> {
    const resultado = this.fila.then(acao)
    this.fila = resultado.then(() => undefined, () => undefined)
    return resultado
  }

  async guardar(id: string, uid: string, proposta: PropostaPrescricao, agora: number): Promise<number> {
    if (new TextEncoder().encode(JSON.stringify(proposta)).byteLength > 1_800_000) throw new ErroConector('A proposta excede o limite seguro de armazenamento. Prepare um próximo ciclo.', 'TAMANHO', 'armazenamento', false)
    return this.serializar(async () => {
      await this.ctx.storage.transaction(async (tx) => {
        if (await tx.get('registro')) throw new Error('Proposta já existe.')
        await tx.put('registro', { id, uid, expira: agora + VALIDADE_MS, resultado: { status: 'proposta', proposta } } satisfies Registro)
        await tx.setAlarm(agora + VALIDADE_MS)
      })
      return agora + VALIDADE_MS
    })
  }

  private async registro(uid: string, agora: number): Promise<Registro | null> {
    const registro = await this.ctx.storage.get<Registro>('registro')
    if (!registro || registro.uid !== uid) return null
    if (registro.resultado.status === 'proposta' && agora >= registro.expira) {
      registro.resultado = { status: 'expirada' }
      await this.ctx.storage.transaction(async (tx) => {
        await tx.put('registro', registro)
        await tx.setAlarm(agora + RETENCAO_MS)
      })
    }
    return registro
  }

  private persistir(registro: Registro, agora: number) {
    return this.ctx.storage.transaction(async (tx) => {
      await tx.put('registro', registro)
      await tx.setAlarm(agora + RETENCAO_MS)
    })
  }

  // Leitura bem-sucedida sem comprovante: passado o prazo, o commit perdido não vai mais aparecer.
  private async semComprovante(registro: Registro, ausente: boolean, agora: number): Promise<ResultadoProposta> {
    if (!ausente || agora - (registro.tentativaEm ?? agora) < PRAZO_COMPROVANTE_MS) return registro.resultado
    registro.resultado = { status: 'recusada', mensagem: 'Não encontrei o treino salvo. Confira no app e prepare uma nova proposta se necessário.' }
    delete registro.tentativa
    await this.persistir(registro, agora)
    return registro.resultado
  }

  async ler(uid: string, _agora: number): Promise<ResultadoProposta | null> {
    return this.serializar(async () => (await this.registro(uid, Date.now()))?.resultado ?? null)
  }

  async consultar(uid: string, idToken: string, projeto: string, appCheck: string | undefined, agora: number): Promise<ResultadoProposta | null> {
    return this.confirmar(uid, idToken, projeto, appCheck, agora, true)
  }

  async confirmar(uid: string, idToken: string, projeto: string, appCheck: string | undefined, _agora: number, somenteConsulta = false): Promise<ResultadoProposta | null> {
    return this.serializar(async () => {
      const agora = Date.now()
      const registro = await this.registro(uid, agora)
      if (!registro) return null
      if (somenteConsulta && registro.resultado.status === 'proposta') return registro.resultado
      if (registro.resultado.status === 'salva' || registro.resultado.status === 'expirada' || registro.resultado.status === 'recusada') return registro.resultado
      const fs = new Firestore(projeto, idToken, fetch, appCheck)
      if (registro.resultado.status === 'resultado_pendente') {
        // Depois de uma resposta perdida só consultamos o marcador, nunca repetimos a escrita.
        const proposta = registro.tentativa
        if (!proposta) return registro.resultado
        const mesoId = proposta.mesoId ?? (proposta.acao === 'proximo' && proposta.origem ? await proximoMesoId(proposta.origem.id) : `mcp_${registro.id}`)
        try {
          // Recibo independente do mesociclo: outra edição pode substituir mcpOperacao.
          if (proposta.condicoes) {
            const recibo = await fs.doc(`mcpOperacoes/${registro.id}`)
            if (recibo?.dados.uid !== uid || recibo.dados.mesoId !== mesoId) return await this.semComprovante(registro, !recibo, agora)
          } else {
            const doc = await fs.doc(`mesos/${mesoId}`)
            if (doc?.dados.mcpOperacao !== registro.id) return await this.semComprovante(registro, !doc, agora)
          }
        } catch { return registro.resultado }
        registro.resultado = { status: 'salva', resultado: { mesoId } }
      } else {
        const proposta = registro.resultado.proposta
        let commitIniciado = false
        try {
          // Só depois da última leitura, e imediatamente antes do commit, a intenção vira "pendente" (resposta perdida é ambígua).
          const resultado = await salvarPrescricao(fs, proposta, registro.id, agora, uid, async () => {
            registro.tentativa = proposta
            registro.tentativaEm = agora
            registro.resultado = { status: 'resultado_pendente' }
            commitIniciado = true
            await this.persistir(registro, agora)
          })
          registro.resultado = { status: 'salva', resultado }
        } catch (erro) {
          if (commitIniciado) {
            // O commit começou: só uma recusa explícita do servidor prova que nada foi gravado.
            if (!(erro instanceof ErroPrescricaoRecusada)) return registro.resultado
            registro.resultado = { status: 'recusada', mensagem: erro.codigo === 'GRAVACAO_RECUSADA' ? 'O treino não foi salvo porque mudou. Prepare uma nova proposta.' : erro.message }
          } else if (erro instanceof ErroPrescricaoRecusada) {
            registro.resultado = { status: 'recusada', mensagem: erro.message }
          } else {
            // Falha antes do commit: nada foi gravado e a proposta continua válida para tentar de novo.
            throw erro instanceof ErroConector ? erro : new ErroConector('Não consegui salvar agora. Nada foi alterado; tente de novo.', 'TEMPORARIO', 'confirmacao', true)
          }
        }
      }
      delete registro.tentativa
      await this.ctx.storage.transaction(async (tx) => {
        await tx.put('registro', registro)
        await tx.setAlarm(agora + RETENCAO_MS)
      })
      return registro.resultado
    })
  }

  async alarm(): Promise<void> {
    await this.serializar(async () => {
      const registro = await this.ctx.storage.get<Registro>('registro')
      if (!registro) return
      if (registro.resultado.status === 'proposta') {
        registro.resultado = { status: 'expirada' }
        await this.ctx.storage.transaction(async (tx) => {
          await tx.put('registro', registro)
          await tx.setAlarm(Date.now() + RETENCAO_MS)
        })
      } else await this.ctx.storage.deleteAll()
    })
  }
}
