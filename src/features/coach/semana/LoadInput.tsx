import { AnimatePresence, m } from 'motion/react'
import { agil, saida } from '../../../movimento'
import { useEffect, useRef, useState } from 'react'
import { IcCheck } from '../../../icones'
import { cargaSuspeita } from '../../../lib/conferirCarga'
import { fmt } from './format'

// Input de carga (kg): grava no blur/Enter, sem esperar confirmação do servidor (offline-first).
export default function LoadInput({
  valor,
  placeholder,
  onSalvar,
  className = 'w-16',
  disabled = false,
  ariaLabel,
  referencia,
}: {
  ariaLabel?: string
  referencia?: number | null // "confere?": carga de referência (número cinza). Só pergunta na 1ª digitação da célula (valor vazio)
  disabled?: boolean
  valor: number | null
  placeholder?: number | string | null
  onSalvar: (v: number | null) => void
  className?: string
}) {
  const [salvo, setSalvo] = useState(false)
  const [conferir, setConferir] = useState<number | null>(null) // valor digitado bem fora da referência, esperando 1 toque
  const campoRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function commit(campo: HTMLInputElement) {
    setConferir(null) // qualquer nova saída do campo invalida a pergunta anterior (ela guardava o valor velho)
    const t = campo.value.trim().replace(',', '.')
    const v = t === '' ? null : Number(t)
    // Só dígitos com um ponto: Number() aceitaria "1e3", "0x10" e "-0".
    if (v != null && !/^(\d+\.?\d*|\.\d+)$/.test(t)) {
      campo.value = valor == null ? '' : String(valor) // texto inválido nunca apaga nem grava
      return
    }
    if (v != null && valor == null && cargaSuspeita(v, referencia)) {
      setConferir(v) // não grava ainda: "Está certo" grava, "Corrigir" limpa o campo
      return
    }
    onSalvar(v)
    if (v !== valor) {
      setSalvo(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setSalvo(false), 1000)
    }
  }
  return (
    <div className={`relative ${className}`}>
    <input
      ref={campoRef}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      key={valor ?? 'vazio'}
      defaultValue={valor ?? ''}
      disabled={disabled}
      placeholder={placeholder == null ? undefined : String(placeholder)}
      onFocus={() => setConferir(null)}
      onChange={() => setConferir(null)}
      onBlur={(e) => commit(e.target)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-center font-display text-base font-bold text-slate-100 outline-none focus:border-marca-500 disabled:opacity-50`}
    />
    {conferir != null && (
      <div role="alert" className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-amber-500/60 bg-slate-900 p-2 text-left text-xs text-slate-200 shadow-lg">
        <p>Confere? {fmt(conferir)} kg está bem diferente de {referencia != null ? fmt(referencia) : '—'} kg.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="min-h-9 flex-1 rounded bg-marca-500 px-2 font-semibold text-white"
            onClick={() => {
              const v = conferir
              setConferir(null)
              onSalvar(v)
              setSalvo(true)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => setSalvo(false), 1000)
            }}
          >
            Está certo
          </button>
          <button
            type="button"
            className="min-h-9 flex-1 rounded border border-slate-600 px-2 font-semibold"
            onClick={() => {
              setConferir(null)
              if (campoRef.current) campoRef.current.value = ''
              campoRef.current?.focus()
            }}
          >
            Corrigir
          </button>
        </div>
      </div>
    )}
    <AnimatePresence>
      {salvo && (
        <m.span
          aria-label="Salvo"
          role="status"
          className="pointer-events-none absolute -right-1 -top-2 text-xs font-bold text-emerald-400"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: saida }}
          transition={agil}
        >
          <IcCheck className="inline size-3 align-[-1px]" />
        </m.span>
      )}
    </AnimatePresence>
    </div>
  )
}
