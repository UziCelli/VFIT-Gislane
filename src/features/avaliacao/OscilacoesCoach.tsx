import { useState } from 'react'
import { efetiva, etmDoAluno, type Avaliacao } from '../../lib/avaliacao'
import type { RelatoDor } from '../../lib/dor'
import type { Ocorrencia } from '../../lib/evolucao'
import { oscilacoes } from '../../lib/oscilacoes'
import { IcSeta } from '../../icones'
import { Painel } from '../../ui'

// Só o coach vê (usa relato de dor). Inferência interpretativa, nunca causa e efeito.
// `atual`: já com as médias (r.atual); `ant` e `todas` brutas (a média e o ETM saem aqui).
export default function OscilacoesCoach({ atual, ant, todas, cargas, dores }: { atual: Avaliacao; ant: Avaliacao | null; todas: Avaliacao[]; cargas: Record<string, Ocorrencia[]>; dores: RelatoDor[] }) {
  const [aberto, setAberto] = useState(false)
  const lista = ant ? oscilacoes(atual, efetiva(ant), cargas, dores, etmDoAluno(todas)) : []
  if (!lista.length) return null
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-11 w-full items-center gap-2 py-3 text-left">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Leitura do período (só você vê)</h2>
          <p className="truncate text-xs text-slate-400">Carga, frequência, dor e medida por segmento</p>
        </div>
        <IcSeta aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform ${aberto ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      <Painel aberto={aberto}>
        <div className="space-y-2 pb-4 text-sm">
          <p className="rounded-xl bg-amber-500/10 p-3 text-amber-100">
            Inferências interpretativas sobre o histórico do aluno. Não indicam causa e efeito: não há evidência que ligue, no indivíduo, carga ou dor à mudança de medida.
          </p>
          <ul className="space-y-2">
            {lista.map((o) => (
              <li key={o.id} className="rounded-xl border border-slate-800 p-3">
                <p className="font-semibold">{o.rotulo}</p>
                <p className="text-slate-300">{o.fatos.join(' · ')}</p>
                {o.inferencia && <p className="mt-1 text-slate-400">{o.inferencia}</p>}
              </li>
            ))}
          </ul>
        </div>
      </Painel>
    </section>
  )
}
