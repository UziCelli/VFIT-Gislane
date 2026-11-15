import { useEffect, useState } from 'react'
import { auth } from '../../lib/firebase'
import { Aviso, Botao, Cartao, Pagina } from '../../ui'
import type { MesoDoc } from '../../lib/conversores'
import { PreviaTreinoMcp } from './PreviaTreinoMcp'

const BASE = import.meta.env.VITE_CONECTOR_URL as string | undefined

type Visualizacao = { status: string; proposta?: { nome: string; alunoNome: string; acao: string; resumo: string; dados: MesoDoc; previaDados?: MesoDoc; antes?: MesoDoc & { nome?: string } } }

// O link só identifica a proposta; o servidor exige o login do coach que a criou.
export default function ConfirmarTreinoMcp({ id }: { id: string | null }) {
  const [dados, setDados] = useState<Visualizacao | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        if (!BASE || !id || !auth.currentUser) throw new Error('Link inválido. Volte ao assistente e peça uma nova proposta.')
        const token = await auth.currentUser.getIdToken(true)
        const r = await fetch(`${BASE}/prescricao?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
        const resposta = await r.json() as Visualizacao & { erro?: string }
        if (!r.ok) throw new Error(resposta.erro || 'Não foi possível abrir a proposta.')
        if (ativo) setDados(resposta)
      } catch (e) { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível abrir a proposta.') }
    }
    void carregar()
    return () => { ativo = false }
  }, [id])
  async function salvar() {
    setOcupado(true)
    setErro('')
    try {
      if (!BASE || !id || !auth.currentUser) throw new Error('Entre novamente para salvar.')
      const idToken = await auth.currentUser.getIdToken(true)
      const r = await fetch(`${BASE}/prescricao/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, idToken }) })
      const resposta = await r.json() as Visualizacao & { erro?: string }
      if (!r.ok) throw new Error(resposta.erro || 'Não foi possível salvar o treino.')
      setDados(resposta)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar o treino.') }
    finally { setOcupado(false) }
  }
  return (
    <Pagina titulo="Conferir treino do assistente">
      <Cartao className="max-w-2xl space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        {!dados && !erro && <p>Carregando proposta…</p>}
        {dados?.proposta && <>
          <h2 className="text-lg font-semibold">{dados.proposta.nome}</h2>
          <p className="text-sm">Aluno: {dados.proposta.alunoNome} · {dados.proposta.acao === 'editar' ? 'Alterar treino existente' : dados.proposta.acao === 'proximo' ? 'Criar próximo treino' : 'Criar treino'}</p>
          <p className="text-sm">Confira os detalhes de todas as semanas antes de salvar.</p>
          {dados.proposta.antes && <details className="rounded-xl border border-slate-600 p-3"><summary className="cursor-pointer font-semibold">Treino atual antes da alteração</summary><p className="my-2">{dados.proposta.antes.nome}</p><PreviaTreinoMcp dados={dados.proposta.antes} /></details>}
          <h3 className="font-semibold">{dados.proposta.acao === 'editar' ? 'Treino proposto após a alteração' : 'Treino proposto'}</h3>
          <PreviaTreinoMcp dados={dados.proposta.previaDados ?? dados.proposta.dados} />
        </>}
        {dados?.status === 'resultado_pendente' && <><Aviso>Não foi possível confirmar se o treino foi salvo. Confira no app antes de preparar outra proposta.</Aviso><Botao disabled={ocupado} carregando={ocupado} onClick={salvar}>Consultar resultado</Botao></>}
        {dados?.status === 'recusada' && <Aviso>O treino não foi salvo porque os dados mudaram ou a gravação foi recusada. Peça uma nova proposta ao assistente.</Aviso>}
        {dados?.status === 'expirada' && <Aviso>Esta proposta venceu. Peça uma nova ao assistente.</Aviso>}
        {dados?.status === 'salva' ? <p>Treino salvo no app.</p> : dados?.status === 'proposta' && dados?.proposta && <Botao tipo="primario" tamanho="lg" disabled={ocupado} carregando={ocupado} onClick={salvar}>Salvar treino</Botao>}
      </Cartao>
    </Pagina>
  )
}
