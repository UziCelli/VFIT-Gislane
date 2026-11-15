import { describe, expect, it, vi } from 'vitest'
import { entradaPrescricaoSchema, prepararPrescricao, salvarPrescricao } from './prescricao'
import type { Doc, Firestore } from './firestore'
import { proximoMesoId } from '../../src/lib/proximoMesoId'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { mesoParaDoc } from '../../src/lib/conversores'

const agora = Date.parse('2026-11-15T15:00:00Z')
const documento = { id: 'ciclo', updateTime: '2026-11-15T00:00:00Z', dados: { alunoId: 'aluno', nome: 'Ciclo 1', ...mesoParaDoc({ ...mesoPadrao(), inicio: '2026-11-01' }) } }
const banco = () => ({ doc: vi.fn(async (p: string): Promise<Doc | null> => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno' } } : p === 'mesos/ciclo' ? documento : null), consulta: vi.fn(async () => [documento]), gravarMeso: vi.fn(async (_id: string, _dados: Record<string, unknown>, _esperado: string | null, _origem?: { id: string; updateTime: string }) => {}) })

describe('prescrições do conector', () => {
  it('prepara próximo com data do app e grava no ID compartilhado com condição de versão', async () => {
    const fs = banco()
    const p = await prepararPrescricao(fs as unknown as Firestore, { acao: 'proximo', alunoId: 'aluno' }, agora)
    expect(p.dados.inicio).toBe('2026-11-29')
    const id = await proximoMesoId('ciclo')
    expect(await salvarPrescricao(fs as unknown as Firestore, p, 'abc', agora)).toEqual({ mesoId: id })
    expect(fs.gravarMeso).toHaveBeenCalledWith(id, expect.objectContaining({ alunoId: 'aluno', mcpOperacao: 'abc' }), null, { id: 'ciclo', updateTime: documento.updateTime })
  })
  it('edição protege divisão e não envia sessões ou alunoId', async () => {
    const fs = banco()
    const m = { ...mesoPadrao(), inicio: '2026-11-01', pausaS: 45 }
    const p = await prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: m }, agora)
    await salvarPrescricao(fs as unknown as Firestore, p, 'alteracao', agora)
    const dados = fs.gravarMeso.mock.calls[0][1] as Record<string, unknown>
    expect(dados).not.toHaveProperty('alunoId')
    expect(dados).not.toHaveProperty('sessoes')
    expect(fs.gravarMeso.mock.calls[0][2]).toBe(documento.updateTime)
    await expect(prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: { ...m, inicio: '2026-11-02' } }, agora)).rejects.toThrow('proteger o histórico')
  })
  it('recusa dados inesperados e retorna resultado idempotente', async () => {
    expect(entradaPrescricaoSchema.safeParse({ acao: 'criar', alunoId: 'aluno', cargas: {} }).success).toBe(false)
    const fs = banco()
    const p = await prepararPrescricao(fs as unknown as Firestore, { acao: 'criar', alunoId: 'aluno' }, agora)
    fs.doc.mockImplementation(async (path) => path === 'mesos/mcp_abc' ? { id: 'mcp_abc', dados: { mcpOperacao: 'abc' } } : null)
    expect(await salvarPrescricao(fs as unknown as Firestore, p, 'abc', agora)).toEqual({ mesoId: 'mcp_abc' })
    expect(fs.gravarMeso).not.toHaveBeenCalled()
  })
})

describe('identidade das cargas', () => {
  const base = { ...mesoPadrao(), divisao: [[{ slotId: 'sup', nome: 'Supino Reto Barra' }, { slotId: 'rem', nome: 'Remada Curvada Barra' }], [], []] }
  it('recusa IDs repetidos em troca ou adição e nomes diferentes para o mesmo ID', () => {
    const entrada = (meso: typeof base) => JSON.stringify(entradaPrescricaoSchema.safeParse({ acao: 'criar', alunoId: 'aluno', meso }))
    expect(entrada({ ...base, trocas: { '1-1-2': { slotId: 'sup', nome: 'Supino Reto Barra' } } })).toContain('slotId')
    expect(entrada({ ...base, adicoes: { '1-1': [{ slotId: 'sup', nome: 'Supino Reto Barra' }] } })).toContain('slotId')
    expect(entrada({ ...base, trocas: { '1-1-1': { slotId: 'sup', nome: 'Remada Curvada Barra' } } })).toContain('slotId')
  })
})

describe('preparação de cópias', () => {
  it('aceita mesociclo vazio padrão e exercício legado não catalogado em cópia', async () => {
    const fs = banco()
    const novo = await prepararPrescricao(fs as unknown as Firestore, { acao: 'criar', alunoId: 'aluno' }, agora)
    expect(novo.dados.divisao).toEqual({ t1: [], t2: [], t3: [] })
    const legado = { ...documento, dados: { ...documento.dados, ...mesoParaDoc({ ...mesoPadrao(), inicio: '2026-11-01', divisao: [[{ slotId: 'legado', nome: 'Exercício legado próprio' }], [], []] }) } }
    fs.consulta.mockResolvedValue([legado])
    const proximo = await prepararPrescricao(fs as unknown as Firestore, { acao: 'proximo', alunoId: 'aluno' }, agora)
    expect(proximo.dados.divisao).toEqual({ t1: [{ slotId: 'legado', nome: 'Exercício legado próprio' }], t2: [], t3: [] })
  })
})
