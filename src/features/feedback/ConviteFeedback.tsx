import marca from '@marca/marca.json'
import { useEffect, useState } from 'react'
import { IcBalao, IcEstrela, IcSeta } from '../../icones'
import { convidarAgora, marcarConvite, mostrarCardEvidente, primeiroNome } from '../../lib/feedback'
import { ir } from '../../rota'
import { Botao, Folha } from '../../ui'
import { IconeQuadrado, Quadro } from '../../vidro'

const Faixa = ({ texto }: { texto: string }) => (
  <a href="#/feedback" className="toque block">
    <Quadro className="flex items-center gap-3 border border-marca-400/60 bg-marca-500/15">
      <IconeQuadrado><IcBalao className="size-5" /></IconeQuadrado>
      <p className="min-w-0 flex-1 text-sm font-semibold">{texto}</p>
      <IcSeta className="size-5 text-slate-400" />
    </Quadro>
  </a>
)

// Card grande: chama a atenção na Início até o aluno responder (a faixa pequena passava despercebida).
const CardEvidente = () => (
  <a href="#/feedback" className="toque block">
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-5 ring-1 ring-white/15 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.7)]">
      <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div aria-hidden className="flex gap-1 text-amber-300">
          {[1, 2, 3, 4, 5].map((n) => <IcEstrela key={n} cheia className="size-6" />)}
        </div>
        <h2 className="mt-3 text-[26px] leading-tight text-white">Como está sendo para você?</h2>
        <p className="mt-2 text-[15px] leading-snug text-white/90">
          Conte em 1 minuto o que está bom e o que melhorar: no app, nos treinos ou no atendimento. {primeiroNome(marca.responsavel.nome)} lê pessoalmente.
        </p>
        <span className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 font-bold text-marca-900">Dar minha opinião</span>
      </div>
    </section>
  </a>
)

// Início: card grande até o aluno responder; depois de enviar, faixa pequena por 30 dias.
export function FaixaFeedback({ texto = 'O que melhorar no app? Conte em 1 minuto' }: { texto?: string }) {
  const [grande] = useState(mostrarCardEvidente)
  return grande ? <CardEvidente /> : <Faixa texto={texto} />
}

// Convite: só se já passaram 7 dias do último (relatório).
export default function ConviteFeedback({ texto = 'O que podemos melhorar no app? Conte em 1 minuto' }: { texto?: string }) {
  const [mostrar] = useState(convidarAgora) // decide uma vez, antes de marcar
  useEffect(() => {
    if (mostrar) marcarConvite()
  }, [mostrar])
  return mostrar ? <Faixa texto={texto} /> : null
}

const ATRASO_POPUP_MS = 3500 // dá tempo de ver o resumo do treino antes do pedido

// Fim do treino: janela de baixo para cima, no máximo 1 vez a cada 7 dias (o aluno está satisfeito agora).
export function PopupFeedback() {
  const [pode] = useState(convidarAgora)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (!pode) return
    const t = setTimeout(() => { setAberto(true); marcarConvite() }, ATRASO_POPUP_MS)
    return () => clearTimeout(t)
  }, [pode])
  if (!aberto) return null
  return (
    <Folha titulo="Treino concluído! Quer nos ajudar?" onFechar={() => setAberto(false)}>
      <p className="text-slate-300">Conte em 1 minuto o que achou do app, dos treinos ou do atendimento. {primeiroNome(marca.responsavel.nome)} lê pessoalmente.</p>
      <Botao tipo="primario" tamanho="lg" className="w-full" onClick={() => ir('/feedback')}>Dar minha opinião</Botao>
      <Botao tipo="fantasma" className="w-full" onClick={() => setAberto(false)}>Agora não</Botao>
    </Folha>
  )
}
