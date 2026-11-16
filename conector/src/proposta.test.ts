import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ DurableObject: class { ctx: unknown; constructor(ctx: unknown) { this.ctx = ctx } } }))
vi.mock('./prescricao', () => ({ salvarPrescricao: vi.fn(async () => ({ mesoId: 'meso' })) }))
import { PropostaTreino } from './proposta'
import { salvarPrescricao, type PropostaPrescricao } from './prescricao'
import { ErroPrescricaoRecusada, Firestore } from './firestore'
import { proximoMesoId } from '../../src/lib/proximoMesoId'

const proposta = { acao: 'criar', alunoId: 'aluno', nome: 'Treino', resumo: 'Resumo', dados: {}, criadaEm: 1000 } as PropostaPrescricao
function criar() {
  const mapa = new Map<string, unknown>()
  const storage = {
    get: async (k: string) => structuredClone(mapa.get(k)),
    put: async (k: string, v: unknown) => { mapa.set(k, structuredClone(v)) },
    setAlarm: vi.fn(async () => {}),
    deleteAll: async () => { mapa.clear() },
    transaction: async (fn: (tx: { get: (k: string) => Promise<unknown>; put: (k: string, v: unknown) => Promise<void>; setAlarm: () => Promise<void> }) => Promise<void>) => {
      const copia = new Map(mapa)
      try { await fn(storage) } catch (e) { mapa.clear(); copia.forEach((v, k) => mapa.set(k, v)); throw e }
    },
  }
  const instancia = new PropostaTreino({ storage } as never, {} as never)
  return { instancia, mapa, storage }
}

describe('propostas pendentes', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Date, 'now').mockReturnValue(1001) })
  afterEach(() => vi.restoreAllMocks())
  it('isola o proprietário, expira e remove o conteúdo privado', async () => {
    const { instancia, mapa } = criar()
    await instancia.guardar('id', 'coach', proposta, 1000)
    expect(await instancia.ler('outro', 1001)).toBeNull()
    expect(await instancia.confirmar('outro', 'token', 'projeto', undefined, 1001)).toBeNull()
    expect(await instancia.ler('coach', 1001)).toEqual({ status: 'proposta', proposta })
    vi.mocked(Date.now).mockReturnValue(901000)
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'expirada' })
    expect(JSON.stringify([...mapa.values()])).not.toContain('Treino')
    expect(salvarPrescricao).not.toHaveBeenCalled()
  })
  it('serializa confirmações e nunca guarda o token', async () => {
    const { instancia, mapa } = criar()
    await instancia.guardar('id', 'coach', proposta, 1000)
    const respostas = await Promise.all([instancia.confirmar('coach', 'token-secreto', 'projeto', undefined, 1001), instancia.confirmar('coach', 'token-secreto', 'projeto', undefined, 1001)])
    expect(respostas).toEqual([{ status: 'salva', resultado: { mesoId: 'meso' } }, { status: 'salva', resultado: { mesoId: 'meso' } }])
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
    expect(JSON.stringify([...mapa.values()])).not.toContain('token-secreto')
  })
  it('não guarda conteúdo quando falha ao agendar o alarme', async () => {
    const { instancia, mapa, storage } = criar()
    storage.setAlarm.mockRejectedValueOnce(new Error('alarme indisponível'))
    await expect(instancia.guardar('id', 'coach', proposta, 1000)).rejects.toThrow()
    expect(mapa.size).toBe(0)
  })
  it('confere a hora depois da espera na fila', async () => {
    const { instancia } = criar()
    await instancia.guardar('id', 'coach', proposta, 1000)
    let liberar!: () => void
    const espera = new Promise<void>((resolve) => { liberar = resolve })
    vi.mocked(salvarPrescricao).mockImplementationOnce(async () => { await espera; throw new Error('falha') })
    const primeira = instancia.confirmar('coach', 'token', 'projeto', undefined, 1001).catch(() => null)
    await vi.waitFor(() => expect(salvarPrescricao).toHaveBeenCalledTimes(1))
    vi.spyOn(Firestore.prototype, 'doc').mockResolvedValue(null)
    const segunda = instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)
    vi.mocked(Date.now).mockReturnValue(901000)
    liberar()
    await primeira
    expect(await segunda).toEqual({ status: 'resultado_pendente' })
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
  })

  it('reconcilia resposta perdida após o prazo sem gravar novamente', async () => {
    const { instancia } = criar()
    await instancia.guardar('op', 'coach', proposta, 1000)
    vi.mocked(salvarPrescricao).mockRejectedValueOnce(new Error('resposta perdida'))
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'resultado_pendente' })
    vi.mocked(Date.now).mockReturnValue(901000)
    const doc = vi.spyOn(Firestore.prototype, 'doc').mockResolvedValue({ id: 'mcp_op', dados: { mcpOperacao: 'op' } })
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'salva', resultado: { mesoId: 'mcp_op' } })
    expect(doc).toHaveBeenCalledWith('mesos/mcp_op')
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
  })

  it('informa recusa definitiva e remove a proposta privada', async () => {
    const { instancia, mapa } = criar()
    await instancia.guardar('op', 'coach', proposta, 1000)
    vi.mocked(salvarPrescricao).mockRejectedValueOnce(new ErroPrescricaoRecusada('versão mudou'))
    const esperado = { status: 'recusada', mensagem: 'O treino não foi salvo porque mudou. Prepare uma nova proposta.' }
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual(esperado)
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual(esperado)
    expect(JSON.stringify([...mapa.values()])).not.toContain('Treino')
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
  })

  it('não deixa recusa explícita 403 permanentemente pendente', async () => {
    const { instancia } = criar()
    await instancia.guardar('op', 'coach', proposta, 1000)
    vi.mocked(salvarPrescricao).mockRejectedValueOnce(new ErroPrescricaoRecusada('O Firebase recusou a gravação.', 'FIRESTORE_403'))
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'recusada', mensagem: 'O Firebase recusou a gravação.' })
  })

  it('reconcilia pelo recibo mesmo depois de outra edição do mesociclo', async () => {
    const { instancia } = criar()
    await instancia.guardar('op', 'coach', { ...proposta, condicoes: [] }, 1000)
    vi.mocked(salvarPrescricao).mockRejectedValueOnce(new Error('resposta perdida'))
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'resultado_pendente' })
    const doc = vi.spyOn(Firestore.prototype, 'doc').mockResolvedValue({ id: 'op', dados: { uid: 'coach', mesoId: 'mcp_op' } })
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'salva', resultado: { mesoId: 'mcp_op' } })
    expect(doc).toHaveBeenCalledWith('mcpOperacoes/op')
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
  })

  it('reconcilia próximo ciclo pelo mesmo identificador derivado do app', async () => {
    const { instancia } = criar()
    await instancia.guardar('op', 'coach', { ...proposta, acao: 'proximo', origem: { id: 'origem', updateTime: 'versao' } }, 1000)
    vi.mocked(salvarPrescricao).mockRejectedValueOnce(new Error('resposta perdida'))
    await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)
    const id = await proximoMesoId('origem')
    const doc = vi.spyOn(Firestore.prototype, 'doc').mockResolvedValue({ id, dados: { mcpOperacao: 'op' } })
    expect(await instancia.confirmar('coach', 'token', 'projeto', undefined, 1001)).toEqual({ status: 'salva', resultado: { mesoId: id } })
    expect(doc).toHaveBeenCalledWith(`mesos/${id}`)
    expect(salvarPrescricao).toHaveBeenCalledTimes(1)
  })

})
