import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Meso, Registros, Slot } from '../../../engine'
import { Aviso, Botao, campoBase, Cartao, Msg } from '../../../ui'
import CampoExercicio from './CampoExercicio'
import SeletorMaquina from '../../catalogo/SeletorMaquina'
import { useMaquinas } from '../../catalogo/useMaquinas'
import type { MaquinaTreino } from '../../../engine/aparelho'
import { ladosDoCadastro } from '../../../lib/catalogoProprio'
import { doisLados, doisLadosPadrao } from '../../../lib/lados'
import { comProgressaoIsometrica, agruparTrocas, aplicarAdicao, aplicarTroca, copiarTreino, grupoTemCarga, moverExercicio, removerExercicio, removerGrupo, semanasComHistorico, trocarExercicio, type GrupoTroca } from './util'


export default function TabDivisao({
  meso,
  registros,
  onAtualizar,
}: {
  meso: Meso
  registros: Registros
  onAtualizar: (patch: Partial<Meso>) => void
}) {
  const maquinas = useMaquinas().lista
  const [aviso, setAviso] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [treinoSel, setTreinoSel] = useState(1)
  const [foco, setFoco] = useState<{ t: number; p: number; para: 'exercicio' | 'treino' | 'ir' } | null>(null)

  // Foca depois do re-render (com o meso já novo), nunca dentro do handler de tecla.
  useEffect(() => {
    if (!foco) return
    const { t, p, para } = foco
    if (para !== 'ir') {
      const tam = meso.divisao[t - 1]?.length ?? 0
      if (para === 'exercicio' && p + 1 <= 10 && p + 1 <= tam + 1) return setFoco({ t, p: p + 1, para: 'ir' })
      if (t >= meso.frequencia) return
      setTreinoSel(t + 1) // mostra o cartão no celular antes de focar
      return setFoco({ t: t + 1, p: Math.min((meso.divisao[t]?.length ?? 0) + 1, 10), para: 'ir' })
    }
    document
      .querySelectorAll(`[data-testid="treino-${t}"] li`)
      [p - 1]?.querySelector<HTMLInputElement>('input[role="combobox"]')
      ?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco])

  function commit(t: number, p: number, nomeBruto: string) {
    const arr = meso.divisao[t - 1] ?? []
    const nome = nomeBruto.trim()

    if (p > arr.length + 1) return

    if (p === arr.length + 1) {
      if (!nome) return
      const divisao = [...meso.divisao]
      divisao[t - 1] = [...arr, { slotId: crypto.randomUUID(), nome, ...ladosDoCadastro(nome) }]
      onAtualizar({ divisao, progressaoExercicio: comProgressaoIsometrica(meso, divisao) })
      return
    }

    const atual = arr[p - 1]
    if (!nome) {
      if (semanasComHistorico(meso, registros, t, p).length && !confirm('Este exercício já tem cargas registradas. Elas ficam guardadas, mas deixam de aparecer. Continuar?')) return
      onAtualizar(removerExercicio(meso, t, p))
      return
    }

    if (nome === atual.nome) return

    const { divisao, trocas, preservou, progressaoExercicio } = trocarExercicio(meso, registros, t, p, nome)
    onAtualizar({ divisao, trocas, progressaoExercicio })
    if (preservou) {
      setAviso(
        `"${atual.nome}" foi trocado por "${nome}" no treino ${t}, posição ${p}. As semanas já com carga registrada continuam mostrando "${atual.nome}".`,
      )
    }
  }

  // Arrastar pela alça (dedo ou mouse): o item segue o dedo, os outros abrem espaço; solta = muda a ordem.
  // Medidas na página (não na tela): `meios` = meio de cada item no começo, para a rolagem e os deslocamentos
  // não confundirem a conta. Perto da borda (em cima, ou embaixo sobre a barra de abas) a tela rola sozinha.
  const [arrasto, setArrasto] = useState<{ t: number; de: number; para: number; y0: number; dy: number; h: number; meios: number[] } | null>(null)
  const dedoY = useRef(0)
  const itens = (t: number) => [...document.querySelectorAll<HTMLElement>(`[data-testid="treino-${t}"] li[data-slot]`)]

  function iniciarArrasto(e: PointerEvent<HTMLButtonElement>, t: number, p: number) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dedoY.current = e.clientY
    const meios = itens(t).map((li) => {
      const r = li.getBoundingClientRect()
      return r.top + scrollY + r.height / 2
    })
    setArrasto({ t, de: p, para: p, y0: e.clientY + scrollY, dy: 0, h: e.currentTarget.closest('li')!.offsetHeight, meios })
  }

  // Posição nova = 1 + quantos outros itens têm o meio acima do dedo.
  const seguirDedo = () =>
    setArrasto((a) => {
      if (!a) return a
      const y = dedoY.current + scrollY
      return { ...a, dy: y - a.y0, para: 1 + a.meios.filter((m, i) => i !== a.de - 1 && m < y).length }
    })

  function moverArrasto(e: PointerEvent) {
    if (!arrasto) return
    dedoY.current = e.clientY
    seguirDedo()
  }

  const arrastando = arrasto != null
  useEffect(() => {
    if (!arrastando) return
    let id = 0
    const passo = () => {
      const y = dedoY.current
      const v = y < 100 ? -12 : y > innerHeight - 130 ? 12 : 0
      if (v) {
        scrollBy(0, v)
        seguirDedo()
      }
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando])

  function soltarArrasto() {
    if (arrasto && arrasto.para !== arrasto.de) onAtualizar(moverExercicio(meso, arrasto.t, arrasto.de, arrasto.para))
    setArrasto(null)
  }

  // Quanto um item que não está sendo arrastado desce (+) ou sobe (−) para abrir espaço.
  function desloc(t: number, p: number) {
    if (!arrasto || arrasto.t !== t || p === arrasto.de) return 0
    const { de, para, h } = arrasto
    if (de < para && p > de && p <= para) return -h
    if (para < de && p >= para && p < de) return h
    return 0
  }

  // Teclado: seta para cima/baixo na alça move uma casa e mantém o foco nela.
  function teclaAlca(e: KeyboardEvent, t: number, p: number) {
    const para = e.key === 'ArrowUp' ? p - 1 : e.key === 'ArrowDown' ? p + 1 : 0
    if (!para || para > (meso.divisao[t - 1]?.length ?? 0)) return
    e.preventDefault()
    onAtualizar(moverExercicio(meso, t, p, para))
    requestAnimationFrame(() => itens(t)[para - 1]?.querySelector<HTMLButtonElement>('button[data-alca]')?.focus())
  }

  function mudarPausa(t: number, p: number, v: string) {
    const slot = meso.divisao[t - 1]?.[p - 1]
    const n = v.trim() === '' ? undefined : Math.max(0, Math.round(Number(v)))
    if (!slot || n === slot.pausaS || (n !== undefined && Number.isNaN(n))) return
    const { pausaS: _, ...resto } = slot
    const divisao = [...meso.divisao]
    divisao[t - 1] = meso.divisao[t - 1].map((x, i) => (i === p - 1 ? (n === undefined ? resto : { ...resto, pausaS: n }) : x))
    onAtualizar({ divisao })
  }

  // Só grava quando difere do catálogo; voltar ao padrão remove o campo.
  function mudarLados(t: number, p: number, v: boolean) {
    const slot = meso.divisao[t - 1]?.[p - 1]
    if (!slot) return
    const { doisLados: _, ...resto } = slot
    const divisao = [...meso.divisao]
    divisao[t - 1] = meso.divisao[t - 1].map((x, i) => (i === p - 1 ? (v === doisLadosPadrao(slot.nome) ? resto : { ...resto, doisLados: v }) : x))
    onAtualizar({ divisao })
  }

  // Máquina do exercício (#261): vale para as próximas vezes que o aluno abrir o treino. Treino já iniciado guarda a
  // própria cópia (prescricaoRegistrada), então trocar aqui não muda o histórico.
  function mudarMaquina(t: number, p: number, m: MaquinaTreino | null) {
    const slot = meso.divisao[t - 1]?.[p - 1]
    if (!slot) return
    const { maquina: _, ...resto } = slot
    const divisao = [...meso.divisao]
    divisao[t - 1] = meso.divisao[t - 1].map((x, i) => (i === p - 1 ? (m ? { ...resto, maquina: m } : resto) : x))
    onAtualizar({ divisao })
  }

  const treinos = Array.from({ length: meso.frequencia }, (_, i) => i + 1)
  const posicoes = Array.from({ length: 10 }, (_, i) => i + 1)

  function copiar(de: number, t: number) {
    const dest = meso.divisao[t - 1] ?? []
    if (dest.some((_, i) => semanasComHistorico(meso, registros, t, i + 1).length)) {
      setHint(`O Treino ${t} já tem cargas registradas. Para não perder nada, troque os exercícios um a um.`)
      return
    }
    if (dest.length && !window.confirm(`Trocar os exercícios do Treino ${t} pelos do Treino ${de}? Os métodos do Treino ${t} também serão trocados.`)) return
    setHint(null)
    onAtualizar(copiarTreino(meso, de, t))
  }

  const sel = Math.min(treinoSel, meso.frequencia)

  // Cartão de um treino: usado em grade (md+) e sozinho (celular).
  function cartaoTreino(t: number) {
    const arr = meso.divisao[t - 1] ?? []
    return (
      <div key={t} data-testid={`treino-${t}`} className={`relative rounded-lg border border-slate-800 bg-slate-950 text-sm ${t === sel ? '' : 'hidden @2xl:block'}`}>
        <p className="border-b border-slate-800 px-3 py-3 font-semibold">Treino {t}</p>
        <ul className="divide-y divide-slate-800">
          {posicoes.map((p) => {
            if (p > arr.length + 1) return null
            const slot = arr[p - 1]
            const esteArrastado = arrasto?.t === t && arrasto.de === p
            return (
              <li
                key={slot?.slotId ?? `novo-${p}`}
                data-slot={slot ? '' : undefined}
                style={slot && arrasto?.t === t ? { transform: `translateY(${esteArrastado ? arrasto.dy : desloc(t, p)}px)` } : undefined}
                className={`flex flex-wrap items-center gap-2 px-3 py-2 ${esteArrastado ? 'relative z-10 rounded-lg bg-slate-800 shadow-lg ring-1 ring-marca-500' : arrasto?.t === t ? 'transition-transform' : ''}`}
              >
                {slot ? (
                  <button
                    type="button"
                    data-alca
                    aria-label={`Arrastar para mudar a ordem, posição ${p}`}
                    title="Arraste para mudar a ordem (ou use as setas)"
                    onPointerDown={(e) => iniciarArrasto(e, t, p)}
                    onPointerMove={moverArrasto}
                    onPointerUp={soltarArrasto}
                    onPointerCancel={() => setArrasto(null)}
                    onKeyDown={(e) => teclaAlca(e, t, p)}
                    className="-ml-2 grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-lg text-slate-500 hover:text-slate-200 active:cursor-grabbing"
                  >
                    ⠿
                  </button>
                ) : (
                  <span className="-ml-2 h-11 w-8 shrink-0" />
                )}
                <span className="w-4 shrink-0 text-slate-500">{p}</span>
                <CampoExercicio
                  key={slot?.slotId ?? `novo-${t}-${p}`}
                  inicial={slot?.nome ?? ''}
                  placeholder={p === arr.length + 1 ? 'Adicionar…' : ''}
                  onConfirmar={(nome) => commit(t, p, nome)}
                  onAvancar={(para) => setFoco({ t, p, para })}
                  className="flex-1"
                />
                {slot && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={`Pausa em segundos, posição ${p}`}
                    placeholder={String(p <= 2 ? (meso.pausaPrincipaisS ?? meso.pausaS) : meso.pausaS)}
                    defaultValue={slot.pausaS ?? ''}
                    key={`${slot.slotId}-${slot.pausaS ?? ''}`}
                    onBlur={(e) => mudarPausa(t, p, e.target.value)}
                    className={`${campoBase} w-20 shrink-0 px-2 py-2 text-center outline-none focus:border-marca-500`}
                  />
                )}
                {slot && <SeletorMaquina nome={slot.nome} atual={slot.maquina} maquinas={maquinas} mudar={(m) => mudarMaquina(t, p, m)} className="basis-full pl-[3.5rem]" />}
                {slot && (
                  <div className="flex basis-full items-center justify-between gap-2 pl-[3.5rem]">
                    <label className="flex min-h-11 items-center gap-2 text-xs text-slate-400">
                      <input type="checkbox" checked={doisLados(slot)} onChange={(e) => mudarLados(t, p, e.target.checked)} className="size-5" />
                      2 lados (2 halteres / articulado)
                    </label>
                    <button type="button" aria-label={`Excluir exercício, posição ${p}`} onClick={() => commit(t, p, '')} className="min-h-11 shrink-0 px-2 text-xs text-slate-500 hover:text-red-400">
                      Excluir
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="absolute right-2 top-1.5">
          {treinos.some((o) => o !== t && meso.divisao[o - 1]?.length) && (
            <select
              aria-label={`Copiar outro treino para o Treino ${t}`}
              value=""
              onChange={(e) => e.target.value && copiar(Number(e.target.value), t)}
              className={`${campoBase} px-2 py-0.5`}
            >
              <option value="">Copiar de…</option>
              {treinos.filter((o) => o !== t && meso.divisao[o - 1]?.length).map((o) => (
                <option key={o} value={o}>
                  Treino {o}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Msg>{aviso && <Aviso>{aviso}</Aviso>}</Msg>
      <Cartao>
        <div className="mb-3 flex gap-2 overflow-x-auto @2xl:hidden">
          {treinos.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTreinoSel(t)}
              className={`min-h-11 shrink-0 rounded-lg border border-slate-600 px-3 text-sm font-semibold ${sel === t ? 'bg-marca-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Treino {t}
            </button>
          ))}
        </div>
        <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">{treinos.map(cartaoTreino)}</div>
        <p className="mt-3 text-xs text-slate-400">⠿ Arraste para mudar a ordem · Tab: próximo exercício · Enter no campo vazio: próximo treino · Pausa em branco = pausa do mesociclo.</p>
      </Cartao>
      <Msg>{hint && <Aviso>{hint}</Aviso>}</Msg>
      <TrocasEAdicoes meso={meso} registros={registros} onAtualizar={onAtualizar} />
    </div>
  )
}

function TrocasEAdicoes({ meso, registros, onAtualizar }: { meso: Meso; registros: Registros; onAtualizar: (patch: Partial<Meso>) => void }) {
  const [tipo, setTipo] = useState<'troca' | 'adicao'>('troca')
  const [treino, setTreino] = useState(1)
  const [pos, setPos] = useState(1)
  const [de, setDe] = useState(1)
  const [ate, setAte] = useState(1)
  const [nome, setNome] = useState('')
  const [chaveCampo, setChaveCampo] = useState(0)
  const divisaoTreino = meso.divisao[treino - 1] ?? []
  const semPosicao = tipo === 'troca' && divisaoTreino.length === 0 // treino vazio: nada para trocar

  function mudarDe(v: number) {
    setDe(v)
    if (ate < v) setAte(v)
  }

  function salvar() {
    if (!nome.trim() || semPosicao) return
    // Semanas ou dias podem ter diminuído depois da escolha: grava só dentro do meso.
    const t = Math.min(treino, meso.frequencia)
    const a = Math.min(ate, meso.semanas)
    const d = Math.min(de, a)
    const slot = { slotId: crypto.randomUUID(), nome: nome.trim(), ...ladosDoCadastro(nome) }
    if (tipo === 'troca') {
      const escondeCarga = Array.from({ length: a - d + 1 }, (_, i) => d + i).some((w) => {
        const antiga = meso.trocas?.[`${w}-${t}-${pos}`]
        return antiga && registros[`${w}-${t}`]?.[antiga.slotId]?.some((c) => c != null)
      })
      if (escondeCarga && !confirm('Uma troca anterior nessas semanas já tem cargas registradas. Elas ficam guardadas, mas deixam de aparecer. Continuar?')) return
      onAtualizar({ trocas: aplicarTroca(meso, t, pos, d, a, slot) })
    } else onAtualizar({ adicoes: aplicarAdicao(meso, t, d, a, slot) })
    setNome('')
    setChaveCampo((k) => k + 1)
  }

  function remover(g: GrupoTroca) {
    if (grupoTemCarga(g, registros) && !confirm('Este exercício já tem cargas registradas. Elas ficam guardadas, mas deixam de aparecer. Continuar?')) return
    onAtualizar(removerGrupo(meso, g))
  }

  const grupos = agruparTrocas(meso)
  const botaoTipo = (v: 'troca' | 'adicao', texto: string) => (
    <Botao tipo={tipo === v ? 'primario' : 'secundario'} className="flex-1" aria-pressed={tipo === v} onClick={() => setTipo(v)}>
      {texto}
    </Botao>
  )

  return (
    <Cartao className="space-y-3">
      <h3 className="font-semibold">Trocas e adições</h3>
      <p className="text-sm text-slate-400">Troque ou acrescente um exercício só em algumas semanas. Os acrescentados entram no fim do treino.</p>
      <ul className="space-y-1 text-sm">
        {grupos.map((g) => {
          const semanas = g.de === g.ate ? `Semana ${g.de}` : `Semanas ${g.de}–${g.ate}`
          const antes = meso.divisao[g.t - 1]?.[g.p - 1]?.nome ?? '?'
          return (
            <li key={`${g.tipo}-${g.t}-${g.p}-${g.slot.slotId}-${g.de}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2">
              <span className="min-w-0">
                {g.tipo === 'troca' ? `Treino ${g.t} · Pos. ${g.p}: ${antes} → ` : `Treino ${g.t} · + `}
                <b className="text-base">{g.slot.nome}</b>
                <span className="block text-slate-400">{semanas}</span>
              </span>
              <Botao tipo="perigo" onClick={() => remover(g)}>
                Remover
              </Botao>
            </li>
          )
        })}
        {grupos.length === 0 && <li className="text-slate-500">Nenhuma troca ou adição.</li>}
      </ul>
      <div className="flex gap-2">
        {botaoTipo('troca', 'Trocar exercício')}
        {botaoTipo('adicao', 'Adicionar exercício')}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Seletor rotulo="Treino" valor={treino} max={meso.frequencia} onChange={(v) => { setTreino(v); setPos(1) }} />
        {tipo === 'troca' && (
          <Seletor
            rotulo="Posição"
            valor={pos}
            max={Math.max(1, divisaoTreino.length)}
            texto={(n) => (divisaoTreino[n - 1] ? `${n} · ${divisaoTreino[n - 1].nome}` : String(n))}
            onChange={setPos}
          />
        )}
        <label className="flex w-full flex-col gap-1 text-sm @2xl:w-auto">
          <span className="text-slate-400">{tipo === 'troca' ? 'Exercício novo' : 'Exercício'}</span>
          <CampoExercicio key={chaveCampo} onTexto={setNome} className="w-full @2xl:w-72" />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Seletor rotulo="Semana de" valor={de} max={meso.semanas} onChange={mudarDe} />
        <Seletor rotulo="até" valor={ate} max={meso.semanas} onChange={(v) => setAte(Math.max(v, de))} />
        <Botao onClick={() => setAte(meso.semanas)}>
          Até o fim
        </Botao>
        <Botao tipo="primario" disabled={semPosicao} onClick={salvar}>
          {tipo === 'troca' ? 'Salvar troca' : 'Adicionar'}
        </Botao>
      </div>
    </Cartao>
  )
}

function Seletor({ rotulo, valor, max, onChange, texto }: { rotulo: string; valor: number; max: number; onChange: (v: number) => void; texto?: (n: number) => string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-slate-400">{rotulo}</span>
      <select value={valor} onChange={(e) => onChange(Number(e.target.value))} className={`${campoBase} min-h-11 max-w-full px-2 py-2`}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {texto ? texto(n) : n}
          </option>
        ))}
      </select>
    </label>
  )
}
