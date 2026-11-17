import { describe, expect, it, vi } from 'vitest'
import { buscarPendentes } from './propostasMcp'

const resposta = (corpo: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => corpo }) as Response) as unknown as typeof fetch

describe('buscarPendentes', () => {
  it('envia o login do coach e devolve só propostas bem formadas', async () => {
    const buscar = resposta({ propostas: [{ id: 'a', nome: 'Treino', alunoNome: 'Ana', acao: 'criar', resumo: 'r', expiraEm: 'x', status: 'proposta' }, { nome: 'sem id' }, null] })
    const lista = await buscarPendentes('https://c.exemplo', 'tok', buscar)
    expect(lista.map((p) => p.id)).toEqual(['a'])
    expect(buscar).toHaveBeenCalledWith('https://c.exemplo/prescricao/pendentes', { headers: { Authorization: 'Bearer tok' } })
  })
  it('resposta sem lista vira lista vazia e erro do servidor é erro', async () => {
    expect(await buscarPendentes('https://c.exemplo', 't', resposta({}))).toEqual([])
    await expect(buscarPendentes('https://c.exemplo', 't', resposta({ erro: 'x' }, false))).rejects.toThrow()
  })
})
