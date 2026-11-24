import { useState } from 'react'
import { AVISO_FISIO, METODOS_FISIO, QUEIXAS, REGRAS_FISIO, linkPubmed, opcional, type Nivel, type QueixaId, type Ref } from '../../data/fisio'
import { Aviso, Cartao } from '../../ui'

const SELO: Record<Nivel, string> = {
  ALTO: 'bg-emerald-950 text-emerald-300 ring-emerald-700',
  MODERADO: 'bg-sky-950 text-sky-300 ring-sky-700',
  LIMITROFE: 'bg-amber-950 text-amber-300 ring-amber-700',
}
const TEXTO_NIVEL: Record<Nivel, string> = { ALTO: 'Alto', MODERADO: 'Moderado', LIMITROFE: 'Limítrofe · opcional' }

const Refs = ({ refs }: { refs: Ref[] }) =>
  refs.length > 0 && (
    <p className="mt-2 text-xs text-slate-400">
      {refs.map((r, i) => (
        <span key={r.pmid}>
          {i > 0 && ' · '}
          <a href={linkPubmed(r.pmid)} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">
            {r.autor}
          </a>
        </span>
      ))}
    </p>
  )

export default function GuiaFisio() {
  const [queixa, setQueixa] = useState<QueixaId | null>(null)
  const [semLimitrofe, setSemLimitrofe] = useState(false)
  const lista = METODOS_FISIO.filter((m) => (!queixa || m.queixas.includes(queixa)) && !(semLimitrofe && opcional(m)))
  const chip = (ativo: boolean) =>
    ativo ? 'border-marca-400 bg-marca-500 text-white' : 'border-slate-600 bg-slate-800 text-slate-200'
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold">Métodos Fisioterapia</h1>
      <Aviso>{AVISO_FISIO}</Aviso>

      <div className="my-3 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!queixa} onClick={() => setQueixa(null)} className={`min-h-11 rounded-full border px-4 text-sm ${chip(!queixa)}`}>
          Todas
        </button>
        {QUEIXAS.map((q) => (
          <button key={q.id} type="button" aria-pressed={queixa === q.id} onClick={() => setQueixa(q.id)} className={`min-h-11 rounded-full border px-4 text-sm ${chip(queixa === q.id)}`}>
            {q.rotulo}
          </button>
        ))}
      </div>

      <label className="mb-3 flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" role="switch" checked={semLimitrofe} onChange={(e) => setSemLimitrofe(e.target.checked)} className="size-5" />
        Esconder evidência limítrofe
      </label>

      <details className="mb-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Regras para todos os métodos (R1–R8)</summary>
        <div className="mt-3 space-y-3">
          {REGRAS_FISIO.map((r) => (
            <div key={r.id}>
              <h3 className="text-sm font-semibold">{r.id} · {r.titulo}</h3>
              <p className="text-sm">{r.texto}</p>
              <p className="text-xs text-slate-400">Evidência: {r.evidencia}</p>
              <Refs refs={r.refs} />
            </div>
          ))}
        </div>
      </details>

      <p className="mb-2 text-sm text-slate-400">{lista.length} métodos</p>
      <div className="space-y-3">
        {lista.map((m) => (
          // Hierarquia: título → evidência/queixas → pré-requisito (liberação) → protocolo → observação → sinais de alerta → fontes.
          <Cartao key={m.id}>
            <h2 className="text-lg font-bold leading-snug">
              <span className="text-slate-400">{m.id} ·</span> {m.nome}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${SELO[m.nivel]}`}>{TEXTO_NIVEL[m.nivel]}</span>
              {m.nivelNota && <span className="text-xs text-slate-400">{m.nivelNota}</span>}
            </div>
            <p className="mt-2 text-sm text-slate-400">{m.queixas.map((id) => QUEIXAS.find((q) => q.id === id)?.rotulo).join(' · ')}</p>

            {m.liberacao && (
              <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-3">
                <p className="text-sm font-semibold text-red-200">Exige liberação do médico ou fisioterapeuta</p>
                {m.liberacao !== 'Sempre' && <p className="mt-1.5 text-sm text-red-300">Quando: {m.liberacao}</p>}
              </div>
            )}

            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Protocolo</h3>
              <p className="mt-0.5 text-xs italic text-slate-500">Sugestão inicial — ajustar individualmente</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {m.protocolo.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            {m.ressalva && <p className="mt-4 border-l-2 border-amber-600 pl-3 text-sm text-amber-200">{m.ressalva}</p>}

            <section className="mt-5 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-300">Parar e procurar médico ou fisioterapeuta se:</h3>
              {m.alertaGeral && <p className="mt-1 text-xs text-slate-400">Sinais gerais de perigo (a pesquisa não trouxe sinais específicos).</p>}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {m.encaminharSe.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>

            {m.refs.length > 0 && (
              <footer className="mt-4 border-t border-slate-800 pt-1">
                <Refs refs={m.refs} />
              </footer>
            )}
          </Cartao>
        ))}
      </div>
    </div>
  )
}
