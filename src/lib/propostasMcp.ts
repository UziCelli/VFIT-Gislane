import { useEffect, useState } from 'react'
import { auth } from './firebase'

export const CONECTOR_URL = import.meta.env.VITE_CONECTOR_URL as string | undefined
const EVENTO = 'vfit:propostas-mcp'

export type PropostaPendente = { id: string; nome: string; alunoNome: string; acao: string; resumo: string; expiraEm: string; status: 'proposta' | 'resultado_pendente' }

// Propostas que o assistente (Claude, ChatGPT…) preparou e o coach ainda não salvou.
export async function buscarPendentes(base: string, token: string, buscar: typeof fetch = fetch): Promise<PropostaPendente[]> {
  const r = await buscar(`${base}/prescricao/pendentes`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error('Não foi possível ver as propostas do assistente.')
  const corpo = (await r.json()) as { propostas?: unknown }
  return (Array.isArray(corpo.propostas) ? corpo.propostas : []).filter((p): p is PropostaPendente => !!p && typeof (p as PropostaPendente).id === 'string' && typeof (p as PropostaPendente).nome === 'string')
}

// Pede para o app conferir de novo agora (botão "Verificar agora", depois de salvar uma proposta).
export const atualizarPropostasMcp = () => window.dispatchEvent(new Event(EVENTO))

// Sem consulta periódica (poupa Worker, Firestore e App Check). Confere em poucos momentos:
// ao abrir o app, ao voltar para ele depois de um tempo fora, e quando o coach pede ("Verificar agora").
// Falha de rede mantém a última lista.
const INTERVALO_MINIMO_MS = 30_000
export function usePropostasMcp(ativo: boolean): { lista: PropostaPendente[]; verificando: boolean } {
  const [lista, setLista] = useState<PropostaPendente[]>([])
  const [verificando, setVerificando] = useState(false)
  useEffect(() => {
    if (!ativo || !CONECTOR_URL) return
    let vivo = true
    let ocupado = false
    let ultima = 0
    async function conferir(manual: boolean) {
      if (ocupado || !auth.currentUser) return
      if (!manual && (document.visibilityState !== 'visible' || Date.now() - ultima < INTERVALO_MINIMO_MS)) return
      ocupado = true
      ultima = Date.now()
      if (vivo) setVerificando(true)
      try {
        const token = await auth.currentUser.getIdToken()
        const novas = await buscarPendentes(CONECTOR_URL!, token)
        if (vivo) setLista((antes) => (JSON.stringify(antes) === JSON.stringify(novas) ? antes : novas))
      } catch { /* mantém a lista anterior */ } finally { ocupado = false; if (vivo) setVerificando(false) }
    }
    void conferir(true)
    const voltou = () => void conferir(false)
    const pedido = () => void conferir(true)
    document.addEventListener('visibilitychange', voltou)
    window.addEventListener('online', voltou)
    window.addEventListener(EVENTO, pedido)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', voltou)
      window.removeEventListener('online', voltou)
      window.removeEventListener(EVENTO, pedido)
    }
  }, [ativo])
  return { lista, verificando }
}
