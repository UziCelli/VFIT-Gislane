// Polimento na tela do aluno: faixa no topo do dia/semana e selo no card do exercício.
// Hierarquia: título curto (o quê) → uma linha de motivo → o que muda. Cor própria (teal), fora das cores de método.
import { IcQueda } from '../../icones'

export function FaixaPolimento({ semana, resumo }: { semana: boolean; resumo: string }) {
  return (
    <section aria-label="Polimento" className="mb-4 rounded-2xl bg-teal-500/10 p-4 ring-1 ring-teal-400/40">
      <h2 className="flex items-center gap-2 text-base font-bold text-teal-100">
        <IcQueda className="size-5 shrink-0 text-teal-300" />
        {semana ? 'Semana de polimento' : 'Treino de polimento'}
      </h2>
      <p className="mt-1 text-sm text-slate-200">Mais leve de propósito, para recuperar e render mais.</p>
      <p className="mt-1 text-sm font-semibold text-teal-200">{resumo}</p>
    </section>
  )
}

// `discreto`: o dia já tem a faixa no topo, então o card só lembra o que muda nele (sem caixa).
export function SeloPolimento({ mudancas, discreto = false }: { mudancas: string[]; discreto?: boolean }) {
  return (
    <div className={`mb-3 flex items-start gap-2 ${discreto ? '' : 'rounded-lg bg-teal-500/10 px-3 py-2 ring-1 ring-teal-400/40'}`}>
      <IcQueda className="mt-0.5 size-4 shrink-0 text-teal-300" />
      <p className="text-sm leading-snug">
        <span className="font-bold text-teal-100">Polimento</span>
        <span className="text-slate-200"> · {mudancas.join(' · ')}</span>
      </p>
    </div>
  )
}
