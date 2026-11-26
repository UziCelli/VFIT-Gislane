import { collection, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { IcPlay } from '../../icones'
import { db } from '../../lib/firebase'
import { registrarErro } from '../../lib/log'
import { fonteDemo, type FonteDemo } from '../../lib/videos'

// Demonstrações "No ar" da marca: exercicioId -> player. Uma leitura só por abertura do app (cache do módulo), não
// uma assinatura: o treino não redesenha quando o coach mexe na aba Vídeos (#237). Erro (sem internet e sem cache)
// = nenhum botão, e tenta de novo na próxima vez que um treino abrir.
let pedido: Promise<Map<string, FonteDemo>> | null = null

function carregar() {
  pedido ??= getDocs(query(collection(db, 'videos'), where('status', '==', 'no-ar')))
    .then((s) => {
      const m = new Map<string, FonteDemo>()
      for (const d of s.docs) {
        const f = fonteDemo(d.get('link'))
        if (f) m.set(d.id, f)
      }
      return m
    })
    .catch((e) => {
      pedido = null
      registrarErro('erro', `videos demo: ${e?.code ?? e}`, e)
      return new Map<string, FonteDemo>()
    })
  return pedido
}

export function useDemos(): Map<string, FonteDemo> | null {
  const [demos, setDemos] = useState<Map<string, FonteDemo> | null>(null)
  useEffect(() => {
    let vivo = true
    carregar().then((m) => vivo && setDemos(m))
    return () => {
      vivo = false
    }
  }, [])
  return demos
}

// "Ver demonstração" abaixo do nome. Fechado = só o botão (o iframe não existe, nada baixa). Aberto = player dentro
// do cartão; "Fechar" desmonta o player e o cartão volta à altura normal. Sem áudio: o vídeo já vem mudo.
export function Demonstracao({ nome, fonte }: { nome: string; fonte: FonteDemo }) {
  const [aberto, setAberto] = useState(false)
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} aria-label={`Ver demonstração de ${nome}`} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-marca-300">
        <IcPlay className="size-4" /> Ver demonstração
      </button>
    )
  return (
    <div className="space-y-2" data-demo-aberta>
      <div className={`mx-auto overflow-hidden rounded-xl bg-black ${fonte.vertical ? 'aspect-[9/16] max-h-[60vh]' : 'aspect-video w-full'}`}>
        <iframe
          src={fonte.src}
          title={`Demonstração: ${nome}`}
          className="size-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
        />
      </div>
      <button type="button" onClick={() => setAberto(false)} className="min-h-11 w-full rounded-lg text-sm font-semibold text-slate-300 ring-1 ring-slate-700">
        Fechar demonstração
      </button>
    </div>
  )
}
