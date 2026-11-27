import type { MaquinaTreino } from '../../engine/aparelho'
import { daCopia, maquinasDoExercicio, mesmaEscala, paraSlot, textoCatalogo, type Maquina } from '../../lib/maquinas'
import { campoBase } from '../../ui'

// Escolha da máquina de um exercício do treino (#261), na montagem e no presencial (só coach). Mostra só as máquinas
// ligadas ao exercício no catálogo; sem nenhuma (e sem máquina escolhida), não aparece. Grava a projeção (paraSlot):
// o local aparece aqui, para o coach escolher, mas não vai para o treino. O valor do campo é a ref opaca.
export default function SeletorMaquina({ nome, atual, maquinas, mudar, rotulo = 'Máquina', className = '' }: {
  nome: string; atual?: MaquinaTreino; maquinas: readonly Maquina[]; mudar: (m: MaquinaTreino | null) => void; rotulo?: string; className?: string
}) {
  const ligadas = maquinasDoExercicio(maquinas, nome).filter((m) => m.ref)
  if (!ligadas.length && !atual) return null
  const noCatalogo = daCopia(maquinas, atual)
  const desatualizada = !!atual && !!noCatalogo && !mesmaEscala(atual, noCatalogo)
  const escolher = (ref: string) => {
    if (!ref) return mudar(null)
    const m = maquinas.find((x) => x.ref === ref)
    const p = m && paraSlot(m)
    if (p) mudar(p)
  }
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
        <span className="shrink-0">{rotulo}</span>
        <select aria-label={`${rotulo} de ${nome}`} value={atual?.ref ?? ''} onChange={(e) => escolher(e.target.value)} className={`${campoBase} min-h-11 min-w-0 flex-1 px-2 text-sm outline-none focus:border-marca-500`}>
          <option value="">Sem máquina</option>
          {atual && !ligadas.some((m) => m.ref === atual.ref) && (
            <option value={atual.ref}>{noCatalogo ? textoCatalogo(noCatalogo) : `${atual.nome} · fora do catálogo`}</option>
          )}
          {ligadas.map((m) => <option key={m.id} value={m.ref}>{textoCatalogo(m)}</option>)}
        </select>
      </label>
      {desatualizada && (
        <button type="button" onClick={() => { const p = paraSlot(noCatalogo!); if (p) mudar(p) }} className="min-h-11 self-start text-xs font-semibold text-amber-300">
          A escala desta máquina mudou · Usar a nova
        </button>
      )}
    </div>
  )
}
