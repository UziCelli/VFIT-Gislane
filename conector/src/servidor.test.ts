import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { describe, expect, it } from 'vitest'
import { criarServidor } from './servidor'

describe('lista de ferramentas MCP', () => {
  it('anuncia as quatro ferramentas como leitura, sem ação destrutiva e com acesso externo', async () => {
    const servidor = criarServidor(async () => { throw new Error('A listagem não deve executar ferramentas') })
    const cliente = new Client({ name: 'teste', version: '1.0.0' })
    const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair()
    await servidor.connect(transporteServidor)
    await cliente.connect(transporteCliente)
    try {
      const { tools } = await cliente.listTools()
      expect(tools.map((f) => f.name).sort()).toEqual(['catalogo_exercicios', 'listar_alunos', 'ver_aluno', 'ver_mesos'])
      for (const ferramenta of tools) {
        expect(ferramenta.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: true })
      }
    } finally {
      await cliente.close()
      await servidor.close()
    }
  })
  it('anuncia preparação com confirmação no app e consulta separada', async () => {
    const resposta = { content: [{ type: 'text' as const, text: 'ok' }] }
    const chamadas: string[] = []
    const servidor = criarServidor(async () => resposta, {
      preparar: async () => { chamadas.push('preparar'); return resposta },
      consultar: async (id) => { chamadas.push(id); return resposta },
    })
    const cliente = new Client({ name: 'teste', version: '1.0.0' })
    const [c, s] = InMemoryTransport.createLinkedPair()
    await servidor.connect(s)
    await cliente.connect(c)
    try {
      const { tools } = await cliente.listTools()
      const preparar = tools.find((f) => f.name === 'preparar_treino')!
      expect(preparar.description).toContain('confirmar no app')
      expect(preparar.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false })
      expect(tools.find((f) => f.name === 'consultar_proposta')?.annotations?.readOnlyHint).toBe(true)
      await cliente.callTool({ name: 'preparar_treino', arguments: { acao: 'criar', alunoId: 'aluno' } })
      const id = '123e4567-e89b-42d3-a456-426614174000'
      await cliente.callTool({ name: 'consultar_proposta', arguments: { id } })
      expect(chamadas).toEqual(['preparar', id])
    } finally {
      await cliente.close()
      await servidor.close()
    }
  })

})
