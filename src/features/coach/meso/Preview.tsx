import { useSyncExternalStore } from 'react'
import type { Meso } from '../../../engine'
import { acimaDoLimite, fmtMin } from '../../../lib/tempo'
import { IcSeta } from '../../../icones'
import { campoBase, Cartao } from '../../../ui'
import PreviaAluno, { sessaoSegura } from './PreviaAluno'

// Faixa fixa no topo do editor: tempo estimado de cada treino da semana, sempre à vista em qualquer aba.
// Tocar num treino mostra esse treino na prévia do aluno.
export function BarraTempo({ meso, semana, onSemana, treino, onTreino }: {
  meso: Meso
  semana: number
  onSemana: (w: number) => void
  treino: number
  onTreino: (t: number) => void
}) {
  return (
    <div role="region" aria-label="Tempo estimado dos treinos" className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-800 bg-slate-950/90 px-4 pb-2 pt-topo backdrop-blur">
      <div className="flex items-center gap-2 overflow-x-auto text-sm">
        <span className="shrink-0 text-slate-400">Tempo estimado</span>
        <label className="flex shrink-0 items-center gap-1 text-slate-400">
          <span className="sr-only">Semana</span>
          <select value={semana} onChange={(e) => onSemana(Number(e.target.value))} className={`${campoBase} min-h-9 px-2 py-1 text-sm`}>
            {Array.from({ length: meso.semanas }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>Semana {w}</option>
            ))}
          </select>
        </label>
        {Array.from({ length: meso.frequencia }, (_, i) => i + 1).map((t) => {
          const min = sessaoSegura(meso, semana, t)?.tempoMin ?? 0
          const acima = acimaDoLimite(min, meso.tempoLimiteMin)
          const sel = t === treino
          return (
            <button
              key={t}
              type="button"
              aria-pressed={sel}
              aria-label={`Treino ${t}: ${fmtMin(min)}${acima ? ', acima do limite' : ''}`}
              onClick={() => onTreino(t)}
              className={`min-h-9 shrink-0 rounded-full border px-3 font-semibold tabular-nums ${sel ? 'border-marca-400' : 'border-transparent'} ${acima ? 'bg-red-900/50 text-red-300' : 'bg-slate-800 text-slate-100'}`}
            >
              T{t} · {fmtMin(min)}
            </button>
          )
        })}
        {meso.tempoLimiteMin != null && <span className="shrink-0 text-xs text-slate-500">limite {meso.tempoLimiteMin} min</span>}
      </div>
    </div>
  )
}

// Tela bem larga (2xl do Tailwind): prévia sempre aberta ao lado do editor.
const LARGA = '(min-width: 96rem)'
const useTelaLarga = () =>
  useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(LARGA)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    () => window.matchMedia(LARGA).matches,
  )

// Prévia do aluno: o treino escolhido como ele aparece no app do aluno, atualizado a cada edição (sem salvar).
// Celular/tablet: recolhível. Tela bem larga (2xl, ≥1536 px): sempre aberta, ao lado do editor (quem posiciona é o EditorMeso).
export default function Preview({ meso, semana, treino, aberta, onAlternar }: {
  meso: Meso
  semana: number
  treino: number
  aberta: boolean
  onAlternar: () => void
}) {
  const larga = useTelaLarga()
  return (
    <Cartao className="space-y-3 !p-2 2xl:!p-3">
      <button type="button" aria-expanded={aberta} onClick={onAlternar} className="flex min-h-11 w-full items-center gap-2 text-left font-semibold 2xl:pointer-events-none">
        <IcSeta className={`size-4 transition-transform 2xl:hidden ${aberta ? 'rotate-90' : ''}`} />
        Prévia do aluno
        <span className="ml-auto text-xs font-normal text-slate-400">Treino {treino} · semana {semana}</span>
      </button>
      {(aberta || larga) && (
      <div>
        <div className="mx-auto max-h-[70dvh] max-w-[390px] overflow-y-auto overscroll-contain rounded-xl border border-slate-800 2xl:rounded-[28px] 2xl:border-4 2xl:max-h-[calc(100dvh-12rem)]">
          <PreviaAluno meso={meso} semana={semana} treino={treino} />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">Só para ver: os botões não funcionam aqui.</p>
      </div>
      )}
    </Cartao>
  )
}
