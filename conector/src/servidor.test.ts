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
})
