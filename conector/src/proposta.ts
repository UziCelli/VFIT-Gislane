import { DurableObject } from 'cloudflare:workers'
import { proximoMesoId } from '../../src/lib/proximoMesoId'
import { ErroPrescricaoRecusada, Firestore } from './firestore'
import { salvarPrescricao, type PropostaPrescricao } from './prescricao'

const VALIDADE_MS = 15 * 60 * 1000
const RETENCAO_MS = 24 * 60 * 60 * 1000
export type ResultadoProposta = { status: 'proposta'; proposta: PropostaPrescricao } | { status: 'expirada' } | { status: 'resultado_pendente' } | { status: 'recusada'; mensagem: string } | { status: 'salva'; resultado: { mesoId: string } }
type Registro = { id: string; uid: string; expira: number; resultado: ResultadoProposta; tentativa?: PropostaPrescricao }

// Uma instância por proposta. Credenciais do navegador só vivem durante confirmar.
export class PropostaTreino extends DurableObject {
  private fila: Promise<void> = Promise.resolve()
  private serializar<T>(acao: () => Promise<T>): Promise<T> {
    const resultado = this.fila.then(acao)
    this.fila = resultado.then(() => undefined, () => undefined)
    return resultado
  }

  async guardar(id: string, uid: string, proposta: PropostaPrescricao, agora: number): Promise<void> {
    return this.serializar(async () => {
      await this.ctx.storage.transaction(async (tx) => {
        if (await tx.get('registro')) throw new Error('Proposta já existe.')
        await tx.put('registro', { id, uid, expira: agora + VALIDADE_MS, resultado: { status: 'proposta', proposta } } satisfies Registro)
        await tx.setAlarm(agora + VALIDADE_MS)
      })
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

  async ler(uid: string, _agora: number): Promise<ResultadoProposta | null> {
    return this.serializar(async () => (await this.registro(uid, Date.now()))?.resultado ?? null)
  }

  async confirmar(uid: string, idToken: string, projeto: string, appCheck: string | undefined, _agora: number): Promise<ResultadoProposta | null> {
    return this.serializar(async () => {
      const agora = Date.now()
      const registro = await this.registro(uid, agora)
      if (!registro) return null
      if (registro.resultado.status === 'salva' || registro.resultado.status === 'expirada' || registro.resultado.status === 'recusada') return registro.resultado
      const fs = new Firestore(projeto, idToken, fetch, appCheck)
      if (registro.resultado.status === 'resultado_pendente') {
        // Depois de uma resposta perdida só consultamos o marcador, nunca repetimos a escrita.
        const proposta = registro.tentativa
        if (!proposta) return registro.resultado
        const mesoId = proposta.mesoId ?? (proposta.acao === 'proximo' && proposta.origem ? await proximoMesoId(proposta.origem.id) : `mcp_${registro.id}`)
        try {
          const doc = await fs.doc(`mesos/${mesoId}`)
          if (doc?.dados.mcpOperacao !== registro.id) return registro.resultado
        } catch { return registro.resultado }
        registro.resultado = { status: 'salva', resultado: { mesoId } }
      } else {
        const proposta = registro.resultado.proposta
        // Persistir a intenção antes da chamada externa: queda ou resposta perdida é ambígua.
        registro.tentativa = proposta
        registro.resultado = { status: 'resultado_pendente' }
        await this.ctx.storage.transaction(async (tx) => {
          await tx.put('registro', registro)
          await tx.setAlarm(agora + RETENCAO_MS)
        })
        try {
          const resultado = await salvarPrescricao(fs, proposta, registro.id, agora)
          registro.resultado = { status: 'salva', resultado }
        } catch (erro) {
          if (!(erro instanceof ErroPrescricaoRecusada)) return registro.resultado
          registro.resultado = { status: 'recusada', mensagem: 'O treino não foi salvo porque mudou. Prepare uma nova proposta.' }
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
