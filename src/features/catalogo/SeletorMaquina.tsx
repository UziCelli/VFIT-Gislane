import { useState } from 'react'
import type { MaquinaTreino } from '../../engine/aparelho'
import { garantirRefMaquina } from '../../lib/acoes'
import { registrarErro } from '../../lib/log'
import { daCopia, maquinasDoExercicio, mesmaEscala, novaRef, paraSlot, textoCatalogo, type Maquina } from '../../lib/maquinas'
import { campoBase } from '../../ui'

const ATUAL = '__atual'

// Escolha da máquina de um exercício do treino (#261), na montagem e no presencial (só coach). Mostra só as máquinas
// ligadas ao exercício no catálogo; sem nenhuma (e sem máquina escolhida), não aparece. Grava a projeção (paraSlot):
// o local aparece aqui, para o coach escolher, mas não vai para o treino. Cadastro antigo sem `ref` ganha a dele
// neste momento (escolha explícita do coach), com internet; sem ela, nada muda e aparece o aviso.
export default function SeletorMaquina({ nome, atual, maquinas, mudar, rotulo = 'Máquina', className = '' }: {
  nome: string; atual?: MaquinaTreino; maquinas: readonly Maquina[]; mudar: (m: MaquinaTreino | null) => void; rotulo?: string; className?: string
}) {
  const [aviso, setAviso] = useState('')
  const ligadas = maquinasDoExercicio(maquinas, nome)
  if (!ligadas.length && !atual) return null
  const noCatalogo = daCopia(maquinas, atual)
  const desatualizada = !!atual && !!noCatalogo && !mesmaEscala(atual, noCatalogo)
  const usar = async (m: Maquina) => {
    setAviso('')
    try {
      const ref = m.ref || (await garantirRefMaquina(m.id, novaRef()))
      const p = paraSlot({ ...m, ref })
      if (p) mudar(p)
    } catch (e) {
      registrarErro('gravacao', `maquinas ref: ${(e as { code?: string })?.code ?? e}`, e)
      setAviso('Não deu para escolher esta máquina agora. Confira a internet e tente de novo.')
    }
  }
  const escolher = (v: string) => {
    if (v === ATUAL) return
    if (!v) return (setAviso(''), mudar(null))
    const m = maquinas.find((x) => x.id === v)
    if (m) void usar(m)
  }
  const valor = !atual ? '' : noCatalogo && ligadas.includes(noCatalogo) ? noCatalogo.id : ATUAL
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
        <span className="shrink-0">{rotulo}</span>
        <select aria-label={`${rotulo} de ${nome}`} value={valor} onChange={(e) => escolher(e.target.value)} className={`${campoBase} min-h-11 min-w-0 flex-1 px-2 text-sm outline-none focus:border-marca-500`}>
          <option value="">Sem máquina</option>
          {valor === ATUAL && <option value={ATUAL}>{noCatalogo ? textoCatalogo(noCatalogo) : `${atual!.nome} · fora do catálogo`}</option>}
          {ligadas.map((m) => <option key={m.id} value={m.id}>{textoCatalogo(m)}</option>)}
        </select>
      </label>
      {aviso && <p role="alert" className="text-xs text-red-300">{aviso}</p>}
      {desatualizada && (
        <button type="button" onClick={() => void usar(noCatalogo!)} className="min-h-11 self-start text-xs font-semibold text-amber-300">
          A escala desta máquina mudou · Usar a nova
        </button>
      )}
    </div>
  )
}
