// Pílulas embaixo do nome do exercício: equipamento, lados e modo (src/lib/pilulas.ts).
// Neutras (sem cor de método): só apoio visual; o texto vai junto do ícone.
import { IcAlternado, IcAnilha, IcArticulada, IcBarra, IcBola, IcDuasPolias, IcElastico, IcExcentrico, IcHaltere, IcHalteres, IcKettlebell, IcPessoa, IcPolia, IcRelogio, IcSeletora, IcSmith, IcUnilateral, type Icone } from '../../icones'
import type { Aparelho, MaquinaTreino } from '../../engine/aparelho'
import { textoMaquina } from '../../lib/maquinas'
import { pilulasDo, type IdPilula, type Pilula } from '../../lib/pilulas'

const ICONE: Partial<Record<IdPilula, Icone>> = {
  halter: IcHaltere, halteres: IcHalteres, kettlebell: IcKettlebell, kettlebells: IcKettlebell,
  barra: IcBarra, barra_w: IcBarra, barra_hexagonal: IcBarra, landmine: IcBarra,
  smith: IcSmith, smith_dual: IcSmith, polia: IcPolia, duas_polias: IcDuasPolias,
  maquina_seletora: IcSeletora, maquina_articulada: IcArticulada, elastico: IcElastico, anilha: IcAnilha,
  medicine_ball: IcBola, bola_suica: IcBola, peso_do_corpo: IcPessoa, suspensao: IcPessoa, caneleira: IcAnilha,
  unilateral: IcUnilateral, alternado: IcAlternado, isometrico: IcRelogio, excentrico: IcExcentrico,
}

export default function PilulasExercicio({ nome, className = '' }: { nome: string; className?: string }) {
  return <ListaPilulas pilulas={pilulasDo(nome)} className={className} />
}

// Prévia do cadastro: pílulas de atributos que ainda não viraram exercício.
export function ListaPilulas({ pilulas: ps, className = '' }: { pilulas: Pilula[]; className?: string }) {
  if (!ps.length) return null
  return (
    <ul aria-label="Equipamento e modo" className={`flex flex-wrap gap-1.5 ${className}`}>
      {ps.map((p) => {
        const Ic = ICONE[p.id]
        return (
          <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {Ic && <Ic className="size-3.5 shrink-0 text-slate-400" />}
            {p.rotulo}
          </li>
        )
      })}
    </ul>
  )
}

// Máquina do exercício neste treino (#261): só o rótulo da projeção (sem local).
const ICONE_MAQUINA: Record<Aparelho['tipo'], Icone> = { maquina: IcSeletora, articulada: IcArticulada, polia: IcPolia, duasPolias: IcDuasPolias, halter: IcHaltere, barra: IcBarra }
export function LinhaMaquina({ maquina, className = '' }: { maquina?: MaquinaTreino; className?: string }) {
  if (!maquina) return null
  const Ic = ICONE_MAQUINA[maquina.tipo]
  return (
    <p data-maquina className={`flex items-start gap-1.5 text-xs text-slate-300 ${className}`}>
      <Ic className="mt-px size-3.5 shrink-0 text-slate-400" />
      <span>{textoMaquina(maquina)}</span>
    </p>
  )
}
