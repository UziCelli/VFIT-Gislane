import type { ItemIndice } from './proposta'
import type { ResultadoProposta } from './proposta'

export type PropostaPendente = { id: string; nome: string; alunoNome: string; acao: string; resumo: string; expiraEm: string; status: 'proposta' | 'resultado_pendente' }

// Só o que o coach ainda precisa ver: proposta esperando aprovação ou gravação sem confirmação.
// Salva, recusada ou vencida saem da lista (e do índice). Falha ao consultar uma proposta não a descarta.
export async function pendentesDoCoach(itens: ItemIndice[], ler: (id: string) => Promise<ResultadoProposta | null>) {
  const visiveis: PropostaPendente[] = []
  const descartar: string[] = []
  await Promise.all(itens.map(async (i) => {
    let r: ResultadoProposta | null
    try { r = await ler(i.id) } catch { return }
    if (r?.status === 'proposta' || r?.status === 'resultado_pendente') visiveis.push({ id: i.id, nome: i.nome, alunoNome: i.alunoNome, acao: i.acao, resumo: i.resumo, expiraEm: new Date(i.expira).toISOString(), status: r.status })
    else descartar.push(i.id)
  }))
  const ordem = new Map(itens.map((i, n) => [i.id, n]))
  visiveis.sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!)
  return { visiveis, descartar }
}
