import '../../aluno/treino.css'
import { Fragment } from 'react'
import { isometrico, prescreverSessao, type Meso, type Metodo } from '../../../engine'
import { COR_METODO, metodoDoRotulo } from '../../../data/metodos'
import { IcInfo, IcPlay, IcSino, IcVoltar } from '../../../icones'
import { acimaDoLimite, fmtMin } from '../../../lib/tempo'
import { ordemExibicao } from '../../../lib/exibicaoTreino'
import { seriesDoRotulo } from '../../../lib/metodoSeries'
import { doisLados } from '../../../lib/lados'
import { corpoEhCarga } from '../../../lib/pesoCorporal'
import { classesBotao } from '../../../ui'
import { fmtData } from '../semana/format'
import IconeMetodo from '../../metodos/IconeMetodo'

// Campo de carga/reps como na tela do aluno (LoadInput), só para ver: nada grava.
const campo = (placeholder: string | number | null | undefined, rotulo: string) => (
  <input
    type="text"
    inputMode="decimal"
    readOnly
    tabIndex={-1}
    aria-label={rotulo}
    placeholder={placeholder == null ? undefined : String(placeholder)}
    className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-center font-display text-base font-bold text-slate-100 outline-none"
  />
)

// Prévia do treino como o aluno vê (aluno/Treino.tsx antes de "Iniciar treino"), montada do meso que está sendo editado:
// muda a cada edição, sem salvar. É inerte: nenhum botão ou campo responde (não grava nada nem abre nada).
export function sessaoSegura(meso: Meso, semana: number, treino: number) {
  try {
    return prescreverSessao(meso, semana, treino)
  } catch {
    return null // meso no meio da edição (ex.: início vazio): a prévia espera, o editor segue
  }
}

export default function PreviaAluno({ meso, semana, treino }: { meso: Meso; semana: number; treino: number }) {
  const sessao = sessaoSegura(meso, semana, treino)
  if (!sessao) return <p className="p-4 text-sm text-slate-400">Sem treino para mostrar nesta semana.</p>
  const vermelho = acimaDoLimite(sessao.tempoMin, meso.tempoLimiteMin)
  const itens = ordemExibicao(meso, semana, treino, sessao)

  return (
    <div inert className="treino-pagina select-none" aria-label={`Prévia: Treino ${treino} da semana ${semana}, como o aluno vê`}>
      <div className="px-4 pb-6 pt-4">
        <div className="mb-3 flex min-h-11 items-center gap-2 text-slate-300">
          <IcVoltar className="size-5" /> <span className="text-sm">Voltar</span>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Treino {treino}</h2>
            <p className="text-xs text-slate-400">
              Semana {semana} · pausa {meso.pausaPrincipaisS != null && meso.pausaPrincipaisS !== meso.pausaS ? `${meso.pausaPrincipaisS}s/${meso.pausaS}` : sessao.pausaS}s
              {sessao.inicioSemana && !Number.isNaN(Date.parse(sessao.inicioSemana)) && <> · início {fmtData(sessao.inicioSemana)}</>}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 font-display text-lg font-bold ${vermelho ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-100'}`}>{fmtMin(sessao.tempoMin)}</span>
        </div>

        <div className={classesBotao('primario', 'lg', 'mb-3 flex w-full items-center justify-center gap-2 shadow-lg shadow-marca-500/40')}>
          <IcPlay className="size-5" /> Iniciar treino
        </div>
        <p className="mb-3 text-sm text-amber-300">Toque em Iniciar treino para anotar as cargas.</p>

        {!itens.length && <p className="text-sm text-slate-400">Nenhum exercício neste treino.</p>}
        <div className="space-y-4">
          {itens.map(({ e, grupo, ordem, tamanho, letra }) => {
            const gc = grupo ? COR_METODO[grupo.split('|')[0] as Metodo] : undefined
            const iso = isometrico(e.slot)
            const dois = doisLados(e.slot)
            const partes = e.rotulo ? e.rotulo.split('; ').map((p) => ({ p, mt: metodoDoRotulo(p) })) : []
            const dropsDa = (s: number) => e.drops.flatMap((d, j) => (d.serie === s ? [e.n + j] : []))
            const soltos = e.drops.flatMap((d, j) => (d.serie >= 1 && d.serie <= e.n ? [] : [e.n + j]))
            const linha = (k: number) => {
              const dropStage = k >= e.n
              const rotuloCol = dropStage ? `D${e.drops[k - e.n]?.etapa ?? k - e.n + 1}` : `S${k + 1}`
              const cores = [...new Set(partes.filter(({ p, mt }) => mt && (dropStage ? mt === 'Dropset' : seriesDoRotulo(p, e.n).includes(k + 1))).map(({ mt }) => mt!))]
              return (
                <div key={k} className={`relative grid grid-cols-[1.75rem_3.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 ${dropStage ? 'pl-6' : e.rotulo ? 'pl-3' : ''}`}>
                  {cores.length > 0 && (
                    <span aria-hidden className="absolute inset-y-0 left-0 flex gap-0.5">
                      {cores.map((c) => <span key={c} className={`w-1 rounded-full ${COR_METODO[c].faixa}`} />)}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-400">{rotuloCol}</span>
                  <span className="truncate text-xs text-slate-400">{e.reps[k]} {iso ? 's' : 'reps'}</span>
                  {campo(dropStage ? e.cargaSugerida[k] : null, `${e.slot.nome}, ${rotuloCol}, carga`)}
                  <span className="text-xs text-slate-600">{dois ? 'kg/lado' : 'kg'}</span>
                  {campo(e.reps[k], `${e.slot.nome}, ${rotuloCol}, ${iso ? 'segundos feitos' : 'repetições feitas'}`)}
                  <span className="text-xs text-slate-600">{iso ? 's feitos' : 'feitas'}</span>
                </div>
              )
            }
            return (
              <div key={e.slot.slotId} className={`relative rounded-xl border p-4 ${gc ? gc.borda : 'border-slate-700/70'}`} data-treino-cartao>
                {grupo && ordem > 0 && <span aria-hidden className={`absolute -top-4 left-6 h-4 w-0.5 ${gc?.faixa}`} />}
                {grupo && (
                  <div className={`mb-2 text-xs font-semibold ${gc?.texto}`}>
                    {grupo.split('|')[0]}{' '}
                    {Array.from({ length: tamanho }, (_, k) => <span key={k}>{k > 0 && ' / '}<span className={k === ordem ? 'text-slate-100' : ''}>{letra}{k + 1}</span></span>)}
                  </div>
                )}
                <div className="mb-3 space-y-2.5">
                  <div className="break-words text-base font-semibold leading-snug tracking-tight">{e.slot.nome || <span className="text-slate-500">(exercício sem nome)</span>}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {partes.length > 0 && (
                      <div className="flex min-w-0 flex-wrap gap-2">
                        {partes.map(({ p, mt }, ip) => (
                          <span key={`${ip}-${p}`} className={`inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${mt ? COR_METODO[mt].selo : 'bg-slate-700 text-slate-100 ring-slate-500'}`}>
                            {mt && <IconeMetodo metodo={mt} tamanho={20} />}
                            <span>{p}</span> <IcInfo className="size-3.5 shrink-0" />
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button type="button" tabIndex={-1} aria-label="Som do cronômetro" className={classesBotao('secundario', 'md', 'inline-flex min-w-11 items-center justify-center')}><IcSino className="size-5" /></button>
                      {(!grupo || ordem === tamanho - 1) && (
                        <button type="button" tabIndex={-1} className={classesBotao('secundario', 'md', 'inline-flex items-center gap-1')}><IcPlay className="size-4" /> {e.pausaS} s</button>
                      )}
                    </div>
                  </div>
                </div>
                {e.folgaPolimento != null && <p className="text-sm text-marca-300">Polimento: encerre a série quando sentir que ainda faria cerca de {e.folgaPolimento} {e.folgaPolimento === 1 ? 'repetição boa' : 'repetições boas'}.</p>}
                <div className="mb-3 inline-flex items-center gap-1.5 px-2 text-sm text-slate-400">+ Anotação</div>
                {iso && <p className="mb-2 text-xs text-slate-400">Tempo em segundos. Cronometre cada série e anote os segundos feitos. Carga opcional.</p>}
                {dois && <p className="mb-2 text-xs text-slate-400">Anote os kg de cada lado (o app soma os dois).</p>}
                <div className="space-y-2">
                  {Array.from({ length: e.n }, (_, k) => {
                    const cols = dropsDa(k + 1)
                    return (
                      <Fragment key={k}>
                        {linha(k)}
                        {/* No aluno o drop abre por toque; na prévia fica aberto para o coach ver as etapas. */}
                        {cols.length > 0 && (
                          <div className={`ml-6 flex min-h-9 w-fit items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 ${COR_METODO.Dropset.selo}`}>
                            <IconeMetodo metodo="Dropset" tamanho={16} />
                            Drop da S{k + 1} · {cols.length} {cols.length === 1 ? 'etapa' : 'etapas'}
                          </div>
                        )}
                        {cols.map(linha)}
                      </Fragment>
                    )
                  })}
                  {soltos.map(linha)}
                </div>
                <div className="mt-4 flex min-h-11 items-start gap-2.5 rounded-xl border border-slate-700/70 bg-slate-950/30 px-3 py-3 text-sm text-slate-200">
                  <input type="checkbox" readOnly tabIndex={-1} checked={corpoEhCarga(e.slot.nome)} className="mt-0.5 h-5 w-5 shrink-0" aria-label="Feito com o peso do corpo" />
                  <span><b>Feito com o peso do corpo</b></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
