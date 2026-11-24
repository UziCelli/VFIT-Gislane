import { useState } from 'react'
import type { Respostas } from '../../lib/anamnese'
import { esqueletoTreino, ROTULO_GRUPO } from '../../lib/esqueletoTreino'
import { IcSeta } from '../../icones'
import { Painel } from '../../ui'

// Sugestão de esqueleto do treino (só o coach vê). Recolhida por padrão; nunca grava nada.
export default function EsqueletoTreino({ r }: { r: Respostas }) {
  const [aberto, setAberto] = useState(false)
  const e = esqueletoTreino(r)
  if (!e) return null
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-11 w-full items-center gap-2 py-3 text-left">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Sugestão de esqueleto do treino</h2>
          <p className="truncate text-xs text-slate-400">{e.divisao}</p>
        </div>
        <IcSeta aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform ${aberto ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      <Painel aberto={aberto}>
        <div className="space-y-3 pb-4 text-sm">
          {e.cuidados.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-100">
              <p className="font-semibold">Cuidados</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{e.cuidados.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <ul className="space-y-2">
            {e.dias.map((d) => (
              <li key={d.nome} className="rounded-xl border border-slate-800 p-3">
                <p className="font-semibold">{d.nome}</p>
                <p className="text-slate-300">{d.grupos.map((g) => `${ROTULO_GRUPO[g.grupo]} ${g.series}`).join(' · ')} séries</p>
              </li>
            ))}
          </ul>
          <p><span className="font-semibold">Repetições:</span> {e.reps}</p>
          <p><span className="font-semibold">Esforço:</span> {e.rir}</p>
          {e.aerobico && <p><span className="font-semibold">Aeróbico:</span> {e.aerobico}</p>}
          <details className="text-slate-400">
            <summary className="cursor-pointer">Por que saiu assim</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">{e.regras.map((x) => <li key={x}>{x}</li>)}</ul>
          </details>
          <p className="text-xs text-slate-400">Sugestão baseada nas respostas e em meta-análises; a combinação das regras não é validada. Você decide o treino.</p>
        </div>
      </Painel>
    </section>
  )
}
