import { DurableObject } from 'cloudflare:workers'

// Uma instância por pedido OAuth; nunca compartilha armazenamento com notificações.
export class PedidoOAuth extends DurableObject {
  async guardarPedido(valor: string, expiracao: number): Promise<void> {
    await this.ctx.storage.put('pedido', valor)
    await this.ctx.storage.setAlarm(expiracao)
  }
  async lerPedido(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('pedido')) ?? null
  }
  async consumirPedido(): Promise<string | null> {
    return this.ctx.storage.transaction(async (tx) => {
      const valor = (await tx.get<string>('pedido')) ?? null
      if (valor !== null) await tx.delete('pedido')
      return valor
    })
  }
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
