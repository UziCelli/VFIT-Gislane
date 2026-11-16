import { useEffect, useState } from 'react'
import { auth } from '../../lib/firebase'
import { Aviso, Botao, Cartao, classesBotao, Pagina } from '../../ui'
import type { MesoDoc } from '../../lib/conversores'
import { PreviaTreinoMcp } from './PreviaTreinoMcp'
import { atualizarPropostasMcp, CONECTOR_URL as BASE, type PropostaPendente } from '../../lib/propostasMcp'
import { rotaDaProposta } from './AvisoPropostaMcp'

type Visualizacao = { status: string; mensagem?: string; proposta?: { nome: string; alunoNome: string; acao: string; resumo: string; dados: MesoDoc; previaDados?: MesoDoc; antes?: MesoDoc & { nome?: string }; remocoes?: { nome: string; treino: number }[]; diferencas?: { tipo: 'retirado' | 'incluido'; nome: string; treino: number }[]; avisos?: string[]; sessoesPreservadas?: string[] } }

const ACAO = { editar: 'Alterar treino existente', proximo: 'Criar próximo treino', criar: 'Criar treino' } as const

// Sem id (aberto pelo aviso do app): lista o que o assistente preparou e ainda não foi salvo.
function ListaPropostas({ pendentes }: { pendentes: PropostaPendente[] }) {
  return (
    <Pagina titulo="Treinos do assistente">
      <Cartao className="max-w-2xl space-y-3">
        {pendentes.length === 0 && <p>Nenhum treino aguardando. Quando o assistente preparar um, ele aparece aqui sozinho.</p>}
        {pendentes.map((p) => (
          <a key={p.id} href={`#${rotaDaProposta(p.id)}`} className="block rounded-xl border border-slate-600 p-3 hover:border-slate-500">
            <strong>{p.alunoNome}</strong> · {ACAO[p.acao as keyof typeof ACAO] ?? 'Treino'}
            <span className="block text-sm text-slate-400">{p.nome}{p.status === 'resultado_pendente' ? ' · confirmar se foi salvo' : ''}</span>
          </a>
        ))}
      </Cartao>
    </Pagina>
  )
}

// O link só identifica a proposta; o servidor exige o login do coach que a criou.
export default function ConfirmarTreinoMcp({ id, pendentes = [] }: { id: string | null; pendentes?: PropostaPendente[] }) {
  if (!id) return <ListaPropostas pendentes={pendentes} />
  return <ConferirProposta id={id} />
}

function ConferirProposta({ id }: { id: string }) {
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
      atualizarPropostasMcp()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar o treino.') }
    finally { setOcupado(false) }
  }
  return (
    <Pagina titulo="Conferir treino do assistente">
      <Cartao className="max-w-2xl space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        {!dados && !erro && <p>Carregando proposta…</p>}
        {dados?.proposta && <>
          <h2 className="text-lg font-semibold"><span className="text-sm font-normal">Nome proposto: </span>{dados.proposta.nome}</h2>
          <p className="text-sm">Aluno: {dados.proposta.alunoNome} · {ACAO[dados.proposta.acao as keyof typeof ACAO] ?? ACAO.criar}</p>
          {(dados.proposta.remocoes?.length ?? 0) > 0 && <section className="space-y-2 rounded-xl border border-amber-600 p-3 text-sm">
            <h3 className="font-semibold">Exercícios a retirar da divisão planejada</h3>
            <ul className="list-disc space-y-1 pl-5">{dados.proposta.remocoes!.map((r, i) => <li key={i}>{r.nome} · Treino {r.treino}</li>)}</ul>
            {dados.proposta.avisos?.length ? dados.proposta.avisos.map((aviso, i) => <p key={i}>{aviso}</p>) : <>
              <p>As cargas já registradas não serão apagadas.</p>
              <p>Sessões presenciais ajustadas continuam como estão.</p>
            </>}
            <p>Uma sessão presencial ajustada pode manter o exercício retirado.</p>
          </section>}
          {!dados.proposta.remocoes?.length && (dados.proposta.diferencas?.length ?? 0) > 0 && <section className="space-y-2 rounded-xl border border-amber-600 p-3 text-sm">
            <h3 className="font-semibold">Exercícios que mudam na divisão planejada</h3>
            <ul className="list-disc space-y-1 pl-5">{dados.proposta.diferencas!.map((d, i) => <li key={i}>{d.tipo === 'retirado' ? 'Retirar' : 'Incluir'}: {d.nome} · Treino {d.treino}</li>)}</ul>
            <p>As cargas já registradas não serão apagadas.</p>
          </section>}
          {!dados.proposta.remocoes?.length && (dados.proposta.avisos?.length ?? 0) > 0 && <div className="space-y-2">{dados.proposta.avisos!.map((aviso, i) => <Aviso key={i}>{aviso}</Aviso>)}</div>}
          <p className="text-sm">Confira os detalhes de todas as semanas antes de salvar.</p>
          {!!dados.proposta.sessoesPreservadas?.length && <Aviso>Sessões com registros preservadas (semana-treino): {dados.proposta.sessoesPreservadas.join(', ')}. As alterações valem para as demais sessões planejadas.</Aviso>}
          {dados.proposta.antes && <details className="rounded-xl border border-slate-600 p-3"><summary className="cursor-pointer font-semibold">Treino atual antes da alteração</summary><p className="my-2">{dados.proposta.antes.nome}</p><PreviaTreinoMcp dados={dados.proposta.antes} /></details>}
          <h3 className="font-semibold">{dados.proposta.acao === 'editar' ? 'Treino proposto após a alteração' : 'Treino proposto'}</h3>
          <PreviaTreinoMcp dados={dados.proposta.previaDados ?? dados.proposta.dados} />
        </>}
        {dados?.status === 'resultado_pendente' && <><Aviso>Não foi possível confirmar se o treino foi salvo. Confira no app antes de preparar outra proposta.</Aviso><Botao disabled={ocupado} carregando={ocupado} onClick={salvar}>Consultar resultado</Botao></>}
        {dados?.status === 'recusada' && <Aviso>{dados.mensagem ?? 'O treino não foi salvo porque os dados mudaram ou a gravação foi recusada. Peça uma nova proposta ao assistente.'}</Aviso>}
        {dados?.status === 'expirada' && <Aviso>Esta proposta venceu. Peça uma nova ao assistente.</Aviso>}
        {dados?.status === 'salva' ? <><p>Treino salvo no app.</p><a href="#/" className={classesBotao('secundario', 'md', 'inline-flex items-center justify-center')}>Voltar ao início</a></> : dados?.status === 'proposta' && dados?.proposta && <Botao tipo="primario" tamanho="lg" disabled={ocupado} carregando={ocupado} onClick={salvar}>Salvar treino</Botao>}
      </Cartao>
    </Pagina>
  )
}
