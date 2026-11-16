import { useEffect, useState } from 'react'
import { auth } from './firebase'

export const CONECTOR_URL = import.meta.env.VITE_CONECTOR_URL as string | undefined
const EVENTO = 'vfit:propostas-mcp'
const INTERVALO_MS = 15_000

export type PropostaPendente = { id: string; nome: string; alunoNome: string; acao: string; resumo: string; expiraEm: string; status: 'proposta' | 'resultado_pendente' }

// Propostas que o assistente (Claude, ChatGPT…) preparou e o coach ainda não salvou.
export async function buscarPendentes(base: string, token: string, buscar: typeof fetch = fetch): Promise<PropostaPendente[]> {
  const r = await buscar(`${base}/prescricao/pendentes`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error('Não foi possível ver as propostas do assistente.')
  const corpo = (await r.json()) as { propostas?: unknown }
  return (Array.isArray(corpo.propostas) ? corpo.propostas : []).filter((p): p is PropostaPendente => !!p && typeof (p as PropostaPendente).id === 'string' && typeof (p as PropostaPendente).nome === 'string')
}

// Pede para o app conferir de novo agora (ex.: depois de salvar uma proposta).
export const atualizarPropostasMcp = () => window.dispatchEvent(new Event(EVENTO))

// Confere sozinho enquanto o app está aberto: a cada 15 s, ao voltar para a aba e ao recuperar a internet.
// Falha de rede mantém a última lista (o aviso não some por um solavanco de conexão).
export function usePropostasMcp(ativo: boolean): PropostaPendente[] {
  const [lista, setLista] = useState<PropostaPendente[]>([])
  useEffect(() => {
    if (!ativo || !CONECTOR_URL) return
    let vivo = true
    let ocupado = false
    async function conferir() {
      if (ocupado || document.visibilityState !== 'visible' || !auth.currentUser) return
      ocupado = true
      try {
        const token = await auth.currentUser.getIdToken()
        const novas = await buscarPendentes(CONECTOR_URL!, token)
        if (vivo) setLista((antes) => (JSON.stringify(antes) === JSON.stringify(novas) ? antes : novas))
      } catch { /* mantém a lista anterior */ } finally { ocupado = false }
    }
    void conferir()
    const timer = setInterval(() => void conferir(), INTERVALO_MS)
    const agora = () => void conferir()
    document.addEventListener('visibilitychange', agora)
    window.addEventListener('online', agora)
    window.addEventListener(EVENTO, agora)
    return () => {
      vivo = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', agora)
      window.removeEventListener('online', agora)
      window.removeEventListener(EVENTO, agora)
    }
  }, [ativo])
  return lista
}
