import { describe, expect, it, vi } from 'vitest'
import { entradaPrescricaoSchema, prepararPrescricao, salvarPrescricao } from './prescricao'
import type { Doc, Firestore } from './firestore'
import { proximoMesoId } from '../../src/lib/proximoMesoId'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { mesoParaDoc } from '../../src/lib/conversores'
import { prescreverSessao } from '../../src/engine/sessao'

const agora = Date.parse('2026-11-15T15:00:00Z')
const documento = { id: 'ciclo', updateTime: '2026-11-15T00:00:00Z', dados: { alunoId: 'aluno', nome: 'Ciclo 1', ...mesoParaDoc({ ...mesoPadrao(), inicio: '2026-11-01' }) } }
const banco = () => ({ doc: vi.fn(async (p: string): Promise<Doc | null> => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno' } } : p === 'mesos/ciclo' ? documento : null), consulta: vi.fn(async () => [documento]), lote: vi.fn(async (caminhos: string[]): Promise<{ caminho: string; doc: Doc | null }[]> => caminhos.map((caminho) => ({ caminho, doc: null }))), gravarMeso: vi.fn(async (_id: string, _dados: Record<string, unknown>, _esperado: string | null, _origem?: { id: string; updateTime: string }) => {}) })

describe('prescrições do conector', () => {
  it('prepara próximo com data do app e grava no ID compartilhado com condição de versão', async () => {
    const fs = banco()
    const p = await prepararPrescricao(fs as unknown as Firestore, { acao: 'proximo', alunoId: 'aluno' }, agora)
    expect(p.dados.inicio).toBe('2026-11-29')
    const id = await proximoMesoId('ciclo')
    expect(await salvarPrescricao(fs as unknown as Firestore, p, 'abc', agora)).toEqual({ mesoId: id })
    expect(fs.gravarMeso).toHaveBeenCalledWith(id, expect.objectContaining({ alunoId: 'aluno', mcpOperacao: 'abc' }), null, { id: 'ciclo', updateTime: documento.updateTime }, undefined)
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
    await expect(prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: { ...m, inicio: '2026-11-02' } }, agora)).rejects.toThrow('offline')
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
  it('não permite reaproveitar a identidade de um exercício arquivado', async () => {
    const fs = banco()
    const antigo = { ...mesoPadrao(), divisao: [[{ slotId: 'arquivado', nome: 'Facepull' }], [], []] }
    const atual = { ...mesoPadrao(), inicio: '2026-11-01' }
    const d = { ...documento, dados: { ...documento.dados, ...mesoParaDoc(atual), prescricoesAnteriores: { '1-1': [{ versao: 1, sessao: prescreverSessao(antigo, 1, 1), metodos: [] }] } } }
    fs.doc.mockImplementation(async (p) => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno' } } : p === 'mesos/ciclo' ? d : null)
    await expect(prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: { ...atual, divisao: [[{ slotId: 'arquivado', nome: 'Supino Reto Barra' }], [], []] } }, agora)).rejects.toThrow('identidade nova')
  })
  it('aceita agenda explícita equivalente aos dias livres para uma sessão registrada', async () => {
    const fs = banco()
    const m = { ...mesoPadrao(), inicio: '2026-11-01' }
    const d = { ...documento, dados: { ...documento.dados, ...mesoParaDoc(m) } }
    fs.doc.mockImplementation(async (p) => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno' } } : p === 'mesos/ciclo' ? d : null)
    fs.lote.mockImplementation(async (caminhos) => caminhos.map((caminho) => ({ caminho, doc: caminho === 'registros/ciclo_s01_t1' ? { id: 'ciclo_s01_t1', updateTime: documento.updateTime, dados: { alunoId: 'aluno', mesoId: 'ciclo', semana: 1, treino: 1 } } : null })))
    await expect(prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', alteracoes: [{ tipo: 'configurar', dias: [0, 2, 4] }] }, agora)).resolves.toBeDefined()
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

describe('métodos em exercícios adicionados', () => {
  const base = { ...mesoPadrao(), inicio: '2026-11-01', divisao: [[{ slotId: 'um', nome: 'Supino Reto Barra' }, { slotId: 'dois', nome: 'Remada Curvada Barra' }], [], []], adicoes: { '1-1': [{ slotId: 'tres', nome: 'Exercício legado próprio' }] }, metodos: [{ ativo: true, semana: 1, treino: 1, exercicio: 3, metodo: 'Dropset' as const, escopo: 'Todas as séries' as const }] }
  const valida = (meso: typeof base) => entradaPrescricaoSchema.safeParse({ acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso })
  it('aceita método em adição da sessão e recusa posição ou semana sem adição', () => {
    expect(valida(base).success).toBe(true)
    const grupo = [{ ...base.metodos[0], metodo: 'Biset' as const, grupo: 1 }, { ...base.metodos[0], metodo: 'Biset' as const, grupo: 1, exercicio: 2 }]
    expect(entradaPrescricaoSchema.safeParse({ acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', meso: { ...base, metodos: grupo } }).success).toBe(true)
    expect(valida({ ...base, metodos: [{ ...base.metodos[0], exercicio: 4 }] }).success).toBe(false)
    expect(valida({ ...base, metodos: [{ ...base.metodos[0], semana: 2 }] }).success).toBe(false)
    expect(valida({ ...base, adicoes: { '1-1': [{ slotId: 'um', nome: 'Supino Reto Barra' }] } }).success).toBe(false)
  })
  it('permite copiar ou renomear prescrição existente com método na adição', async () => {
    const fs = banco()
    const existente = { ...documento, dados: { ...documento.dados, ...mesoParaDoc(base) } }
    fs.consulta.mockResolvedValue([existente])
    fs.doc.mockImplementation(async (p) => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno' } } : p === 'mesos/ciclo' ? existente : null)
    expect((await prepararPrescricao(fs as unknown as Firestore, { acao: 'proximo', alunoId: 'aluno' }, agora)).dados.metodos).toEqual(base.metodos)
    expect((await prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', nome: 'Renomeado' }, agora)).nome).toBe('Renomeado')
  })
})

describe('remoção de exercícios por ID', () => {
  const exemplo = () => {
    const padrao = mesoPadrao()
    return { ...padrao, inicio: '2026-11-01', frequencia: 5, divisao: [
      [{ slotId: 'face1', nome: 'Facepull' }, { slotId: 'sup', nome: 'Supino Reto Barra' }, { slotId: 'rem', nome: 'Remada Curvada Barra' }], [], [], [],
      [{ slotId: 'face5', nome: 'Facepull' }, { slotId: 'perna', nome: 'Agachamento Livre' }],
    ], trocas: { '1-1-2': { slotId: 'troca', nome: 'Supino Inclinado Halteres' } }, metodos: [
      { ativo: true, semana: 1, treino: 1, exercicio: 1, metodo: 'Biset' as const, escopo: 'Todas as séries' as const, grupo: 1 },
      { ativo: true, semana: 1, treino: 1, exercicio: 2, metodo: 'Biset' as const, escopo: 'Todas as séries' as const, grupo: 1 },
      { ativo: true, semana: 1, treino: 1, exercicio: 3, metodo: 'Dropset' as const, escopo: 'Todas as séries' as const },
    ], sessoes: { '1-1': { semana: 1, treino: 1, exercicios: [{ slotId: 'face1', nome: 'Facepull', origemSlotId: 'face1' }], metodos: [] } } }
  }
  const montar = () => {
    const fs = banco()
    const meso = exemplo()
    const d = { ...documento, dados: { ...documento.dados, ...mesoParaDoc(meso), sessoes: meso.sessoes } }
    fs.doc.mockImplementation(async (p) => p === 'usuarios/aluno' ? { id: 'aluno', dados: { papel: 'aluno', nome: 'Ana' } } : p === 'mesos/ciclo' ? d : null)
    return { fs, meso }
  }
  it('remove nos treinos certos, remapeia métodos e trocas e conserva a progressão de sessões presenciais', async () => {
    const { fs, meso } = montar()
    const p = await prepararPrescricao(fs as unknown as Firestore, { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', removerSlotIds: ['face1', 'face5'] }, agora)
    expect(p.remocoes).toEqual([{ slotId: 'face1', nome: 'Facepull', treino: 1, posicao: 1 }, { slotId: 'face5', nome: 'Facepull', treino: 5, posicao: 1 }])
    expect(p.resumo).toContain('Facepull (treino 1); Facepull (treino 5)')
    expect(p.avisos).toHaveLength(3)
    expect(p.dados.divisao).toMatchObject({ t1: [{ slotId: 'sup' }, { slotId: 'rem' }], t5: [{ slotId: 'perna' }] })
    expect(p.dados.metodos).toEqual([expect.objectContaining({ metodo: 'Dropset', exercicio: 2 })])
    expect(p.dados.trocas).toHaveProperty('1-1-1.slotId', 'troca')
    expect(p.dados.progressaoExercicio).toHaveProperty('face1.w1')
    expect(p.dados.progressaoExercicio).toHaveProperty('face5.w1')
    expect(p.antes?.sessoes).toEqual(meso.sessoes)
    expect(p.previaDados?.sessoes).toEqual(meso.sessoes)
    expect(p.dados).not.toHaveProperty('sessoes')
    expect(p.dados).not.toHaveProperty('alunoId')
    await salvarPrescricao(fs as unknown as Firestore, p, 'op-remover', agora)
    expect(fs.gravarMeso.mock.calls[0][2]).toBe(documento.updateTime)
  })
  it('recusa IDs repetidos, antigos ou combinados com outro mesociclo', async () => {
    const { fs, meso } = montar()
    const entrada = { acao: 'editar' as const, alunoId: 'aluno', mesoId: 'ciclo' }
    expect(entradaPrescricaoSchema.safeParse({ ...entrada, removerSlotIds: ['face1', 'face1'] }).success).toBe(false)
    expect(entradaPrescricaoSchema.safeParse({ ...entrada, removerSlotIds: ['face1'], meso }).success).toBe(false)
    expect(entradaPrescricaoSchema.safeParse({ acao: 'criar', alunoId: 'aluno', removerSlotIds: ['face1'] }).success).toBe(false)
    await expect(prepararPrescricao(fs as unknown as Firestore, { ...entrada, removerSlotIds: ['antigo'] }, agora)).rejects.toThrow('não encontrado')
  })
})
