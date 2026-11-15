import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { describe, expect, it } from 'vitest'
import { criarServidor } from './servidor'
import { executar } from './execucao'
import { prepararPrescricao } from './prescricao'
import { paraRest } from './rest'
import { mesoParaDoc } from '../../src/lib/conversores'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { salvarLinha, type Meso } from '../../src/engine'

const mesoBiset = (): Meso => {
  const m = mesoPadrao()
  m.divisao[0] = ['Facepull', 'Supino Reto Barra', 'Remada Curvada Barra', 'Agachamento Livre', 'Leg Press'].map((nome, i) => ({ slotId: `id${i}`, nome }))
  const biset = { ativo: true, semana: 1, treino: 1, exercicio: 4, metodo: 'Biset' as const, escopo: 'Todas as séries' as const, grupo: 10 }
  // O próprio editor usa max(grupo) + 1, portanto gera 11 após uma sequência de edições.
  m.metodos = salvarLinha([biset, { ...biset, exercicio: 5 }], { treino: 1, pos: 2, metodo: 'Biset', semanas: [1], modelo: [{ ...biset, exercicio: 2 }], parceiros: [3] })
  return m
}

async function chamada(m: Meso) {
  const fields = (x: object) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, paraRest(v)]))
  const meso = { alunoId: 'aluno', nome: 'Ciclo', ...mesoParaDoc(m) }
  let propostaGravada = false
  const buscar: typeof fetch = async (input) => {
    const u = String(input)
    if (u.includes('securetoken')) return Response.json({ id_token: 'falso' })
    if (u.endsWith('/usuarios/aluno')) return Response.json({ name: 'usuarios/aluno', fields: fields({ papel: 'aluno' }) })
    if (u.endsWith('/mesos/ciclo')) return Response.json({ name: 'mesos/ciclo', updateTime: '2026-11-15T00:00:00Z', fields: fields(meso) })
    if (u.endsWith(':runQuery')) return Response.json([{ document: { name: 'mesos/ciclo', updateTime: '2026-11-15T00:00:00Z', fields: fields(meso) } }])
    throw new Error('URL inesperada')
  }
  const cfg = { refreshToken: 'falso', apiKey: 'falso', projeto: 'falso', buscar }
  const servidor = criarServidor((f) => executar(cfg, f), { preparar: (entrada) => executar(cfg, async (fs) => {
    const proposta = await prepararPrescricao(fs, entrada, Date.now())
    propostaGravada = true
    return proposta
  }), consultar: async () => ({ content: [{ type: 'text', text: '' }] }) })
  const cliente = new Client({ name: 'teste', version: '1' })
  const [c, s] = InMemoryTransport.createLinkedPair()
  await servidor.connect(s)
  await cliente.connect(c)
  try {
    const resposta = await cliente.callTool({ name: 'preparar_treino', arguments: { acao: 'editar', alunoId: 'aluno', mesoId: 'ciclo', removerSlotIds: ['id0'] } })
    return { resposta, propostaGravada }
  } finally { await cliente.close(); await servidor.close() }
}

describe('prescrição pela ferramenta MCP', () => {
  it('remove exercício e preserva Biset com grupo 11 gerado pelo editor', async () => {
    const m = mesoBiset()
    expect(m.metodos.some((x) => x.grupo === 11)).toBe(true)
    const { resposta, propostaGravada } = await chamada(m)
    expect(resposta.isError).not.toBe(true)
    expect(propostaGravada).toBe(true)
    const texto = JSON.stringify(resposta)
    expect(texto).toContain('Facepull')
    const conteudo = resposta.content as { text: string }[]
    const p = JSON.parse(conteudo[0].text)
    expect(p.dados.metodos.filter((x: { grupo?: number }) => x.grupo === 11)).toHaveLength(2)
  })
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('recusa grupo inválido sem revelar dados (%s)', async (grupo) => {
    const m = mesoBiset()
    for (const metodo of m.metodos) if (metodo.grupo === 11) metodo.grupo = grupo
    const { resposta, propostaGravada } = await chamada(m)
    expect(propostaGravada).toBe(false)
    expect(resposta.isError).toBe(true)
    expect(resposta.content).toEqual([{ type: 'text', text: 'Não foi possível preparar: confira métodos do mesociclo no app.' }])
  })
})
