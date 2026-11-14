import { useEffect, useState } from 'react'
import { auth } from '../../lib/firebase'
import { faltaSegundoFator } from '../../lib/acesso'
import { ir } from '../../rota'
import { Aviso, Botao, Cartao, Pagina } from '../../ui'

const BASE = import.meta.env.VITE_CONECTOR_URL as string | undefined

type Quem = { cliente: string; host: string }

// Só coach: aprova a conexão do Claude (claude.ai) ao app. O app manda o login do coach ao conector; o Firestore segue decidindo tudo.
export default function ConectarClaude({ pedido }: { pedido: string | null }) {
  const [quem, setQuem] = useState<Quem | 'invalido' | null>(null)
  const [semFator, setSemFator] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!BASE || !pedido) return setQuem('invalido')
    fetch(`${BASE}/pedido?id=${encodeURIComponent(pedido)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setQuem, () => setQuem('invalido'))
    auth.currentUser?.getIdTokenResult().then((t) => setSemFator(faltaSegundoFator(t.claims))).catch(() => {})
  }, [pedido])

  // Manda ao conector e segue para onde ele mandar (volta ao claude.ai).
  async function enviar(rota: 'concluir' | 'cancelar') {
    setErro('')
    setOcupado(true)
    try {
      const u = auth.currentUser
      if (!u) throw new Error()
      const corpo = rota === 'cancelar' ? { pedido } : { pedido, idToken: await u.getIdToken(true), refreshToken: u.refreshToken }
      const r = await fetch(`${BASE}/${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const dados = (await r.json().catch(() => ({}))) as { redirectTo?: string; erro?: string }
      if (!r.ok || !dados.redirectTo) {
        if (rota === 'cancelar') return ir('/')
        throw new Error(dados.erro)
      }
      location.href = dados.redirectTo
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não deu para conectar. Confira a internet e tente de novo.')
      setOcupado(false)
    }
  }

  if (quem === null) return null
  if (quem === 'invalido')
    return (
      <Pagina titulo="Conectar o Claude">
        <Aviso>Este pedido venceu ou já foi usado. Volte ao claude.ai e conecte de novo.</Aviso>
      </Pagina>
    )
  return (
    <Pagina titulo="Conectar o Claude">
      <Cartao className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Permitir que o Claude veja e monte treinos dos seus alunos?</h2>
        <p className="text-sm text-slate-400">
          O Claude vai ler os alunos, anamnese, avaliações, dores e cargas, com o seu login. Treino que ele montar é sempre rascunho, para você revisar.
        </p>
        <p className="text-sm text-slate-400">
          Pedido de <strong className="text-slate-200">{quem.cliente}</strong>, que volta para <strong className="text-slate-200">{quem.host}</strong>. Só permita se foi você que acabou de pedir.
        </p>
        {semFator && <Aviso>Falta a verificação em 2 etapas. Ative em Minha conta, saia e entre de novo com o código.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-col gap-2">
          <Botao tipo="primario" tamanho="lg" disabled={ocupado || semFator} carregando={ocupado} onClick={() => enviar('concluir')}>Permitir</Botao>
          <Botao disabled={ocupado} onClick={() => enviar('cancelar')}>Cancelar</Botao>
        </div>
      </Cartao>
    </Pagina>
  )
}
