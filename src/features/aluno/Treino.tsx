import './treino.css'
import { textoNota } from '../../lib/notas'
import { collection, doc, query, where } from 'firebase/firestore'
import { AnimatePresence, animate, m, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { contagem, elastico, saida, suave } from '../../movimento'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { copiaVazia, isometrico, metricasSessao, metodosDaSessao, prescreverSessao, type Cargas, type ExercicioPrescrito, type Meso, type Metodo } from '../../engine'
import { COR_METODO, METODOS, metodoDoRotulo } from '../../data/metodos'
import { limparTreino, marcarTreino } from '../../lib/inatividade'
import { mmss, useContagemDescanso, useDescanso, type ContagemDescanso } from '../../lib/descanso'
import { avisarCoach } from '../../lib/push'
import { dispensarNota, notaDispensada } from '../../lib/notasMetodo'
import { seriesDoRotulo } from '../../lib/metodoSeries'
import RelatarDor from '../fisio/RelatarDor'
import ConteudoMetodo from '../fisio/ConteudoMetodo'
import BotaoSinal from '../fisio/BotaoSinal'
import { useOrientacoes } from '../fisio/useOrientacoes'
import { metodoFisio, metodoLiberavel, orientacoesDoExercicio, type OrientacaoFisio } from '../../lib/fisio'
import IconeMetodo from '../metodos/IconeMetodo'
import AvisoNotificacoes from './AvisoNotificacoes'
import FimTreino from './FimTreino'
import { cancelarTreino, marcarInicio, marcarRealizado, reabrirTreino, registrarCarga, registrarCargaLados, registrarPc, registrarReps, salvarNota, salvarPeso } from '../../lib/acoes'
import { duracaoTreino, fimDaSessao, TETO_TREINO_MS } from '../../lib/resumo'
import { diaSP, type Usuario } from '../../lib/acesso'
import { corpoEhCarga, fracaoPC, preencherCorpo, rebasear } from '../../lib/pesoCorporal'
import { docParaCargas, docParaMeso, docsParaLados, docsParaRegistros, docsParaRegistrosReps, docsParaRegistrosRir, lerPc, type MesoSalvo, type NotasDoc, type RegistroDoc } from '../../lib/conversores'
import { comPrescricoesRegistradas, lerPrescricaoRegistrada } from '../../lib/prescricaoRegistrada'
import { db } from '../../lib/firebase'
import { useAnamnese } from '../anamnese/useAnamnese'
import { TEXTO_SEM_INTERNET, useDoc, useLista, useSemInternet, useUsuarioAtual } from '../../lib/hooks'
import { historicoExercicios, recordeAnterior, resumoTreino, type RegistroEvolucao } from '../../lib/evolucao'
import { ehRecorde } from '../../lib/recorde'
import { cargaAnterior, semanaAtual, type Fonte } from '../../lib/treino'
import { modelosPorExercicio } from '../../lib/rmPessoal'
import { cargaVolta, comVolta, semanaDeVolta, travado as travadoAgenda } from '../../lib/agenda'
import { confirmarExclusao, dataDaNota, msDaNota } from '../../lib/notas'
import { IcCadeado, IcCheck, IcInfo, IcLapis, IcLixeira, IcMais, IcPausa, IcPlay, IcReiniciar, IcSino, IcSinoMudo, IcVoltar } from '../../icones'
import { ir, voltar } from '../../rota'
import { Botao, classesBotao, cascata, Centro, item, Modal, Painel, sobe, useDepoisDaEntrada, useMontou, mexe } from '../../ui'
import { BrilhoBorda } from '../../vidro'
import { BotaoVoltar } from '../../voltar'
import { acimaDoLimite, fmtMin } from '../../lib/tempo'
import { fmt, fmtData } from '../coach/semana/format'
import LoadInput from '../coach/semana/LoadInput'
import CampoLados, { BotaoLadosDiferentes } from '../coach/semana/CampoLados'
import { doisLados, ladosDiferentes, lerCelula } from '../../lib/lados'
import { AdicionarExercicio, EditarExercicio, FaixaAjustado } from '../coach/presencial/EditarTreino'
import AvisoEstimativaRm from './AvisoEstimativaRm'
import { textosVoz, useTextosVoz, VozTreino, type Voz } from './voz'
import PerguntaRir from './PerguntaRir'
import { FaixaPolimento, SeloPolimento } from './Polimento'
import { escopoPolimento, mudancasPolimento, prescricaoNormal, resumoPolimento, semanaDePolimento } from '../../lib/polimentoAluno'

type RegistroFlag = RegistroDoc & { realizado?: boolean; inicioEm?: unknown; realizadoEm?: { toMillis(): number } | null; pc?: Record<string, number> }

// Cartão "Novidades": só nas 2 primeiras aberturas (contador no localStorage; sem ele, aparece sempre).
const CHAVE_NOVIDADES = 'forca-novidades-pc'
function Novidades() {
  const [ver, setVer] = useState(() => {
    try {
      const n = Number(localStorage.getItem(CHAVE_NOVIDADES) ?? 0)
      if (n >= 2) return false
      localStorage.setItem(CHAVE_NOVIDADES, String(n + 1))
    } catch {
      /* sem armazenamento: mostra */
    }
    return true
  })
  const fechar = () => {
    try {
      localStorage.setItem(CHAVE_NOVIDADES, '2')
    } catch {
      /* ignora */
    }
    setVer(false)
  }
  return (
    <Painel aberto={ver}>
    <div className="mb-4 rounded-2xl border border-marca-400/60 bg-gradient-to-br from-marca-500/30 to-marca-700/10 p-4 text-sm shadow-lg shadow-marca-500/20">
      <div className="mb-3 flex items-center gap-2 text-base font-bold text-white">
        <span className="grid size-8 place-items-center rounded-full bg-marca-500"><IcInfo className="size-4" /></span>
        Novidades
      </div>
      <ul className="mb-4 space-y-2 text-slate-100">
        {[
          'Anotação em cada exercício',
          'Feito com o peso do corpo: já vem marcado na barra fixa e na flexão; nos campos, anote só o peso extra',
          'Número cinza = carga da semana passada',
          'Treino do dia em destaque na tela Hoje',
        ].map((t) => (
          <li key={t} className="flex gap-2"><IcCheck className="mt-0.5 size-4 shrink-0 text-marca-300" />{t}</li>
        ))}
      </ul>
      <Botao tipo="primario" tamanho="lg" className="w-full" onClick={fechar}>Entendi</Botao>
    </div>
    </Painel>
  )
}

const METODOS_SEQUENCIA = /Biset|Triset|Superset|Circuito/
// Explicação de um método (toque no selo): sempre abre.
function ExplicacaoMetodo({ metodo, fechar }: { metodo: Metodo; fechar: () => void }) {
  const t = METODOS[metodo]
  return (
    <Modal rotulo={`Como fazer ${metodo}`}>
      <div className={`mb-3 flex items-center gap-3 ${COR_METODO[metodo].texto}`}>
        <IconeMetodo metodo={metodo} tamanho={48} />
        <h2 className="text-lg font-bold text-slate-100">{metodo}</h2>
      </div>
      <h3 className="mb-1 text-sm font-semibold">Como fazer</h3>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
        {t.comoFazer.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      {t.dica && <p className="mb-3 text-sm text-slate-400">Dica: {t.dica}</p>}
      <a href="#/metodos" className="mb-4 block text-sm text-marca-500 underline">
        Ver todos os métodos
      </a>
      <Botao tipo="primario" tamanho="lg" className="w-full" onClick={fechar}>
        Fechar
      </Botao>
    </Modal>
  )
}

// Nota ao abrir o treino: uma só, com os métodos ainda não dispensados.
function NotaMetodos({ metodos }: { metodos: Metodo[] }) {
  const [ver, setVer] = useState(() => metodos.length > 0)
  return (
    <AnimatePresence>
      {ver && (
        <Modal rotulo="Métodos deste treino">
          <h2 className="mb-3 text-lg font-bold">Métodos deste treino</h2>
          <div className="mb-3 space-y-3">
            {metodos.map((x) => (
              <div key={x} className={`flex gap-3 ${COR_METODO[x].texto}`}>
                <IconeMetodo metodo={x} tamanho={40} />
                <div className="min-w-0 text-sm text-slate-300">
                  <div className="font-bold text-slate-100">{x}</div>
                  {METODOS[x].comoFazer.join(' ')}
                </div>
              </div>
            ))}
          </div>
          <p className="mb-4 text-xs text-slate-400">Toque no selo colorido do exercício para ver esta explicação de novo.</p>
          <div className="flex flex-col gap-2">
            <Botao tipo="primario" tamanho="lg" className="w-full" onClick={() => setVer(false)}>
              Entendi
            </Botao>
            <Botao
              tipo="fantasma"
              className="w-full"
              onClick={() => {
                metodos.forEach(dispensarNota)
                setVer(false)
              }}
            >
              Não mostrar de novo
            </Botao>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}

function AvisoAdaptado({ chave }: { chave: string }) {
  const t = useTextosVoz()
  const [ver, setVer] = useState(() => {
    try {
      return localStorage.getItem(chave) !== '1'
    } catch {
      return true
    }
  })
  const fechar = () => {
    try {
      localStorage.setItem(chave, '1')
    } catch {
      /* ignora */
    }
    setVer(false)
  }
  return (
    <AnimatePresence>
      {ver && (
        <m.div
          role="dialog"
          aria-label="Treino adaptado"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: saida }}
          transition={suave}
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4"
        >
          <m.div
            initial={{ ...mexe('translateY(48px)'), opacity: 0 }}
            animate={sobe}
            exit={{ ...mexe('translateY(48px)'), opacity: 0, transition: saida }}
            transition={suave}
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5"
          >
            <p className="mb-4 text-sm text-slate-300">{t.adaptado}</p>
            <Botao tipo="primario" tamanho="lg" className="w-full" onClick={fechar}>
              Entendi
            </Botao>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

function Nota({ uid, nome, texto, em }: { uid: string; nome: string; texto: string; em?: number }) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const montou = useMontou()
  const conteudo = editando ? (
      <div className="mb-2">
        <textarea
          autoFocus
          maxLength={300}
          rows={3}
          value={rascunho}
          onChange={(ev) => setRascunho(ev.target.value)}
          placeholder="Ex.: banco na posição 3, aparelho Life"
          aria-label={`Anotação de ${nome}`}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none transition-[border-color,box-shadow] focus:border-marca-500 focus:shadow-[0_0_0_3px_rgba(63,114,166,0.3)]"
        />
        <div className="mt-1 flex gap-2">
          <Botao
            tipo="primario"
            onClick={() => {
              // sem mudança não regrava (a data continua a de quando foi escrita)
              if (rascunho.trim() !== texto) {
                salvarNota(uid, nome, rascunho)
                if (rascunho.trim()) avisarCoach('comentou')
              }
              setEditando(false)
            }}
          >
            Salvar
          </Botao>
          <Botao tipo="fantasma" onClick={() => setEditando(false)}>Cancelar</Botao>
        </div>
      </div>
    ) : null
  const abrir = () => {
    setRascunho(texto)
    setEditando(true)
  }
  const data = dataDaNota(em)
  const fechado = texto ? (
    <div className="mb-3 flex items-start gap-1 border-l-2 border-marca-500/50 pl-3">
      <button onClick={abrir} aria-label={`Editar anotação de ${nome}`} className="flex min-w-0 flex-1 items-start justify-between gap-3 py-1 text-left text-sm text-slate-300">
        <span className="min-w-0">
          <span className="block break-words">{texto}</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">{data}</span>
        </span>
        <IcLapis className="size-4 shrink-0 text-slate-500" />
      </button>
      <button
        onClick={() => confirmarExclusao(nome, texto, data, 'o coach') && salvarNota(uid, nome, '')}
        aria-label={`Excluir anotação de ${nome}`}
        className="-m-1 shrink-0 rounded p-3 text-slate-500 hover:text-red-400"
      >
        <IcLixeira className="size-4" />
      </button>
    </div>
  ) : (
    <Botao tipo="fantasma" onClick={abrir} className="mb-3 inline-flex items-center gap-1.5 !px-2">
      <IcMais className="size-4" /> Anotação
    </Botao>
  )
  return (
    <m.div
      key={editando ? 'e' : 'v'}
      // sem animar altura (travava no iPhone) e troca na hora: só opacidade + deslize ao entrar, como o Painel
      initial={montou ? { opacity: 0, ...mexe('translateY(-8px)') } : false}
      animate={sobe}
      transition={suave}
    >
      {conteudo ?? fechado}
    </m.div>
  )
}

const hms = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const r = `${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  return h ? `${h}:${r}` : r
}

function BotaoDescanso({ contagem, rodando, pausaS, alternar }: {
  contagem?: ContagemDescanso; rodando: boolean; pausaS: number; alternar: () => void
}) {
  const tempo = mmss(useContagemDescanso(contagem))
  return (
    <Botao
      tipo={contagem ? 'primario' : undefined}
      aria-label={contagem ? `${rodando ? 'Pausar' : 'Continuar'} ${tempo}` : `Descansar ${pausaS} s`}
      className="inline-flex items-center gap-1"
      onClick={alternar}
    >
      {contagem && rodando ? <IcPausa className="size-4" /> : <IcPlay className="size-4" />} {contagem ? tempo : `${pausaS} s`}
    </Botao>
  )
}

function NumeroDescanso({ contagem }: { contagem: ContagemDescanso }) {
  return <div className="font-display text-2xl font-bold tabular-nums">{mmss(useContagemDescanso(contagem))}</div>
}

// Tempo corrido do treino: conta de inicioEm até "Concluir treino"; concluído mostra a duração final parada.
// Rolou a linha do relógio para fora da tela: uma pílula pequena e esmaecida fica no canto com o mesmo tempo.
function RelogioTreino({ inicio, fim, realizado, quieto, previsto, coach, onIniciar, onCancelar, anamnese }: { anamnese: boolean; inicio: number | null; fim: number | null; realizado: boolean; quieto: boolean | null; previsto: string; coach?: boolean; onIniciar: () => void; onCancelar: () => void }) {
  const [agora, setAgora] = useState(Date.now)
  const linha = useRef<HTMLDivElement>(null)
  const [topo, setTopo] = useState<number | null>(null) // px de onde a pílula começa (barra/teclado); null = relógio à vista
  // Parado: concluído, ou "Desfazer" (mantém a hora do fim desta sessão): o relógio não volta a contar de um início antigo.
  const parado = realizado || fim != null
  const rodando = inicio != null && !parado
  // A marca de treino em andamento só sai no "Concluir treino" (abrir um treino antigo já concluído não pode
  // apagar a de outro treino que está rodando neste aparelho).
  useEffect(() => {
    if (!rodando) return
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [rodando])
  // Só um booleano em estado (o React ignora valor igual): rolar não re-renderiza o treino nem esta linha (#237).
  // Também confere a cada segundo: no presencial, trocar de aluno não rola a página.
  useEffect(() => {
    if (!rodando) { setTopo(null); return }
    let quadro = 0
    const conferir = () => {
      quadro = 0
      const el = linha.current
      // Seção escondida (outro aluno no presencial) não tem offsetParent: sem pílula.
      if (!el || el.offsetParent == null) return setTopo(null)
      // Coach: a barra fixa do presencial (altura muda com a área segura) fica em cima; a pílula vai logo abaixo dela.
      const barra = coach ? document.querySelector('[role="region"][aria-label="Presencial"]')?.getBoundingClientRect().bottom ?? 0 : 0
      // Teclado aberto no iPhone: a parte visível desce (visualViewport.offsetTop); a pílula vai junto, como a FestaRecorde.
      const visivel = window.visualViewport?.offsetTop ?? 0
      setTopo(el.getBoundingClientRect().bottom < barra + 8 ? Math.round(Math.max(barra, visivel)) : null)
    }
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(conferir) }
    conferir()
    const vv = window.visualViewport
    window.addEventListener('scroll', aoRolar, { passive: true })
    vv?.addEventListener('resize', aoRolar)
    vv?.addEventListener('scroll', aoRolar)
    const id = setInterval(conferir, 1000)
    return () => {
      window.removeEventListener('scroll', aoRolar)
      vv?.removeEventListener('resize', aoRolar)
      vv?.removeEventListener('scroll', aoRolar)
      clearInterval(id)
      cancelAnimationFrame(quadro)
    }
  }, [rodando, coach])
  if (parado) {
    const d = duracaoTreino(inicio, fim) // acima de 3 h é treino esquecido aberto: sem duração falsa
    return d != null ? <p className="mb-3 text-sm text-slate-400">Duração do treino · <span className="font-semibold tabular-nums text-slate-100">{hms(d)}</span> · previsto {previsto}</p> : null
  }
  if (inicio == null && anamnese) return <a href="#/anamnese" className={classesBotao('primario', 'lg', 'borda-brilho mb-3 flex w-full items-center justify-center gap-2')}><BrilhoBorda />Responda a anamnese (3 min)</a>
  if (inicio == null) return <Botao tipo="primario" aria-label="Iniciar treino" tamanho="lg" className="borda-brilho mb-3 flex w-full items-center justify-center gap-2 shadow-lg shadow-marca-500/40" onClick={onIniciar}><BrilhoBorda /><IcPlay className="size-5" /> Iniciar treino</Botao>
  const tempo = agora - inicio > TETO_TREINO_MS ? 'mais de 3 h' : hms(agora - inicio)
  return (
    <div ref={linha} className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p role="timer" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
        <span aria-hidden className={`h-2 w-2 rounded-full bg-emerald-400 ${quieto ? '' : 'animate-pulse'}`} />
        Treino em andamento · <span data-testid="relogio-treino" className="font-semibold tabular-nums text-slate-100">{tempo}</span>
        <span className="text-slate-500">· previsto {previsto}</span>
      </p>
      <Botao tipo="alerta" className="whitespace-nowrap" onClick={onCancelar}>Cancelar treino</Botao>
      {topo != null && (
        // Entra esmaecendo e some na hora (sem exit/AnimatePresence: nada fantasma recebendo toque).
        // Sem filter/backdrop-filter (fluidez do treino).
        <m.button
          type="button"
          data-testid="relogio-flutuante"
          aria-label={`Tempo de treino ${tempo}, previsto ${previsto}. Voltar ao relógio`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={suave}
          onClick={() => linha.current?.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' })}
          style={{ top: coach ? topo + 8 : `calc(env(safe-area-inset-top) + 0.75rem + ${topo}px)` }}
          className="fixed right-3 z-30 flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900/90 px-3 text-sm text-slate-400 shadow-lg ring-1 ring-white/10 active:opacity-100"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-semibold tabular-nums text-slate-100">{tempo}</span>
          <span className="text-xs text-slate-500">/ {previsto}</span>
        </m.button>
      )}
    </div>
  )
}

type Festa = { n: number; exercicio: string; kg: number; ganho: number }

// Aviso de recorde sem caixa: "Recorde!" + o ganho contando de 0 até "+3 kg". Some sozinho em 4 s (o pai troca a `key` a cada recorde).
// Fica a 30% da área visível: no iPhone o app passa por baixo da barra de status (black-translucent) e,
// com o teclado aberto, `fixed top` sai da tela; o visualViewport diz onde está a parte que se vê.
// Sem engasgo (13/11/2026): `transform` em string (GPU/WAAPI; `y`/`scale` soltos engasgavam no Android),
// posição certa já no 1º quadro (antes pulava no meio da mola), sem confete, e a contagem escreve
// direto no DOM (MotionValue, sem re-render do React).
const topoVisivel = () => {
  const vv = window.visualViewport
  return vv ? vv.offsetTop + vv.height * 0.3 : null
}
function FestaRecorde({ festa, quieto, fechar }: { festa: Festa; quieto: boolean | null; fechar: () => void }) {
  const [topo, setTopo] = useState(topoVisivel)
  const inteiro = Number.isInteger(festa.ganho)
  const ganho = useMotionValue(quieto ? festa.ganho : 0)
  const texto = useTransform(ganho, (v) => `+${fmt(inteiro ? Math.round(v) : Math.round(v * 10) / 10)} kg`)
  useEffect(() => {
    const t = setTimeout(fechar, 4000)
    return () => clearTimeout(t)
  }, [fechar])
  useEffect(() => {
    if (quieto) return
    const c = animate(ganho, festa.ganho, { ...contagem, delay: 0.2 })
    return () => c.stop()
  }, [ganho, festa.ganho, quieto])
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const pos = () => setTopo(topoVisivel())
    vv.addEventListener('resize', pos)
    vv.addEventListener('scroll', pos)
    return () => {
      vv.removeEventListener('resize', pos)
      vv.removeEventListener('scroll', pos)
    }
  }, [])
  return (
    <m.div
      role="status"
      style={topo == null ? undefined : { top: topo }}
      initial={{ opacity: 0, ...mexe('translateY(24px) scale(0.92)') }}
      animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
      exit={{ opacity: 0, ...mexe('translateY(-32px) scale(1)'), transition: suave }}
      transition={elastico}
      className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+25vh)] z-40 mx-auto max-w-sm text-center [text-shadow:0_2px_16px_rgb(2_6_23/0.9)]"
    >
      <span className="sr-only">Novo recorde! {festa.exercicio}: {fmt(festa.kg)} kg, mais {fmt(festa.ganho)} kg</span>
      {/* Halo, não caixa: escurece o que está atrás e some nas pontas, para o texto ler sobre qualquer tela. */}
      <span aria-hidden className="absolute -inset-x-6 -inset-y-14 -z-10 bg-[radial-gradient(closest-side,rgb(2_6_23/0.92)_50%,transparent)]" />
      <span aria-hidden className="block">
        <span className="block text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Recorde!</span>
        <m.span className="block text-6xl font-black tabular-nums leading-tight text-amber-200">{texto}</m.span>
        <span className="block text-base font-bold text-slate-100">pra conta</span>
        <span className="mt-0.5 block text-xs text-slate-300">{festa.exercicio} · {fmt(festa.kg)} kg</span>
      </span>
    </m.div>
  )
}

const SEM: (number | null)[] = []
const SEM_FISIO: PropsCartao['fisio'] = []

// Igualdade de dados simples (listas, objetos literais, números, textos). Função, ref, Map e classes: só a mesma referência.
function iguais(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => iguais(x, b[i]))
  }
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && iguais((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

// Mesma lista (mesmos objetos, na mesma ordem) que a do render anterior: devolve a anterior, para o useMemo não refazer.
function useMesmaLista<T>(lista: T[]): T[] {
  const r = useRef(lista)
  if (r.current !== lista && (r.current.length !== lista.length || lista.some((x, i) => x !== r.current[i]))) r.current = lista
  return r.current
}

// O que define o plano do dia num registro (agenda, cópia da prescrição). Cargas e reps não entram; os exercícios
// anotados só contam onde comPrescricoesRegistradas os usa (sessão com cópias anteriores guardadas no meso).
const msOu = (t: unknown) => (t === undefined ? 'u' : ((t as { toMillis?: () => number } | null)?.toMillis?.() ?? 'n'))
const assinaturaPlano = (r: RegistroFlag & { id: string }, anteriores?: Record<string, unknown>) =>
  [r.id, r.semana, r.treino, r.realizado ? 1 : 0, msOu(r.realizadoEm), msOu(r.inicioEm), r.prescricaoRegistrada ?? '',
    anteriores?.[`${r.semana}-${r.treino}`] ? `${Object.keys(r.cargas ?? {}).sort()}/${Object.keys(r.reps ?? {}).sort()}` : ''].join('|')

// O que o cartão lê só na hora do toque (sempre o valor atual): não faz o cartão redesenhar.
type Vivo = {
  descanso: ReturnType<typeof useDescanso>
  cargasCruas: Cargas
  aoGravar: (nome: string, total: number | null) => void // recorde e festa
  setPcLocal: Dispatch<SetStateAction<Record<string, number>>>
  setEdAberto: Dispatch<SetStateAction<Record<string, boolean>>>
  setDropsAbertos: Dispatch<SetStateAction<Record<string, boolean>>>
  setExplicar: (m: Metodo) => void
  setFisioId: (id: string) => void
}

type PropsCartao = {
  e: ExercicioPrescrito
  grupo: { metodo: Metodo; letra: string; ordem: number; total: number } | null
  colunasCargas: (number | null)[]
  colunasReps: (number | null)[]
  colunasLados: (number | null)[]
  anterior: ReturnType<typeof cargaAnterior>
  corpo: number
  auto: boolean
  pol: string[] | null
  discretoPol: boolean
  edAberto: boolean
  trocandoPc: boolean
  travado: boolean
  volta: boolean
  coach: boolean
  meso: Meso
  mesoId: string
  uid: string
  semana: number
  treino: number
  som: boolean
  contagem?: ContagemDescanso // só no cartão do descanso que está correndo
  rodando: boolean
  isoAtivo: number | null // série da isometria cronometrando neste exercício
  notaTexto: string
  notaEm?: number
  fisio: Pick<OrientacaoFisio, 'id' | 'sinalRelatado' | 'metodoId'>[]
  rir: number | null // da última série
  dropsAbertos: Record<string, boolean>
  pesoKg?: number
  vivo: RefObject<Vivo>
}

// Cartão de um exercício. Só redesenha quando os dados DELE mudam (#237): anotar a carga de um exercício não refaz os
// outros nove. Tudo que aparece na tela vem por prop (comparada por valor); o que só vale no toque vem de `vivo`.
const CartaoExercicio = memo(function CartaoExercicio({
  e, grupo, colunasCargas, colunasReps, colunasLados, anterior, corpo, auto, pol, discretoPol, edAberto, trocandoPc, travado, volta, coach,
  meso, mesoId, uid, semana, treino, som, contagem, rodando, isoAtivo, notaTexto, notaEm, fisio, rir, dropsAbertos, pesoKg, vivo,
}: PropsCartao) {
  const t = useTextosVoz()
  const slot = e.slot.slotId
  const iso = isometrico(e.slot)
  const partes = e.rotulo ? e.rotulo.split('; ').map((p) => ({ p, mt: metodoDoRotulo(p) })) : []
  const gc = grupo ? COR_METODO[grupo.metodo] : undefined
  const frac = fracaoPC(e.slot.nome)
  const dois = doisLados(e.slot)
  const celula = (k: number) => lerCelula(colunasCargas[k], colunasLados[k], corpo)
  const ed = dois && (edAberto || ladosDiferentes(colunasCargas.map((_, k) => celula(k))))
  const gravaPc = (kg: number) => {
    const v = vivo.current
    v.setPcLocal((p) => ({ ...p, [slot]: kg }))
    // Cargas já digitadas mantêm o extra: c - corpo antigo + corpo novo (valores normalizados), tudo numa gravação.
    // Desmarcar: série que estava vazia no banco (só a leitura contava o corpo) volta a vazia, não vira 0.
    const muda = rebasear(colunasCargas, corpo, kg).filter((g) => kg > 0 || v.cargasCruas[slot]?.[g.coluna] != null)
    registrarPc(mesoId, uid, semana, treino, slot, kg, muda).catch(() =>
      v.setPcLocal(({ [slot]: _, ...resto }) => resto), // recusada: volta ao que está gravado
    )
  }
  const alternarPc = () => {
    if (trocandoPc) return
    if (corpo) return gravaPc(0)
    let peso = pesoKg
    if (!peso) {
      const n = Number((window.prompt(t.pesoPergunta) ?? '').replace(',', '.'))
      if (!(n >= 20 && n <= 300)) return
      salvarPeso(uid, n)
      peso = n
    }
    gravaPc(Math.round(peso * frac * 10) / 10)
  }
  const descanso = () => vivo.current.descanso
  const chaveIso = (k: number) => `iso:${mesoId}:${semana}:${treino}:${slot}:${k}`
  return (
    <m.div variants={item} className={`relative rounded-xl border p-4 ${gc ? gc.borda : pol && !discretoPol ? 'border-teal-400/50' : 'border-slate-700/70'}`} data-treino-cartao>
      {grupo && grupo.ordem > 0 && <span aria-hidden className={`absolute -top-4 left-6 h-4 w-0.5 ${gc?.faixa}`} />}
      {grupo && (
        <div className={`mb-2 text-xs font-semibold ${gc?.texto}`}>
          {grupo.metodo} {Array.from({ length: grupo.total }, (_, k) => <span key={k}>{k > 0 && ' / '}<span className={k === grupo.ordem ? 'text-slate-100' : ''}>{grupo.letra}{k + 1}</span></span>)}
        </div>
      )}
      <div className="mb-3 space-y-2.5">
        <div className="break-words text-base font-semibold leading-snug tracking-tight" data-treino-nome>{e.slot.nome}</div>
        <div className="flex flex-wrap items-center gap-2">
          {e.rotulo && (
            <div className="flex min-w-0 flex-wrap gap-2">
              {partes.map(({ p: parte, mt }, ip) => (
                <button
                  key={`${ip}-${parte}`}
                  disabled={!mt}
                  onClick={() => mt && vivo.current.setExplicar(mt)}
                  className={`inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${mt ? COR_METODO[mt].selo : 'bg-slate-700 text-slate-100 ring-slate-500'}`}
                >
                  {mt && <IconeMetodo metodo={mt} tamanho={20} />}
                  <span>{parte}</span> <IcInfo className="size-3.5 shrink-0" />
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5" data-treino-controles>
            {coach && <EditarExercicio meso={meso} mesoId={mesoId} semana={semana} treino={treino} pos={e.pos} nome={e.slot.nome} n={e.n} temCarga={colunasCargas.some((v) => v != null)} />}
            <Botao aria-label="Som do cronômetro" className="min-w-11" onClick={() => descanso().alternarSom()}>
              {som ? <IcSino className="size-5" /> : <IcSinoMudo className="size-5" />}
            </Botao>
            {(!grupo || grupo.ordem === grupo.total - 1) && (
              <>
                <BotaoDescanso contagem={contagem} rodando={rodando} pausaS={e.pausaS} alternar={() => descanso().alternar(e.pausaS, slot)} />
                {contagem && (
                  <Botao aria-label="Reiniciar" className="min-w-11" onClick={() => descanso().iniciar(e.pausaS, slot)}>
                    <IcReiniciar className="size-4" />
                  </Botao>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {pol && <SeloPolimento mudancas={pol} discreto={discretoPol} />}
      <Nota key={notaTexto} uid={uid} nome={e.slot.nome.trim()} texto={notaTexto} em={notaEm} />
      {iso && <p className="mb-2 text-xs text-slate-400">Tempo em segundos. Cronometre cada série e anote os segundos feitos. Carga opcional.</p>}
      {dois && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Anote os kg de cada lado (o app soma os dois).</span>
          {!ladosDiferentes(colunasCargas.map((_, k) => celula(k))) && <BotaoLadosDiferentes aberto={edAberto} onAlternar={() => vivo.current.setEdAberto((p) => ({ ...p, [slot]: !p[slot] }))} />}
        </div>
      )}
      {fisio.map((o) => (
        <button key={o.id} type="button" onClick={() => vivo.current.setFisioId(o.id)} className="mb-2 mr-2 min-h-11 rounded-full bg-teal-900 px-3 text-sm font-bold text-teal-100 ring-1 ring-teal-500">
          {o.sinalRelatado ? t.fisioPausado : `Físio · ${o.metodoId}`}
        </button>
      ))}
      <RelatarDor uid={uid} exercicio={e.slot.nome.trim()} sessao={{ mesoId, semana, treino }} slots={{ [e.slot.nome.trim()]: e.slot.slotId }} />
      {anterior && (anterior.estimada || anterior.origem.anterior || anterior.origem.treino !== treino) && <p className="mb-2 text-xs text-slate-400">Cargas em cinza: {anterior.estimada ? 'ajustadas às repetições de hoje, a partir do' : 'última vez no'} Treino {anterior.origem.treino} · {anterior.origem.anterior ? `ciclo anterior (semana ${anterior.origem.semana})` : anterior.origem.semana === semana ? 'esta semana' : `semana ${anterior.origem.semana}`}</p>}
      <div className="space-y-2">
        {(() => {
        // Colunas do drop pendurado na série s (1-based); drop sem série (exercício sem séries) vai para o fim.
        const dropsDa = (s: number) => e.drops.flatMap((d, j) => (d.serie === s ? [e.n + j] : []))
        const soltos = e.drops.flatMap((d, j) => (d.serie >= 1 && d.serie <= e.n ? [] : [e.n + j]))
        const linha = (k: number) => {
          const repAlvo = e.reps[k]
          const dropStage = k >= e.n
          const rotuloCol = dropStage ? `D${e.drops[k - e.n]?.etapa ?? k - e.n + 1}` : `S${k + 1}`
          const chaveDrop = `${slot}-${k + 1}`
          const temDrop = !dropStage && dropsDa(k + 1).length > 0
          const pv = (n: number) => fmt(volta ? cargaVolta(n) : n)
          const antE = dropStage ? anterior?.drops[k - e.n] : anterior?.series[k]
          const antD = dropStage ? anterior?.dir?.drops[k - e.n] : anterior?.dir?.series[k]
          const placeholderKg = dropStage
            ? (e.cargaSugerida[k] ?? (antE != null ? pv(antE) : null))
            : antE != null
              ? dois && antD != null && antD !== antE && !ed ? `${pv(antE)}/${pv(antD)}` : pv(antE)
              : null
          const placeholderD = antD != null ? pv(antD) : null
          // "Confere?": referência numérica do número cinza (a mesma que o aluno vê), para pedir confirmação de carga bem diferente.
          const refNum = (n: number | null | undefined) => (n == null ? null : volta ? cargaVolta(n) : n)
          const referenciaE = dropStage && e.cargaSugerida[k] != null ? e.cargaSugerida[k] : refNum(antE)
          const referenciaD = refNum(antD)
          // Uma faixa colorida por método que cobre esta série (etapas do drop = Dropset).
          const cores = [...new Set(partes.filter(({ p, mt }) => mt && (dropStage ? mt === 'Dropset' : seriesDoRotulo(p, e.n).includes(k + 1))).map(({ mt }) => mt!))]
          // Efeitos comuns a toda carga gravada (total já com o corpo).
          const aposGravar = (total: number | null) => {
            if (auto && total != null) gravaPc(corpo) // fixa a escolha antes da 1ª carga
            if (temDrop && total != null && dropsAbertos[chaveDrop] === undefined) vivo.current.setDropsAbertos((p) => ({ ...p, [chaveDrop]: true })) // série feita: o drop vem logo depois
            vivo.current.aoGravar(e.slot.nome, total)
          }
          return (
            <div key={k} className={`relative grid grid-cols-[1.75rem_3.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 ${dropStage ? 'pl-6' : e.rotulo ? 'pl-3' : ''}`}>
              {cores.length > 0 && (
                <span aria-hidden className="absolute inset-y-0 left-0 flex gap-0.5">
                  {cores.map((c) => (
                    <span key={c} className={`w-1 rounded-full ${COR_METODO[c].faixa}`} />
                  ))}
                </span>
              )}
              {iso ? <button type="button" disabled={travado} aria-label={`Cronometrar ${e.slot.nome}, ${rotuloCol}, ${repAlvo} segundos`} aria-pressed={isoAtivo === k} className="min-h-11 rounded text-xs font-bold text-marca-300 ring-1 ring-slate-700" onClick={() => descanso().alternar(repAlvo, chaveIso(k))}>{rotuloCol} <IcPlay className="mx-auto size-3" /></button> : <span className={`text-xs ${cores[0] ? `font-bold ${COR_METODO[cores[0]].texto}` : 'text-slate-400'}`}>{rotuloCol}</span>}
              <span className="truncate text-xs text-slate-400">{repAlvo} {iso ? 's' : 'reps'}</span>
              {dois ? (
                <CampoLados
                  className="min-w-0"
                  disabled={travado}
                  cel={celula(k)}
                  ed={!!ed}
                  placeholder={placeholderKg}
                  placeholderD={placeholderD}
                  referencia={referenciaE}
                  referenciaD={referenciaD}
                  onGravar={(esq, dir) => {
                    registrarCargaLados(mesoId, uid, semana, treino, e.slot.slotId, k, esq, dir, corpo)
                    aposGravar(esq == null || dir == null ? null : Math.round((esq + dir + corpo) * 100) / 100)
                  }}
                />
              ) : (
                <LoadInput
                  className="w-full min-w-0"
                  disabled={travado}
                  valor={colunasCargas[k] != null ? Math.max(0, Math.round((colunasCargas[k]! - corpo) * 100) / 100) : null}
                  placeholder={placeholderKg}
                  referencia={referenciaE}
                  onSalvar={(v) => {
                    const total = v == null ? null : Math.round((v + corpo) * 100) / 100
                    registrarCarga(mesoId, uid, semana, treino, e.slot.slotId, k, total)
                    aposGravar(total)
                  }}
                />
              )}
              <span className="text-xs text-slate-600">{dois ? (ed ? 'kg' : 'kg/lado') : 'kg'}</span>
              <LoadInput
                className="w-full min-w-0"
                disabled={travado}
                ariaLabel={`${e.slot.nome}, ${rotuloCol}, ${iso ? 'segundos feitos' : 'repetições feitas'}`}
                valor={colunasReps[k] ?? null}
                placeholder={repAlvo}
                onSalvar={(v) => { registrarReps(mesoId, uid, semana, treino, e.slot.slotId, k, v) }}
              />
              <span className="text-xs text-slate-600">{iso ? 's feitos' : 'feitas'}</span>
            </div>
          )
        }
        return (
          <>
            {Array.from({ length: e.n }, (_, k) => {
              const cols = dropsDa(k + 1)
              const chave = `${slot}-${k + 1}`
              const aberto = dropsAbertos[chave] ?? cols.some((c) => colunasCargas[c] != null || colunasReps[c] != null)
              return (
                <Fragment key={k}>
                  {linha(k)}
                  {!iso && k === e.n - 1 && colunasCargas[k] != null && (
                    <PerguntaRir mesoId={mesoId} uid={uid} semana={semana} treino={treino} slotId={slot} coluna={k} valor={rir} disabled={travado} />
                  )}
                  {cols.length > 0 && (
                    <button
                      type="button"
                      aria-expanded={aberto}
                      onClick={() => vivo.current.setDropsAbertos((p) => ({ ...p, [chave]: !aberto }))}
                      className={`ml-6 flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 ${COR_METODO.Dropset.selo}`}
                    >
                      <IconeMetodo metodo="Dropset" tamanho={16} />
                      Drop da S{k + 1} · {cols.length} {cols.length === 1 ? 'etapa' : 'etapas'}
                      <IcVoltar className={`size-4 transition-transform ${aberto ? 'rotate-90' : '-rotate-90'}`} />
                    </button>
                  )}
                  {aberto && cols.map(linha)}
                </Fragment>
              )
            })}
            {soltos.map(linha)}
          </>
        )
        })()}
      </div>
      {/* Logo abaixo das séries: o app soma o peso do corpo ao extra digitado. */}
      <label className="mt-4 flex min-h-11 items-start gap-2.5 rounded-xl border border-slate-700/70 bg-slate-950/30 px-3 py-3 text-sm text-slate-200">
        <input type="checkbox" checked={!!corpo} disabled={trocandoPc || travado} onChange={alternarPc} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <b>Feito com o peso do corpo</b>
          <span className="block text-xs text-slate-400">
            {auto || (corpo > 0 && corpoEhCarga(e.slot.nome))
              ? 'Já vem marcado porque neste exercício o corpo é a carga. Nos campos, anote só o peso extra (anilha, colete, cinto).'
              : 'Nos campos, anote só o peso extra (anilha, colete, cinto).'}
          </span>
          {!!corpo && <span className="mt-1 block text-xs text-slate-400">Séries em branco contam só o peso do corpo ao concluir.</span>}
        </span>
      </label>
      {corpo > 0 && pesoKg && (
        <p className="mt-2 text-xs text-slate-400">
          Peso do corpo contado: {fmt(corpo)} kg ({Math.round(frac * 100)}% de {fmt(pesoKg)} kg)
        </p>
      )}
    </m.div>
  )
}, iguais)

export default function Treino({ uid, mesoId, semana, treino, base = '', coach }: { uid: string; mesoId: string; semana: number; treino: number; base?: string; coach?: boolean }) {
  const { dados, carregando } = useDoc<MesoSalvo>(doc(db, 'mesos', mesoId))
  const { dados: docsRegistros, pendente, carregando: carregandoReg } = useLista<RegistroFlag>(
    query(collection(db, 'registros'), where('alunoId', '==', uid), where('mesoId', '==', mesoId)),
  )
  const { dados: notas } = useDoc<NotasDoc>(doc(db, 'notas', uid))
  // Presencial: sempre à lista do aluno (a pilha mistura alunos do grupo). Aluno: à tela de onde veio (Início ou Treino).
  const sair = () => (coach ? ir(base) : voltar('/treino'))
  const [pcLocal, setPcLocal] = useState<Record<string, number>>({}) // vale até o Firestore confirmar
  const { dados: perfil } = useDoc<Usuario>(doc(db, 'usuarios', uid))
  // Mesma tela e mesmas funções para aluno e coach (presencial); só a voz muda (ver voz.ts).
  const nomeAluno = perfil?.nome ?? ''
  const voz = useMemo<Voz>(() => ({ coach: !!coach, nome: nomeAluno }), [coach, nomeAluno])
  const t = textosVoz(voz)
  // Carga sugerida pelas repetições (RM): escolha de quem está usando (aluno, ou o coach no presencial). Sem escolha = pergunta 1x.
  const eu = useUsuarioAtual()
  const estimarRm = eu.perfil?.estimativaRm === true
  const perguntarRm = !!eu.user && !!eu.perfil && eu.perfil.estimativaRm === undefined && !navigator.webdriver // e2e não abre pop-up
  const an = useAnamnese(uid)
  const orient = useOrientacoes(uid) // presencial também: o coach vê e usa a Físio do aluno
  const orientacoes = orient.dados
  const [fisioId, setFisioId] = useState<string | null>(null) // só o id: a orientação é lida da lista a cada render (recolher/sinal chegam sem recarregar)
  const pedirAnamnese = !coach && an.travar // coach/presencial nunca trava
  const descanso = useDescanso()
  const semInternet = useSemInternet()
  const [explicar, setExplicar] = useState<Metodo | null>(null)
  // Chavinha do drop de cada série (`${slotId}-${serie}`). Sem escolha: aberto se o drop já tem algo anotado.
  const [edAberto, setEdAberto] = useState<Record<string, boolean>>({}) // "lados diferentes" aberto, por exercício
  const [dropsAbertos, setDropsAbertos] = useState<Record<string, boolean>>({})
  const [inicioLocal, setInicioLocal] = useState<number | null>(null) // hora do toque, até o servidor confirmar
  const jaIniciou = useRef(false)
  // Festa no recorde: só leitura do histórico inteiro do aluno.
  const quieto = useReducedMotion()
  // Histórico inteiro só depois que a tela entrou: carregar e calcular tudo durante o deslize travava a abertura no iPhone.
  const depois = useDepoisDaEntrada()
  const qTodos = useMemo(() => (depois ? query(collection(db, 'registros'), where('alunoId', '==', uid)) : null), [uid, depois])
  const qMesos = useMemo(() => (depois ? query(collection(db, 'mesos'), where('alunoId', '==', uid)) : null), [uid, depois])
  const { dados: todosRegistros } = useLista<RegistroEvolucao>(qTodos)
  const { dados: todosMesos } = useLista<MesoSalvo>(qMesos)
  // Histórico e fonte anterior dependem só das OUTRAS sessões: anotar carga hoje não os refaz (#237: recalcular o
  // histórico inteiro a cada carga custava ~30 ms por anotação em CPU lenta e crescia com cada treino salvo).
  // useLista mantém o mesmo objeto dos documentos que não mudaram; mesmaLista devolve a lista anterior se nada mudou.
  const outrosRegistros = useMesmaLista(todosRegistros.filter((r) => !(r.mesoId === mesoId && r.semana === semana && r.treino === treino)))
  const historico = useMemo(
    () => historicoExercicios(todosMesos.map((x) => ({ id: x.id, meso: docParaMeso(x), nome: x.nome })), outrosRegistros),
    [todosMesos, outrosRegistros],
  )
  // Meso anterior do aluno (maior início antes do atual), já convertido, para a sugestão da 1ª semana de um ciclo novo.
  const fonteAnterior = useMemo((): Fonte | null => {
    if (!dados) return null
    const inicio = docParaMeso(dados).inicio.slice(0, 10)
    const ant = todosMesos
      .filter((x) => x.id !== mesoId)
      .map((x) => ({ x, m: docParaMeso(x) }))
      .filter(({ m }) => m.inicio.slice(0, 10) < inicio)
      .sort((a, b) => b.m.inicio.localeCompare(a.m.inicio))[0]
    const docs = ant ? outrosRegistros.filter((r) => r.mesoId === ant.x.id) : []
    if (!ant || !docs.length) return null
    const meso = comPrescricoesRegistradas(ant.m, docs)
    return {
      meso,
      registros: docsParaRegistros(docs, meso),
      reps: docsParaRegistrosReps(docs),
      lados: docsParaLados(docs),
      pcs: Object.fromEntries(docs.map((r) => [`${r.semana}-${r.treino}`, lerPc(r.pc)])),
    }
  }, [dados, todosMesos, outrosRegistros, mesoId])
  // Modelo pessoal de RM por exercício (curva do próprio aluno; só com a chave ligada). Fica em memória: roda por mudança de dados, não por toque.
  const modelosRm = useMemo(() => {
    if (!dados || !estimarRm) return null
    const meso = comPrescricoesRegistradas(docParaMeso(dados), docsRegistros)
    const atual: Fonte = {
      meso,
      registros: docsParaRegistros(docsRegistros, meso),
      reps: docsParaRegistrosReps(docsRegistros),
      lados: docsParaLados(docsRegistros),
      pcs: Object.fromEntries(docsRegistros.map((r) => [`${r.semana}-${r.treino}`, lerPc(r.pc)])),
    }
    return modelosPorExercicio(atual, { semana, treino }, fonteAnterior)
  }, [dados, docsRegistros, estimarRm, fonteAnterior, semana, treino])
  const festejados = useRef(new Set<string>())
  const [festa, setFesta] = useState<Festa | null>(null)
  const fecharFesta = useCallback(() => setFesta(null), [])
  const [verResumo, setVerResumo] = useState(false)
  const [fimLocal, setFimLocal] = useState<number | null>(null) // hora do "Concluir", até o servidor confirmar
  const [confirmarFim, setConfirmarFim] = useState(false) // 2º toque no "Concluir": aluno pediu, concluía sem querer
  const historicoResumo = useMemo(
    () => (verResumo ? historicoExercicios(todosMesos.map((x) => ({ id: x.id, meso: docParaMeso(x), nome: x.nome })), todosRegistros) : null),
    [verResumo, todosMesos, todosRegistros],
  )
  // Plano do dia: só refaz quando muda o que o define (agenda, cópia da prescrição), não a cada carga anotada.
  // Assim a sessão e cada exercício mantêm o mesmo objeto e os cartões que não mudaram não redesenham (#237).
  const diaHoje = diaSP(Date.now())
  const anteriores = (dados as { prescricoesAnteriores?: Record<string, unknown> } | null)?.prescricoesAnteriores
  const chavePlano = docsRegistros.map((r) => assinaturaPlano(r, anteriores)).join('\n')
  const valido = Number.isInteger(semana) && semana >= 1 && Number.isInteger(treino) && treino >= 1 // NaN faria prescreverSessao lançar
  const dia = useMemo(() => {
    if (!dados) return null
    const hoje = new Date()
    const plano = comVolta(docParaMeso(dados), docsRegistros, hoje) // sem as cópias registradas
    const meso = comPrescricoesRegistradas(plano, docsRegistros)
    const sessao = valido ? prescreverSessao(meso, semana, treino) : null
    const escopoPol = sessao && escopoPolimento(sessao)
    const normal = sessao && escopoPol ? prescricaoNormal(plano, semana, treino) : null
    return { plano, meso, sessao, escopoPol, normal, volta: semanaDeVolta(meso, docsRegistros, hoje, semana) }
  }, [dados, chavePlano, diaHoje, valido, semana, treino]) // eslint-disable-line react-hooks/exhaustive-deps
  const vivo = useRef<Vivo>(null!)

  const naoEncontrado = (
    <Centro>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold">{semInternet ? TEXTO_SEM_INTERNET : 'Treino não encontrado.'}</p>
        <Botao tipo="fantasma" onClick={sair}>Voltar</Botao>
      </div>
    </Centro>
  )
  if (carregando || carregandoReg || (!coach && an.carregando)) return <Centro>Carregando…</Centro> // registros também: senão treino já iniciado aparece como "Iniciar treino"
  if (!dados || !(Number.isInteger(semana) && semana >= 1 && Number.isInteger(treino) && treino >= 1)) return naoEncontrado // NaN faria prescreverSessao lançar

  const hoje = new Date()
  if (!coach && semanaAtual(docParaMeso(dados), hoje).estado === 'antes')
    return (
      <Centro>
        <p className="text-slate-300">Este ciclo ainda não começou.</p>
        <Botao tipo="fantasma" onClick={sair}>Voltar</Botao>
      </Centro>
    )
  if (!dia?.sessao) return naoEncontrado
  const { meso, sessao, escopoPol, normal, volta } = dia // volta: e a carga anterior (número cinza) também
  // Polimento: aviso no topo quando é o dia (ou a semana) inteiro; o card de cada exercício diz o que muda.
  const resumoPol = escopoPol === 'dia' ? resumoPolimento(sessao, normal) : ''

  const cargas = docsParaRegistros(docsRegistros, meso) // totais normalizados (ver normalizarCargas)
  const repsFeitas = docsParaRegistrosReps(docsRegistros)
  const rirFeito = docsParaRegistrosRir(docsRegistros) // repetições que sobraram (0..3) por série
  const ladosFeitos = docsParaLados(docsRegistros) // lado esquerdo (formato novo de 2 lados)
  const chave = `${semana}-${treino}`
  const cs = cargas[chave] ?? {}
  const rs = repsFeitas[chave] ?? {}
  const docAtual = docsRegistros.find((r) => r.semana === semana && r.treino === treino)
  const pcs = lerPc(docAtual?.pc)
  const cargasCruas = docParaCargas(docAtual?.cargas) // o que está gravado de fato (para decidir o que gravar)
  const pcsPorRegistro = Object.fromEntries(docsRegistros.map((r) => [`${r.semana}-${r.treino}`, lerPc(r.pc)]))
  // Pop-up da carga sugerida por RM: só na 1ª vez em que ela traria algo (ajustada às reps de hoje, corrigida ou do ciclo anterior).
  const sugereRm = perguntarRm && sessao.exercicios.some((e) => {
    if (e.polimento != null) return false
    const r = cargaAnterior(meso, cargas, semana, treino, e.pos, pcsPorRegistro, ladosFeitos, repsFeitas, { anterior: fonteAnterior })
    return !!r && (r.estimada || !!r.origem.anterior)
  })
  const iniciou = () => {
    if (inicioMs != null || jaIniciou.current) return // início pendente offline lê null: não conta, senão o botão fica morto depois de recarregar
    jaIniciou.current = true
    const t = Date.now()
    setInicioLocal(t)
    marcarTreino(t) // treino em andamento neste aparelho conta como uso (inatividade)
    // Reaproveita a cópia gravada só se for válida; a defeituosa (sem séries) é refeita, e nunca se grava uma vazia.
    const copiaGravada = lerPrescricaoRegistrada(docAtual?.prescricaoRegistrada) ? docAtual?.prescricaoRegistrada : undefined
    marcarInicio(mesoId, uid, semana, treino, copiaGravada ?? (copiaVazia({ sessao }) ? undefined : JSON.stringify({ versao: 1, sessao, metodos: metodosDaSessao(meso, semana, treino) })))
  }
  const cancelar = () => {
    if (!window.confirm('Cancelar este treino? O tempo zera e as cargas e reps anotadas nele são apagadas.')) return
    cancelarTreino(mesoId, semana, treino, docAtual)
    limparTreino()
    setInicioLocal(null)
    setFimLocal(null)
    setPcLocal({})
    jaIniciou.current = false
    descanso.parar()
  }
  const vermelho = acimaDoLimite(sessao.tempoMin, meso.tempoLimiteMin)
  const realizado = docsRegistros.some((r) => r.semana === semana && r.treino === treino && r.realizado)
  const ms = (t: unknown) => (t as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? null
  const inicioMs = ms(docAtual?.inicioEm) ?? inicioLocal
  const fimMs = fimDaSessao(inicioMs, ms(docAtual?.realizadoEm)) ?? fimLocal
  const comecou = inicioMs != null || docAtual?.inicioEm !== undefined || fimMs != null // início pendente offline (null) também conta; fimMs é só o fim desta sessão (fim sem início, da planilha, não conta)
  const travado = !coach && !comecou && !realizado // aluno só anota depois de "Iniciar treino" (treino concluído continua editável)
  if (!coach && !comecou && !realizado && travadoAgenda(meso, docsRegistros, hoje, semana, treino) && ms(docAtual?.realizadoEm) == null) { // já tem fim salvo ("Desfazer" numa semana antiga): não tranca
    return (
      <Centro>
        <div className="flex flex-col items-center gap-3 text-center">
          <IcCadeado className="size-10 text-slate-400" />
          <p className="text-lg font-semibold">Semana {semana} já passou.</p>
          <Botao tipo="fantasma" onClick={sair}>Voltar</Botao>
        </div>
      </Centro>
    )
  }
  const abrirResumo = () => {
    setVerResumo(true)
    window.scrollTo(0, 0)
  }

  // Peso do corpo de um exercício (render e "Concluir"). Automático só em slot sem carga e sem escolha explícita: o histórico nunca muda.
  const estadoCorpo = (e: (typeof sessao.exercicios)[number]) => {
    const slot = e.slot.slotId
    const explicito = slot in pcLocal || slot in pcs
    const auto = !explicito && !(cs[slot] ?? []).some((c) => c != null) && corpoEhCarga(e.slot.nome) && !!perfil?.pesoKg
    const corpo = explicito ? (pcLocal[slot] ?? (pcs[slot] || 0)) : auto ? Math.round(perfil!.pesoKg! * fracaoPC(e.slot.nome) * 10) / 10 : 0
    return { auto, corpo }
  }
  const concluir = () => {
    for (const e of sessao.exercicios) {
      const { corpo } = estadoCorpo(e)
      if (!(corpo > 0)) continue
      const slot = e.slot.slotId
      if (!(slot in pcs)) registrarPc(mesoId, uid, semana, treino, slot, corpo)
      // Crua: série vazia só com reps feitas (que a leitura já conta como corpo) também é gravada.
      for (const { coluna, kg } of preencherCorpo(cargasCruas[slot] ?? [], e.n, corpo))
        if (doisLados(e.slot)) registrarCargaLados(mesoId, uid, semana, treino, slot, coluna, 0, 0, corpo) // 0 | 0 + corpo: ganha `lados`, não vira "anotado antes"
        else registrarCarga(mesoId, uid, semana, treino, slot, coluna, kg)
    }
    limparTreino()
    avisarCoach('concluiu') // o Worker ignora quando quem conclui é o coach (presencial)
    marcarRealizado(mesoId, uid, semana, treino, true, fimMs != null) // fim real desta sessão (inclusive offline, pendente) é mantido; fim de fora (planilha/antigo) é trocado por agora
    setFimLocal(Date.now())
    setConfirmarFim(false)
    abrirResumo()
  }
  // Desfazer logo depois de concluir (até 3 h do início): o treino volta a correr do início original, sem perder o tempo.
  // Treino antigo ou sem início (planilha) segue como antes: mantém a hora do fim e o relógio parado.
  const desfazer = () => {
    if (inicioMs != null && Date.now() - inicioMs < TETO_TREINO_MS) {
      reabrirTreino(mesoId, uid, semana, treino)
      marcarTreino(inicioMs)
      setFimLocal(null)
    } else marcarRealizado(mesoId, uid, semana, treino, false)
  }

  // Exercícios do mesmo grupo de método ficam juntos (só a ordem de exibição muda).
  const grupoDe = (pos: number) => {
    const l = metodosDaSessao(meso, semana, treino).find((x) => x.ativo && x.exercicio === pos && x.grupo != null && METODOS_SEQUENCIA.test(x.metodo))
    return l ? `${l.metodo}|${l.grupo}` : null
  }
  const chavesBrutas = sessao.exercicios.map((e) => grupoDe(e.pos))
  const chaves = chavesBrutas.map((c) => (chavesBrutas.filter((x) => x === c).length >= 2 ? c : null)) // grupo de 1 só exercício não é grupo
  const ordemGrupos = [...new Set(chaves.filter(Boolean))]
  const visitado = new Set<number>()
  const exibicao = sessao.exercicios.flatMap((e, i) => {
    if (visitado.has(i)) return []
    const membros = chaves[i] ? sessao.exercicios.filter((_, j) => chaves[j] === chaves[i]) : [e]
    membros.forEach((x) => visitado.add(sessao.exercicios.indexOf(x)))
    return membros
  })
  const notaInicial = [...new Set(sessao.exercicios.flatMap((e) => (e.rotulo ? e.rotulo.split('; ') : []).map(metodoDoRotulo)))].filter((x): x is Metodo => x != null && !notaDispensada(x))
  const adaptadoEm = (dados as { adaptadoEm?: { toMillis(): number } }).adaptadoEm?.toMillis() // docParaMeso não traz adaptadoEm

  const fisioAberto = orientacoes.find((o) => o.id === fisioId)
  const prefixoIso = `iso:${mesoId}:${semana}:${treino}:`
  vivo.current = {
    descanso,
    cargasCruas,
    aoGravar: (nome, total) => {
      const anterior = recordeAnterior(historico, nome, { mesoId, semana, treino })
      const ganho = Math.round(((total ?? 0) - (anterior ?? 0)) * 10) / 10 // abaixo de 0,05 kg (peso do corpo) não festeja "+0 kg"
      if (comecou && !festejados.current.has(nome) && ehRecorde(anterior, total) && ganho > 0) {
        festejados.current.add(nome)
        navigator.vibrate?.([80, 40, 120])
        setFesta({ n: festejados.current.size, exercicio: nome, kg: total!, ganho })
      }
    },
    setPcLocal,
    setEdAberto,
    setDropsAbertos,
    setExplicar,
    setFisioId,
  }
  if (verResumo)
    return (
      <VozTreino.Provider value={voz}>
      <FimTreino
        nome={perfil?.nome?.trim().split(/\s+/)[0]}
        duracaoMs={duracaoTreino(inicioMs, fimMs)}
        resumo={resumoTreino(historicoResumo ?? {}, { mesoId, semana, treino })}
        semana={semana}
        feitosSemana={new Set(docsRegistros.filter((r) => r.semana === semana && r.realizado).map((r) => r.treino)).size}
        frequencia={meso.frequencia}
        quieto={quieto}
        voltar={sair}
        verTreino={() => setVerResumo(false)}
        // Check-in só para treino concluído há pouco (até 12 h): resumo de treino antigo não pergunta (a hora gravada seria a de agora).
        checkin={fimMs == null || Date.now() - fimMs > 12 * 3600_000 ? undefined : { uid, sessao: { mesoId, semana, treino }, exercicios: [...new Set(sessao.exercicios.map((e) => e.slot.nome.trim()))], slots: Object.fromEntries(sessao.exercicios.map((e) => [e.slot.nome.trim(), e.slot.slotId])) }}
      />
      </VozTreino.Provider>
    )

  return (
    <VozTreino.Provider value={voz}>
    <div className="treino-pagina min-h-lvh">
    <main className="mx-auto max-w-md px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <AvisoNotificacoes />
      {meso.historicoIncerto?.includes(chave) && <p role="status" className="p-3 text-sm text-amber-200">Este registro antigo chegou sem versão da prescrição. A prescrição anterior é uma referência; confira as cargas e repetições registradas.</p>}
      <BotaoVoltar aoVoltar={sair} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold">Treino {treino}</h1>
          <p className="text-xs text-slate-400">
            Semana {semana} · pausa {meso.pausaPrincipaisS != null && meso.pausaPrincipaisS !== meso.pausaS ? `${meso.pausaPrincipaisS}s/${meso.pausaS}` : sessao.pausaS}s · início {fmtData(sessao.inicioSemana)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 font-display text-lg font-bold ${vermelho ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-100'}`}>{fmtMin(sessao.tempoMin)}</span>
        {pendente && <span className="max-w-[40%] text-right text-xs text-amber-400">salvo no celular · envia quando tiver internet</span>}
      </div>

      <RelogioTreino inicio={inicioMs} fim={fimMs} realizado={realizado} quieto={quieto} previsto={fmtMin(sessao.tempoMin)} coach={coach} onIniciar={iniciou} onCancelar={cancelar} anamnese={pedirAnamnese} />
      {!comecou && !realizado && (coach
        ? <p className="mb-3 text-sm text-slate-400">Sem iniciar: as cargas ficam salvas, mas o treino não conta como feito.</p>
        : <p className="mb-3 text-sm text-amber-300">{pedirAnamnese ? 'Responda a anamnese para liberar o treino.' : 'Toque em Iniciar treino para anotar as cargas.'}</p>)}
      {coach && an.travar && <p role="status" className="mb-3 text-sm text-amber-300">{t.anamnesePendente} <a href={`#/aluno/${uid}/anamnese`} className="font-semibold underline">Ver anamnese</a></p>}
      <AnimatePresence>{festa && <FestaRecorde key={festa.n} festa={festa} quieto={quieto} fechar={fecharFesta} />}</AnimatePresence>
      <NotaMetodos metodos={notaInicial} />
      <AnimatePresence>{explicar && <ExplicacaoMetodo metodo={explicar} fechar={() => setExplicar(null)} />}</AnimatePresence>
      <AnimatePresence>{fisioAberto && metodoFisio(fisioAberto.metodoId) && (
        <Modal rotulo={`Físio ${fisioAberto.metodoId}`} aoFechar={() => setFisioId(null)}>
          <BotaoSinal id={fisioAberto.id} sinalRelatado={fisioAberto.sinalRelatado} pendente={orient.pendente}>{(interrompida) => <>
            {!interrompida && fisioAberto.recado && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-slate-800 p-3 text-sm">{t.recado} {fisioAberto.recado}</p>}
            <ConteudoMetodo metodo={metodoFisio(fisioAberto.metodoId)!} protocolo={!interrompida && !an.pausado && metodoLiberavel(fisioAberto.metodoId)} />
          </>}</BotaoSinal>
          <Botao tipo="primario" tamanho="lg" className="mt-4 w-full" onClick={() => setFisioId(null)}>Fechar</Botao>
        </Modal>
      )}</AnimatePresence>
      {adaptadoEm != null && <AvisoAdaptado chave={`forca-adaptado-${mesoId}-${adaptadoEm}`} />}
      <Novidades />
      <AnimatePresence>{sugereRm && eu.user && <AvisoEstimativaRm uid={eu.user.uid} onde={coach ? 'Minha conta' : 'Conta'} />}</AnimatePresence>
      {coach && meso.sessoes?.[chave] && <FaixaAjustado mesoId={mesoId} semana={semana} treino={treino} />}
      {resumoPol && <FaixaPolimento semana={semanaDePolimento(meso, semana)} resumo={resumoPol} />}
      <m.div className="space-y-4" variants={cascata} initial="hidden" animate="show">
        {exibicao.map((e) => {
          const gk = chaves[sessao.exercicios.indexOf(e)]
          const membros = gk ? exibicao.filter((x) => chaves[sessao.exercicios.indexOf(x)] === gk) : []
          const slot = e.slot.slotId
          const nome = e.slot.nome.trim()
          const { auto, corpo } = estadoCorpo(e)
          const isoCol = descanso.slot?.startsWith(`${prefixoIso}${slot}:`) ? Number(descanso.slot.slice(prefixoIso.length + slot.length + 1)) : NaN
          return (
            <CartaoExercicio
              key={slot}
              e={e}
              grupo={gk ? { metodo: gk.split('|')[0] as Metodo, letra: String.fromCharCode(65 + ordemGrupos.indexOf(gk)), ordem: membros.indexOf(e), total: membros.length } : null}
              colunasCargas={cs[slot] ?? SEM}
              colunasReps={rs[slot] ?? SEM}
              colunasLados={ladosFeitos[chave]?.[slot] ?? SEM}
              anterior={cargaAnterior(meso, cargas, semana, treino, e.pos, pcsPorRegistro, ladosFeitos, estimarRm ? repsFeitas : undefined, { anterior: estimarRm ? fonteAnterior : null, modelos: estimarRm ? modelosRm : null })} // só o extra, com o corpo do registro de origem
              corpo={corpo}
              auto={auto}
              pol={mudancasPolimento(e, normal?.exercicios.find((x) => x.slot.slotId === slot))}
              discretoPol={!!resumoPol}
              edAberto={!!edAberto[slot]}
              // Troca do corpo ainda não confirmada pelo Firestore: um 2º toque rebasearia sobre cargas velhas.
              trocandoPc={slot in pcLocal && pcLocal[slot] !== (pcs[slot] ?? 0)}
              travado={travado}
              volta={volta}
              coach={!!coach}
              meso={meso}
              mesoId={mesoId}
              uid={uid}
              semana={semana}
              treino={treino}
              som={descanso.som}
              contagem={descanso.slot === slot ? descanso.contagem : undefined}
              rodando={descanso.slot === slot && descanso.rodando}
              isoAtivo={Number.isInteger(isoCol) ? isoCol : null}
              notaTexto={textoNota(notas?.exercicios?.[nome])}
              notaEm={msDaNota(notas?.datas?.[nome])}
              fisio={an.pausado ? SEM_FISIO : orientacoesDoExercicio(orientacoes, e.slot.nome).map((o) => ({ id: o.id, sinalRelatado: o.sinalRelatado, metodoId: o.metodoId }))}
              rir={rirFeito[chave]?.[slot]?.[e.n - 1] ?? null}
              dropsAbertos={dropsAbertos}
              pesoKg={perfil?.pesoKg}
              vivo={vivo}
            />
          )
        })}
      </m.div>
      {coach && <div className="mt-4"><AdicionarExercicio meso={meso} mesoId={mesoId} semana={semana} treino={treino} /></div>}

      <div className="mt-6">
        {realizado ? (
          <div className="space-y-2 text-center">
            <p className="font-semibold text-emerald-400">
              Treino concluído{' '}
              <m.span
                className="inline-block"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={elastico}
              >
                <IcCheck className="size-5" />
              </m.span>
            </p>
            <div className="flex justify-center gap-2">
              <Botao tipo="primario" tamanho="lg" onClick={abrirResumo}>
                Ver resumo
              </Botao>
              <Botao tipo="fantasma" onClick={desfazer}>Desfazer</Botao>
            </div>
          </div>
        ) : (
          comecou && (confirmarFim ? (
            <div role="alertdialog" aria-label="Concluir o treino?" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-center">
              <p className="font-semibold">Concluir o treino?</p>
              <p className="text-sm text-slate-400">Confira se anotou todas as cargas.</p>
              <div className="flex gap-2">
                <Botao tipo="vidro" tamanho="lg" className="flex-1" onClick={() => setConfirmarFim(false)}>Continuar treinando</Botao>
                <Botao tipo="primario" tamanho="lg" className="flex-1" onClick={concluir}>Sim, concluir</Botao>
              </div>
            </div>
          ) : (
            <Botao tipo="primario" tamanho="lg" className="w-full" onClick={() => setConfirmarFim(true)}>
              Concluir treino
            </Botao>
          ))
        )}
      </div>

      {sessao.exercicios.some(e => isometrico(e.slot)) && <p className="mb-4 rounded-xl bg-slate-900 p-3 text-sm" role="status">Tempo sob tensão: {metricasSessao(sessao, cs, rs).tempoSobTensaoS} s (feitos ou prescritos).</p>}
      <AnimatePresence>
      {descanso.visivel && (
        <m.div
          initial={{ ...mexe('translateY(24px)'), opacity: 0 }}
          animate={sobe}
          exit={{ ...mexe('translateY(24px)'), opacity: 0, transition: saida }}
          transition={suave}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-900 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
        >
          <div className="mx-auto mb-2 h-1.5 max-w-md overflow-hidden rounded bg-slate-800">
            <m.div
              key={descanso.ciclo}
              className="h-full w-full origin-left rounded bg-marca-500" // scaleX (GPU), não width: corre o descanso inteiro
              initial={{ transform: `scaleX(${descanso.contagem.ler() / descanso.total})` }}
              animate={{ transform: descanso.pausado ? `scaleX(${descanso.contagem.ler() / descanso.total})` : 'scaleX(0)' }}
              transition={{ duration: descanso.pausado ? 0 : descanso.contagem.ler(), ease: 'linear' }}
            />
          </div>
          <div className="mx-auto flex max-w-md items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">{descanso.slot?.startsWith('iso:') ? 'Isometria · série em andamento' : 'Descanso'}</div>
              <NumeroDescanso contagem={descanso.contagem} />
            </div>
            <Botao onClick={descanso.parar}>Pular</Botao>
          </div>
        </m.div>
      )}
      </AnimatePresence>
    </main>
    </div>
    </VozTreino.Provider>
  )
}
