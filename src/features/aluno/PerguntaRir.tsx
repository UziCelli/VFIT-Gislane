import { registrarRir } from '../../lib/acoes'

type Rir = 0 | 1 | 2 | 3
const OPCOES: { v: Rir; rotulo: string }[] = [
  { v: 0, rotulo: '0' },
  { v: 1, rotulo: '1' },
  { v: 2, rotulo: '2' },
  { v: 3, rotulo: '3+' },
]

// Pergunta opcional de 1 toque, logo abaixo da última série do exercício: "quantas repetições ainda faria?" (RIR).
// Toque de novo na opção marcada limpa. Só o coach usa a resposta (esforço médio por exercício); não muda a carga sugerida.
export default function PerguntaRir({
  mesoId,
  uid,
  semana,
  treino,
  slotId,
  coluna,
  valor,
  disabled,
}: {
  mesoId: string
  uid: string
  semana: number
  treino: number
  slotId: string
  coluna: number
  valor: number | null
  disabled?: boolean
}) {
  const grava = (n: Rir | null) => registrarRir(mesoId, uid, semana, treino, slotId, coluna, n).catch(() => {}) // sem await: offline só resolve no servidor
  return (
    <div role="group" aria-label="Quantas repetições ainda faria?" className="flex flex-wrap items-center gap-2 pl-1 pt-0.5">
      <span className="text-xs text-slate-400">Ainda faria quantas?</span>
      {OPCOES.map(({ v, rotulo }) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          aria-pressed={valor === v}
          aria-label={`${v === 3 ? '3 ou mais' : v} repetições a mais`}
          onClick={() => grava(valor === v ? null : v)}
          className={`min-h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold ${valor === v ? 'border-marca-400 bg-marca-600 text-white' : 'border-slate-700 bg-slate-950 text-slate-300'} disabled:opacity-50`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}
