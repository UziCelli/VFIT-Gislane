import type { Aparelho } from '../../engine/aparelho'
import { maquinasDoExercicio, mesmaEscala, paraSlot, type Maquina } from '../../lib/maquinas'
import { campoBase } from '../../ui'

// Escolha da máquina de um exercício do treino (#261), na montagem e no presencial (só coach). Mostra só as máquinas
// ligadas ao exercício no catálogo; sem nenhuma (e sem máquina escolhida), não aparece. Grava a cópia da escala.
export default function SeletorMaquina({ nome, atual, maquinas, mudar, rotulo = 'Máquina', className = '' }: {
  nome: string; atual?: Aparelho; maquinas: readonly Maquina[]; mudar: (m: Aparelho | null) => void; rotulo?: string; className?: string
}) {
  const ligadas = maquinasDoExercicio(maquinas, nome)
  if (!ligadas.length && !atual) return null
  const noCatalogo = atual ? maquinas.find((m) => m.id === atual.id) : undefined
  const desatualizada = !!atual && !!noCatalogo && !mesmaEscala(atual, noCatalogo)
  const escolher = (id: string) => {
    if (!id) return mudar(null)
    const m = maquinas.find((x) => x.id === id)
    if (m) mudar(paraSlot(m))
  }
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
        <span className="shrink-0">{rotulo}</span>
        <select aria-label={`${rotulo} de ${nome}`} value={atual?.id ?? ''} onChange={(e) => escolher(e.target.value)} className={`${campoBase} min-h-11 min-w-0 flex-1 px-2 text-sm outline-none focus:border-marca-500`}>
          <option value="">Sem máquina</option>
          {atual && !ligadas.some((m) => m.id === atual.id) && <option value={atual.id}>{atual.nome} · {atual.local}</option>}
          {ligadas.map((m) => <option key={m.id} value={m.id}>{m.nome} · {m.local}</option>)}
        </select>
      </label>
      {desatualizada && (
        <button type="button" onClick={() => mudar(paraSlot(noCatalogo!))} className="min-h-11 self-start text-xs font-semibold text-amber-300">
          A escala desta máquina mudou · Usar a nova
        </button>
      )}
    </div>
  )
}
