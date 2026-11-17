import { describe, expect, it } from 'vitest'
import { pendentesDoCoach } from './pendentes'
import type { ItemIndice } from './proposta'
import type { ResultadoProposta } from './proposta'

const item = (id: string): ItemIndice => ({ id, nome: `Treino ${id}`, alunoNome: 'Ana', acao: 'criar', resumo: 'Resumo', expira: 1_000_000 })
const proposta = { status: 'proposta', proposta: { dados: { segredo: true } } } as unknown as ResultadoProposta

describe('propostas pendentes do coach', () => {
  it('lista proposta e resultado pendente na ordem do índice, sem expor o treino', async () => {
    const r: Record<string, ResultadoProposta | null> = { a: proposta, b: { status: 'resultado_pendente' } }
    const { visiveis, descartar } = await pendentesDoCoach([item('a'), item('b')], async (id) => r[id])
    expect(visiveis.map((v) => [v.id, v.status])).toEqual([['a', 'proposta'], ['b', 'resultado_pendente']])
    expect(visiveis[0]).toEqual({ id: 'a', nome: 'Treino a', alunoNome: 'Ana', acao: 'criar', resumo: 'Resumo', expiraEm: '1970-01-01T00:16:40.000Z', status: 'proposta' })
    expect(JSON.stringify(visiveis)).not.toContain('segredo')
    expect(descartar).toEqual([])
  })
  it('descarta salva, vencida, recusada e inexistente', async () => {
    const r: Record<string, ResultadoProposta | null> = { s: { status: 'salva', resultado: { mesoId: 'x' } }, e: { status: 'expirada' }, c: { status: 'recusada', mensagem: 'm' }, n: null }
    const { visiveis, descartar } = await pendentesDoCoach(['s', 'e', 'c', 'n'].map(item), async (id) => r[id])
    expect(visiveis).toEqual([])
    expect(descartar.sort()).toEqual(['c', 'e', 'n', 's'])
  })
  it('falha ao consultar uma proposta não a descarta nem derruba a lista', async () => {
    const { visiveis, descartar } = await pendentesDoCoach([item('a'), item('b')], async (id) => { if (id === 'a') throw new Error('x'); return proposta })
    expect(visiveis.map((v) => v.id)).toEqual(['b'])
    expect(descartar).toEqual([])
  })
})
