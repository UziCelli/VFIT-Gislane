import { IcBalao } from '../../icones'
import type { PropostaPendente } from '../../lib/propostasMcp'
import { classesBotao } from '../../ui'

export const ROTA_PROPOSTAS = '/confirmar-treino-mcp'
export const rotaDaProposta = (id: string) => `${ROTA_PROPOSTAS}?id=${id}`

// Aviso fixo no topo do painel: aparece sozinho quando o assistente prepara um treino.
export function AvisoPropostaMcp({ propostas }: { propostas: PropostaPendente[] }) {
  if (!propostas.length) return null
  const uma = propostas.length === 1 ? propostas[0] : null
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3" role="status">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
        <IcBalao className="size-5 shrink-0" />
        <p className="min-w-0 flex-1">
          {uma ? <><strong>{uma.alunoNome}</strong>: o assistente preparou um treino para você conferir.</> : `O assistente preparou ${propostas.length} treinos para você conferir.`}
        </p>
        <a href={`#${uma ? rotaDaProposta(uma.id) : ROTA_PROPOSTAS}`} className={classesBotao('primario', 'md', 'inline-flex items-center justify-center')}>{uma ? 'Conferir treino' : 'Ver treinos'}</a>
      </div>
    </div>
  )
}
